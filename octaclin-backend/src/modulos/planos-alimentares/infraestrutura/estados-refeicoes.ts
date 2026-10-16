import { EntityManager } from 'typeorm';

export interface EstadoOperacionalRefeicao {
  refeicao_id: string;
  identidade_id: string;
  ativa: boolean;
}
/** Chamar sob lock do paciente/plano: o resultado nunca autoriza acesso por si só. */
export async function lerEstadosRefeicoes(
  gerenciador: EntityManager, tenantId: string, planoId: string, versaoId: string
): Promise<EstadoOperacionalRefeicao[]> {
  return gerenciador.query(`select l.refeicao_id,l.identidade_id,e.ativa
    from plano_alimentar_refeicao_vinculos l join plano_alimentar_refeicao_estados e
      on e.tenant_id=l.tenant_id and e.plano_id=l.plano_id and e.id=l.identidade_id
    where l.tenant_id=$1 and l.plano_id=$2 and l.versao_id=$3`, [tenantId,planoId,versaoId]);
}
