import type { EntityManager } from 'typeorm';
import type { FaixaPrioridadeAcompanhamento } from '../dominio/prioridade-acompanhamento';

export interface PrioridadeOperacional {
  faixa: FaixaPrioridadeAcompanhamento;
  origem: 'calculado' | 'override';
  scoreCalculado: number | null;
  calculadoEm: Date | null;
}

interface LinhaPrioridade {
  paciente_id: string;
  score: number;
  faixa: FaixaPrioridadeAcompanhamento;
  override_faixa: FaixaPrioridadeAcompanhamento | null;
  override_expira_em: Date | string | null;
  calculado_em: Date | string;
  possui_calculo: boolean;
}

/**
 * Le somente pacientes que o chamador ja autorizou. A linha de estado pode
 * nascer de um override antes do primeiro job; por isso o evento `calculo`,
 * e nao a existencia da linha, prova que o score foi apurado.
 */
export async function consultarPrioridadesOperacionais(
  gerenciador: EntityManager,
  tenantId: string,
  pacienteIds: string[],
  agora = new Date()
): Promise<Map<string, PrioridadeOperacional>> {
  const resultado = new Map<string, PrioridadeOperacional>();
  if (!pacienteIds.length) return resultado;

  const linhas = await gerenciador.query(
    `select prioridade.paciente_id, prioridade.score, prioridade.faixa,
       prioridade.override_faixa, prioridade.override_expira_em,
       prioridade.calculado_em,
       exists (
         select 1 from prioridades_acompanhamento_historico historico
         where historico.tenant_id = prioridade.tenant_id
           and historico.paciente_id = prioridade.paciente_id
           and historico.tipo_evento = 'calculo'
       ) as possui_calculo
     from prioridades_acompanhamento_paciente prioridade
     where prioridade.tenant_id = $1
       and prioridade.paciente_id = any($2::uuid[])`,
    [tenantId, pacienteIds]
  ) as LinhaPrioridade[];

  const autorizados = new Set(pacienteIds);
  for (const linha of linhas) {
    if (!autorizados.has(linha.paciente_id)) continue;
    const overrideAtivo = Boolean(
      linha.override_faixa && linha.override_expira_em && new Date(linha.override_expira_em).getTime() > agora.getTime()
    );
    if (!overrideAtivo && !linha.possui_calculo) continue;
    resultado.set(linha.paciente_id, {
      faixa: overrideAtivo ? linha.override_faixa! : linha.faixa,
      origem: overrideAtivo ? 'override' : 'calculado',
      scoreCalculado: linha.possui_calculo ? Number(linha.score) : null,
      calculadoEm: linha.possui_calculo ? new Date(linha.calculado_em) : null
    });
  }
  return resultado;
}

/** Usado no SQL paginado da lista; os parametros sao sempre do servidor. */
export function condicaoFaixaEfetivaPrioridade(aliasPacienteId: string): string {
  return `exists (
    select 1 from prioridades_acompanhamento_paciente prioridade
    where prioridade.tenant_id = :tenantPrioridade
      and prioridade.paciente_id = ${aliasPacienteId}
      and (
        (prioridade.override_faixa = :faixaPrioridade and prioridade.override_expira_em > now())
        or (
          prioridade.faixa = :faixaPrioridade
          and (prioridade.override_expira_em is null or prioridade.override_expira_em <= now())
          and exists (
            select 1 from prioridades_acompanhamento_historico historico
            where historico.tenant_id = prioridade.tenant_id
              and historico.paciente_id = prioridade.paciente_id
              and historico.tipo_evento = 'calculo'
          )
        )
      )
  )`;
}
