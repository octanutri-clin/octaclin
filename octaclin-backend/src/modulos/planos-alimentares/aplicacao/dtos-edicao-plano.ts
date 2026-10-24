import { plainToInstance } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, Validate, ValidateIf, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';
import { AlimentoEdicao, DocumentoEdicaoPlano, numeroEdicao, validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { AtualizarRascunhoPlanoAlimentarDto } from './dtos';
import { LIMITE_BYTES_EDICAO_PLANO } from '../dominio/edicao-plano';

@ValidatorConstraint({ name: 'documentoEdicaoPlano', async: false })
export class ValidadorDocumentoEdicaoPlano implements ValidatorConstraintInterface {
  validate(valor: unknown, argumentos: ValidationArguments): boolean {
    try {
      validarDocumentoEdicaoPlano(valor);
      // O documento e as referências de proveniência compõem um único body HTTP.
      // Limitar apenas o documento permitiria exceder o parser de 100 KB.
      return Buffer.byteLength(JSON.stringify(argumentos.object), 'utf8') <= LIMITE_BYTES_EDICAO_PLANO;
    } catch { return false; }
  }
  defaultMessage(): string { return 'Documento de edição do plano inválido.'; }
}

/** Referência não secreta; o backend revalida acesso e lê o contexto cifrado da origem. */
export class ReferenciaCopiaEquivalenciaDto {
  @IsUUID() pacienteOrigemId: string;
  @IsUUID() planoOrigemId: string;
  @IsInt() @Min(1) @Max(2147483646) numeroVersaoOrigem: number;
  @IsString() @Length(1, 100) itemChaveOrigem: string;
  @IsString() @Length(1, 100) alternativaChaveOrigem: string;
  @IsString() @Length(1, 100) itemChaveDestino: string;
  @IsString() @Length(1, 100) alternativaChaveDestino: string;
}

export class SalvarEdicaoPlanoDto {
  @IsUUID() rascunhoIdEsperado: string;
  @IsInt() @Min(0) @Max(2147483646) rascunhoRevisaoEsperada: number;
  @IsDefined() @Validate(ValidadorDocumentoEdicaoPlano) documento: DocumentoEdicaoPlano;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ReferenciaCopiaEquivalenciaDto)
  copiasEquivalencia?: ReferenciaCopiaEquivalenciaDto[];
}

/** Legado sem precondição continua somente enquanto o rascunho não aderiu à PA06. */
export class PrecondicaoEdicaoPlanoDto {
  @ValidateIf(d => d.rascunhoRevisaoEsperada !== undefined || d.rascunhoIdEsperado !== undefined)
  @IsUUID() rascunhoIdEsperado?: string;
  @ValidateIf(d => d.rascunhoRevisaoEsperada !== undefined || d.rascunhoIdEsperado !== undefined)
  @IsInt() @Min(0) @Max(2147483646) rascunhoRevisaoEsperada?: number;
}

export function converterEdicaoParaRascunho(
  documento: DocumentoEdicaoPlano,
  identidade: { id: string; rascunhoRevisao?: number; apresentacaoRevisao?: number }
): AtualizarRascunhoPlanoAlimentarDto {
  const manual = documento.possuiCondicaoEspecial === true;
  const porPeso = manual && documento.metodoMacrosManual === 'gramas_por_kg';
  function percentual(campo: 'carboidratosBasisPoints' | 'proteinasBasisPoints' | 'gordurasBasisPoints') {
    if (documento.percentuaisMacrosEdicao && Object.prototype.hasOwnProperty.call(documento.percentuaisMacrosEdicao, campo)) {
      const valor = numeroEdicao(documento.percentuaisMacrosEdicao[campo]);
      // Não arredondar uma prescrição: a validação clínica continua exigindo basis points inteiros.
      if (valor === undefined) return undefined;
      const [mantissa, expoente = '0'] = String(valor).split('e');
      return Number(`${mantissa}e${Number(expoente) + 2}`);
    }
    return numeroEdicao(documento[campo]);
  }
  function alimento(a: AlimentoEdicao) {
    const micros = Object.entries(a.micronutrientesPor100g ?? {})
      .filter(([, v]) => v !== undefined && v !== null && !(typeof v === 'string' && !v.trim()));
    return {
      alimentoComposicaoId: a.alimentoComposicaoId || undefined,
      descricao: a.descricao,
      quantidade: numeroEdicao(a.quantidade), unidade: a.unidade,
      porcaoGramas: numeroEdicao(a.porcaoGramas),
      micronutrientesPor100g: micros.length
        ? Object.fromEntries(micros.map(([k, v]) => [k, numeroEdicao(v) ?? NaN]))
        : undefined,
      nutrientesPor100g: a.nutrientesPor100g
        ? Object.fromEntries(Object.entries(a.nutrientesPor100g).map(([k, v]) => [k, numeroEdicao(v)]))
        : undefined
    };
  }
  return plainToInstance(AtualizarRascunhoPlanoAlimentarDto, {
    rascunhoIdEsperado: identidade.id,
    rascunhoRevisaoEsperada: identidade.rascunhoRevisao ?? 0,
    preferenciasApresentacao: documento.preferenciasApresentacao,
    apresentacaoRevisaoEsperada: documento.preferenciasApresentacao ? identidade.apresentacaoRevisao ?? 0 : undefined,
    avaliacaoAntropometricaId: documento.avaliacaoAntropometricaId || undefined,
    origemMeta: manual ? 'manual' : 'formula',
    formula: manual ? undefined : documento.formula,
    fatorAtividade: manual ? undefined : numeroEdicao(documento.fatorAtividade),
    ajusteEnergeticoKcal: manual ? undefined : numeroEdicao(documento.ajusteEnergeticoKcal),
    metodoMacrosManual: manual ? documento.metodoMacrosManual : undefined,
    metaEnergeticaManualKcal: manual && !porPeso ? numeroEdicao(documento.metaEnergeticaManualKcal) : undefined,
    macrosGramasPorKg: porPeso ? {
      carboidratosGPorKg: numeroEdicao(documento.carboidratosGPorKg),
      proteinasGPorKg: numeroEdicao(documento.proteinasGPorKg),
      gordurasGPorKg: numeroEdicao(documento.gordurasGPorKg)
    } : undefined,
    distribuicaoMacros: porPeso ? undefined : {
      carboidratosBasisPoints: percentual('carboidratosBasisPoints'),
      proteinasBasisPoints: percentual('proteinasBasisPoints'),
      gordurasBasisPoints: percentual('gordurasBasisPoints')
    },
    possuiCondicaoEspecial: documento.possuiCondicaoEspecial,
    aplicabilidadeFormulaConfirmada: manual ? undefined : documento.aplicabilidadeFormulaConfirmada,
    justificativaCondicaoEspecial: manual ? documento.justificativaCondicaoEspecial : undefined,
    justificativaDivergenciaClinica: documento.justificativaDivergenciaClinica || undefined,
    objetivos: documento.objetivos, observacoes: documento.observacoes || undefined,
    refeicoes: documento.refeicoes.map(r => ({
      nome: r.nome, horarioLocal: r.horarioLocal || undefined, orientacoes: r.orientacoes || undefined,
      itens: r.itens.map(i => ({ ...alimento(i),
        substituicoesVisiveisInicialmente: (i.substituicoes?.length ?? 0) ? numeroEdicao(i.substituicoesVisiveisInicialmente) : undefined,
        substituicoes: (i.substituicoes ?? []).map(a => ({ ...alimento(a), liberadaParaPaciente: a.liberadaParaPaciente === true, preferida: a.preferida === true }))
      }))
    }))
  });
}
