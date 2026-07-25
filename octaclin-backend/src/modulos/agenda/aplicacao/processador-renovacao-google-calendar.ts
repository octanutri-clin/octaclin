import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './servico-google-calendar';
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

function urlWebhook(): string {
  const base = process.env.OCTACLIN_BACKEND_URL?.trim() ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/agenda/google/notificacoes`;
}

const JANELA_RENOVACAO_MS = 1000 * 60 * 60 * 48;

@Injectable()
export class ProcessadorRenovacaoGoogleCalendar {
  private readonly logger = new Logger(ProcessadorRenovacaoGoogleCalendar.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar
  ) {}

  @Cron('0 3 * * *')
  async renovarCanaisEReconciliar(): Promise<void> {
    const tenants = await this.fonteDados.getRepository(TenantOrm).find({ where: { status: 'ativo' } });

    for (const tenant of tenants) {
      try {
        const conexoes = await this.executorTenant.executar(tenant.id, (gerenciador) =>
          gerenciador
            .getRepository(ProfissionalGoogleConexaoOrm)
            .find({ where: { tenantId: tenant.id, desconectadoEm: IsNull() } })
        );

        for (const conexao of conexoes) {
          try {
            if (this.precisaRenovar(conexao)) {
              await this.renovarCanal(conexao);
            }
            await this.servicoSincronizacao.reconciliar(conexao.tenantId, conexao.profissionalId);
          } catch (erro) {
            this.logger.warn(
              `Falha ao renovar/reconciliar canal do profissional ${conexao.profissionalId}: ${
                erro instanceof Error ? erro.message : 'erro desconhecido'
              }`
            );
          }
        }
      } catch (erro) {
        this.logger.warn(
          `Falha ao processar renovacao de canais Google Calendar do tenant ${tenant.id}: ${
            erro instanceof Error ? erro.message : 'erro desconhecido'
          }`
        );
      }
    }
  }

  private precisaRenovar(conexao: ProfissionalGoogleConexaoOrm): boolean {
    if (!conexao.canalWatchId || !conexao.canalExpiraEm) return true;
    return conexao.canalExpiraEm.getTime() - Date.now() < JANELA_RENOVACAO_MS;
  }

  private async renovarCanal(conexao: ProfissionalGoogleConexaoOrm): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(conexao.tenantId, conexao.profissionalId);
    if (!credenciais) return;

    if (conexao.canalWatchId && conexao.canalRecursoId) {
      await this.googleCalendar.pararCanalWatch(credenciais, conexao.canalWatchId, conexao.canalRecursoId);
      await this.fonteDados.getRepository(GoogleCanalWatchOrm).delete({ canalWatchId: conexao.canalWatchId });
    }

    const novoCanalId = randomUUID();
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, novoCanalId, urlWebhook());

    await this.executorTenant.executar(conexao.tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const atual = await repositorio.findOne({ where: { tenantId: conexao.tenantId, profissionalId: conexao.profissionalId } });
      if (!atual) return;
      atual.canalWatchId = novoCanalId;
      atual.canalRecursoId = recursoId;
      atual.canalExpiraEm = expiraEm;
      await repositorio.save(atual);
    });

    await this.fonteDados.getRepository(GoogleCanalWatchOrm).save(
      this.fonteDados.getRepository(GoogleCanalWatchOrm).create({
        canalWatchId: novoCanalId,
        tenantId: conexao.tenantId,
        profissionalId: conexao.profissionalId,
        expiraEm
      })
    );
  }
}
