import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';

export const TIMEOUT_PADRAO_TENANT_MS = 120_000;

export interface ResultadoRodadaPorTenant {
  tenantsAvaliados: number;
  tenantsComFalha: number;
  tenantsExpirados: number;
}

interface OpcoesRodadaPorTenant {
  /** Tempo maximo por tenant antes de seguir para o proximo. */
  timeoutMs?: number;
}

class ErroTimeoutTenant extends Error {}

/**
 * Percorre os tenants ativos aplicando `operacao` em cada um, isolado dos demais.
 *
 * Existe porque o laco "busca tenants ativos e itera" estava repetido em todos os
 * processadores agendados, e nem todos isolavam a falha: uma excecao em um tenant
 * derrubava silenciosamente todos os que viriam depois na mesma rodada.
 *
 * O timeout nao cancela a operacao travada — JavaScript nao permite isso. Ele apenas
 * impede que um tenant lento prenda a fila inteira: a rodada segue para o proximo e
 * registra o estouro, em vez de nenhum tenant seguinte ser processado.
 */
export async function executarPorTenantAtivo(
  fonteDados: DataSource,
  logger: Logger,
  rotulo: string,
  operacao: (tenantId: string) => Promise<void>,
  opcoes: OpcoesRodadaPorTenant = {}
): Promise<ResultadoRodadaPorTenant> {
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_PADRAO_TENANT_MS;
  const tenants = await fonteDados.getRepository(TenantOrm).find({ where: { status: 'ativo' } });
  const resultado: ResultadoRodadaPorTenant = {
    tenantsAvaliados: tenants.length,
    tenantsComFalha: 0,
    tenantsExpirados: 0
  };

  for (const tenant of tenants) {
    try {
      await comTimeout(operacao(tenant.id), timeoutMs);
    } catch (erro) {
      if (erro instanceof ErroTimeoutTenant) {
        resultado.tenantsExpirados += 1;
        logger.error(`${rotulo}: tenant ${tenant.id} excedeu ${timeoutMs}ms e ficou para a proxima rodada.`);
        continue;
      }
      resultado.tenantsComFalha += 1;
      logger.warn(
        `${rotulo}: falha no tenant ${tenant.id}: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
      );
    }
  }

  return resultado;
}

function comTimeout<T>(promessa: Promise<T>, timeoutMs: number): Promise<T> {
  let temporizador: NodeJS.Timeout;
  const expiracao = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new ErroTimeoutTenant()), timeoutMs);
  });

  return Promise.race([promessa, expiracao]).finally(() => clearTimeout(temporizador)) as Promise<T>;
}
