import { Allow, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { AlternativaEdicao, DocumentoEdicaoPlano, LIMITE_BYTES_EDICAO_PLANO, numeroEdicao, validarDocumentoEdicaoPlano } from '../dominio/edicao-plano';
import { objetoGrupo, porcaoGrupoValida, UUID_GRUPO } from '../dominio/grupos-substituicoes';
import { NutrienteEquivalencia, nutrienteEquivalenciaValido, PoliticaEquivalencia, validarPoliticaEquivalencia } from '../dominio/equivalencia-nutriente';
export interface PedidoEquivalencias {
  versaoId: string; rascunhoRevisaoEsperada: number; documentoEdicao: DocumentoEdicaoPlano;
  itemChave: string; nutriente: NutrienteEquivalencia; alternativas: AlternativaEdicao[]; politica: PoliticaEquivalencia; recalculoExplicitoChaves?: string[];
}
export function validarPedidoEquivalencias(v: unknown): PedidoEquivalencias {
  const p = objetoGrupo(v, ['versaoId','rascunhoRevisaoEsperada','documentoEdicao','itemChave','nutriente','alternativas','politica','recalculoExplicitoChaves']);
  if (Buffer.byteLength(JSON.stringify(v),'utf8') > LIMITE_BYTES_EDICAO_PLANO || typeof p.versaoId !== 'string' || !UUID_GRUPO.test(p.versaoId) || !Number.isInteger(p.rascunhoRevisaoEsperada) || Number(p.rascunhoRevisaoEsperada) < 0 || Number(p.rascunhoRevisaoEsperada) > 2147483646 || !nutrienteEquivalenciaValido(p.nutriente)) throw new Error('Pedido de equivalência inválido.');
  const documentoEdicao = validarDocumentoEdicaoPlano(p.documentoEdicao);
  const principal = documentoEdicao.refeicoes.flatMap(r=>r.itens).find(i=>i.chaveCliente===p.itemChave);
  if (!principal || !porcaoGrupoValida(numeroEdicao(principal.porcaoGramas)) || !Array.isArray(p.alternativas) || !p.alternativas.length || p.alternativas.length > 20) throw new Error('Item ou alternativas inválidos.');
  const documentoAlternativas = validarDocumentoEdicaoPlano({schemaVersao:1,refeicoes:[{chaveCliente:'__food05_refeicao__',itens:[{chaveCliente:'__food05_principal__',substituicoes:p.alternativas}]}]});
  const alternativas = documentoAlternativas.refeicoes[0].itens[0].substituicoes!;
  if (alternativas.some(a=>a.chaveCliente===principal.chaveCliente)) throw new Error('Alternativa não pode ser o principal.');
  let recalculoExplicitoChaves:string[]|undefined;
  if(p.recalculoExplicitoChaves!==undefined){
    if(!Array.isArray(p.recalculoExplicitoChaves)||!p.recalculoExplicitoChaves.length||p.recalculoExplicitoChaves.length>20||p.recalculoExplicitoChaves.some((k:unknown)=>typeof k!=='string'||!k.trim()||k.length>100)||new Set(p.recalculoExplicitoChaves).size!==p.recalculoExplicitoChaves.length)throw new Error('Chaves de recálculo inválidas.');
    const disponiveis=new Set(alternativas.map(a=>a.chaveCliente));
    if(p.recalculoExplicitoChaves.some((k:string)=>!disponiveis.has(k)))throw new Error('Chave de recálculo fora das alternativas.');
    recalculoExplicitoChaves=[...p.recalculoExplicitoChaves];
  }
  return {versaoId:p.versaoId.toLowerCase(),rascunhoRevisaoEsperada:p.rascunhoRevisaoEsperada as number,documentoEdicao,itemChave:principal.chaveCliente,nutriente:p.nutriente,alternativas,politica:validarPoliticaEquivalencia(p.politica),...(recalculoExplicitoChaves?{recalculoExplicitoChaves}:{})};
}
@ValidatorConstraint({name:'pedidoEquivalencias',async:false})
class PedidoValido implements ValidatorConstraintInterface {
  validate(_v: unknown, a: ValidationArguments) { try { validarPedidoEquivalencias({ ...a.object }); return true; } catch { return false; } }
  defaultMessage() { return 'Pedido de equivalência inválido.'; }
}
export class PreverEquivalenciasDto implements PedidoEquivalencias {
  @Validate(PedidoValido) versaoId: string;
  @Allow() rascunhoRevisaoEsperada: number;
  @Allow() documentoEdicao: DocumentoEdicaoPlano;
  @Allow() itemChave: string;
  @Allow() nutriente: NutrienteEquivalencia;
  @Allow() alternativas: AlternativaEdicao[];
  @Allow() politica: PoliticaEquivalencia;
  @Allow() recalculoExplicitoChaves?: string[];
}
