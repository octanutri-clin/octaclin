import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantOrm } from '../../modulos/tenancy/infraestrutura/tenant.orm';

export const TIMEOUT_PADRAO_TENANT_MS = 120_000;

export interface ResultadoRodadaPorTenant {
  tenantsAvaliados: number;
  tenantsComFalha: number;
  tenantsExpirados: number;
  /** Tenants que outra instancia ja estava processando nesta mesma rodada. */
  tenantsIgnoradosPorTrava: number;
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
    tenantsExpirados: 0,
    tenantsIgnoradosPorTrava: 0
  };

  for (const tenant of tenants) {
    const trava = await tentarTravar(fonteDados, rotulo, tenant.id);
    if (!trava) {
      resultado.tenantsIgnoradosPorTrava += 1;
      logger.log(`${rotulo}: tenant ${tenant.id} ja esta sendo processado por outra instancia.`);
      continue;
    }

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
    } finally {
      await trava.liberar();
    }
  }

  return resultado;
}

/**
 * Trava de rodada, exigida pelo aceite da Fase 201: duas instancias concorrentes
 * produzem no maximo um efeito externo por evento.
 *
 * Os processadores que consomem fila reivindicam item a item antes do efeito
 * externo, e isso basta para eles. Os que rodam por `@Cron` nao tem item para
 * reivindicar: o mesmo horario dispara em toda instancia, e um processador que
 * le candidatos, envia e so depois registra — como o recall de inatividade —
 * mandaria a mesma mensagem duas vezes ao mesmo paciente.
 *
 * Advisory lock em vez de tabela nova: a garantia e de rodada, nao de dado, e
 * nao vale uma migration com DDL em producao. A trava vive na sessao de um
 * QueryRunner dedicado, entao ela cai sozinha se o processo morrer no meio da
 * rodada, sem deixar tenant preso ate alguem limpar registro na mao.
 *
 * A chave e por (rotulo, tenant): rodadas diferentes do mesmo tenant nao se
 * bloqueiam.
 */
async function tentarTravar(
  fonteDados: DataSource,
  rotulo: string,
  tenantId: string
): Promise<{ liberar: () => Promise<void> } | null> {
  const chaveRodada = hash32(rotulo);
  const chaveTenant = hash32(tenantId);
  const executor = fonteDados.createQueryRunner();
  await executor.connect();

  try {
    const linhas = await executor.query('SELECT pg_try_advisory_lock($1, $2) AS obtida', [chaveRodada, chaveTenant]);
    if (!linhas?.[0]?.obtida) {
      await executor.release();
      return null;
    }
  } catch (erro) {
    await executor.release();
    throw erro;
  }

  return {
    liberar: async () => {
      try {
        await executor.query('SELECT pg_advisory_unlock($1, $2)', [chaveRodada, chaveTenant]);
      } finally {
        await executor.release();
      }
    }
  };
}

/** FNV-1a de 32 bits, com sinal, porque pg_try_advisory_lock recebe int4. */
function hash32(valor: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < valor.length; i += 1) {
    hash ^= valor.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

function comTimeout<T>(promessa: Promise<T>, timeoutMs: number): Promise<T> {
  let temporizador: NodeJS.Timeout;
  const expiracao = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new ErroTimeoutTenant()), timeoutMs);
  });

  return Promise.race([promessa, expiracao]).finally(() => clearTimeout(temporizador)) as Promise<T>;
}
