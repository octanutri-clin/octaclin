import { In, IsNull, type EntityManager } from 'typeorm';
import type { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { situacaoFaixa, type ResultadoMarcador } from '../dominio/resultado-exame-laboratorial';
import { ColetaExameLaboratorialOrm } from '../infraestrutura/coleta-exame-laboratorial.orm';
import { MarcadorExameLaboratorialOrm } from '../infraestrutura/marcador-exame-laboratorial.orm';
import type { ExamesForaFaixaResumoDto } from './dtos';

const LIMITE_COLETAS = 100;
const LIMITE_RESULTADOS = 10_000;
const LIMITE_DESTAQUES = 10;

type GrupoMaisRecente = {
  coletaId: string;
  coletadaEm: string;
  origemAgrupamento: 'catalogo' | 'nome_livre';
  resultados: Array<{ marcador: MarcadorExameLaboratorialOrm; resultado: ResultadoMarcador }>;
};

function normalizar(valor: string): string {
  return valor.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

function validarResultado(valor: unknown): ResultadoMarcador {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Resultado inválido.');
  const resultado = valor as Record<string, unknown>;
  if (typeof resultado.nome !== 'string' || !resultado.nome.trim() || typeof resultado.valor !== 'string') {
    throw new Error('Resultado inválido.');
  }
  for (const campo of ['unidade', 'referencia', 'metodo', 'limiteInferior', 'limiteSuperior'] as const) {
    if (resultado[campo] !== undefined && typeof resultado[campo] !== 'string') throw new Error('Resultado inválido.');
  }
  return resultado as ResultadoMarcador;
}

function gerarChave(marcador: MarcadorExameLaboratorialOrm, resultado: ResultadoMarcador): {
  chave: string;
  origemAgrupamento: GrupoMaisRecente['origemAgrupamento'];
} {
  if (marcador.catalogoMarcadorId) {
    return {
      chave: JSON.stringify(['catalogo', marcador.catalogoMarcadorId]),
      origemAgrupamento: 'catalogo'
    };
  }
  return {
    chave: JSON.stringify([
      'livre', normalizar(resultado.nome), resultado.unidade?.trim() ?? '', normalizar(resultado.metodo ?? '')
    ]),
    origemAgrupamento: 'nome_livre'
  };
}

function resumoIndisponivel(): ExamesForaFaixaResumoDto {
  return { status: 'indisponivel' };
}

export async function obterLeituraExamesResumo(
  gerenciador: EntityManager,
  criptografia: CriptografiaDadosSensiveis,
  tenantId: string,
  pacienteId: string
): Promise<ExamesForaFaixaResumoDto> {
  const coletas = await gerenciador.getRepository(ColetaExameLaboratorialOrm).find({
    where: { tenantId, pacienteId, excluidaEm: IsNull() },
    order: { coletadaEm: 'DESC', criadoEm: 'DESC', id: 'DESC' },
    take: LIMITE_COLETAS + 1,
    select: { id: true, coletadaEm: true, criadoEm: true }
  });
  const coletasAnalisadas = coletas.slice(0, LIMITE_COLETAS);
  if (!coletasAnalisadas.length) {
    return {
      status: 'disponivel', coletasAnalisadas: 0, limiteColetas: LIMITE_COLETAS, historicoTruncado: false,
      gruposAnalisados: 0, gruposNomeLivre: 0, semClassificacao: 0, duplicadosNaUltimaColeta: 0,
      totalForaFaixa: 0, itensLimitados: false, itens: []
    };
  }

  const resultados = await gerenciador.getRepository(MarcadorExameLaboratorialOrm).find({
    where: { tenantId, coletaId: In(coletasAnalisadas.map(({ id }) => id)), excluidoEm: IsNull() },
    order: { ordemExibicao: 'ASC', id: 'ASC' },
    take: LIMITE_RESULTADOS + 1,
    select: {
      id: true, coletaId: true, catalogoMarcadorId: true, ordemExibicao: true, resultadoCriptografado: true
    }
  });
  if (resultados.length > LIMITE_RESULTADOS) return resumoIndisponivel();

  try {
    const resultadosPorColeta = new Map<string, MarcadorExameLaboratorialOrm[]>();
    for (const marcador of resultados) {
      const itens = resultadosPorColeta.get(marcador.coletaId) ?? [];
      itens.push(marcador);
      resultadosPorColeta.set(marcador.coletaId, itens);
    }

    const grupos = new Map<string, GrupoMaisRecente>();
    for (const coleta of coletasAnalisadas) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(coleta.coletadaEm)) throw new Error('Data inválida.');
      for (const marcador of resultadosPorColeta.get(coleta.id) ?? []) {
        const resultado = validarResultado(JSON.parse(criptografia.descriptografar(marcador.resultadoCriptografado)) as unknown);
        const { chave, origemAgrupamento } = gerarChave(marcador, resultado);
        const grupoExistente = grupos.get(chave);
        if (grupoExistente?.coletaId === coleta.id) {
          grupoExistente.resultados.push({ marcador, resultado });
        } else if (!grupoExistente) {
          grupos.set(chave, {
            coletaId: coleta.id,
            coletadaEm: coleta.coletadaEm,
            origemAgrupamento,
            resultados: [{ marcador, resultado }]
          });
        }
      }
    }

    let semClassificacao = 0;
    let duplicadosNaUltimaColeta = 0;
    const itensForaDaFaixa: Extract<ExamesForaFaixaResumoDto, { status: 'disponivel' }>['itens'] = [];
    for (const grupo of grupos.values()) {
      if (grupo.resultados.length > 1) {
        duplicadosNaUltimaColeta += 1;
        continue;
      }
      const [{ marcador, resultado }] = grupo.resultados;
      const situacao = situacaoFaixa(resultado);
      if (situacao === undefined) {
        semClassificacao += 1;
        continue;
      }
      if (situacao !== 'fora_da_faixa') {
        continue;
      }
      itensForaDaFaixa.push({
        resultadoId: marcador.id,
        coletaId: grupo.coletaId,
        origemAgrupamento: grupo.origemAgrupamento,
        nome: resultado.nome,
        valor: resultado.valor,
        unidade: resultado.unidade!,
        coletadaEm: grupo.coletadaEm,
        limiteInferior: resultado.limiteInferior,
        limiteSuperior: resultado.limiteSuperior,
        referencia: resultado.referencia,
        metodo: resultado.metodo
      });
    }

    const itens = itensForaDaFaixa.slice(0, LIMITE_DESTAQUES);
    return {
      status: 'disponivel',
      coletasAnalisadas: coletasAnalisadas.length,
      limiteColetas: LIMITE_COLETAS,
      historicoTruncado: coletas.length > LIMITE_COLETAS,
      gruposAnalisados: grupos.size,
      gruposNomeLivre: Array.from(grupos.values()).filter(({ origemAgrupamento }) => origemAgrupamento === 'nome_livre').length,
      semClassificacao,
      duplicadosNaUltimaColeta,
      totalForaFaixa: itensForaDaFaixa.length,
      itensLimitados: itensForaDaFaixa.length > itens.length,
      itens
    };
  } catch {
    return resumoIndisponivel();
  }
}
