import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoExclusaoProcessador } from '../../../infraestrutura/processamento/servico-exclusao-processador';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from './servico-google-calendar';
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';
import { gerarIdentificadorCanalWatchGoogle } from './identificador-canal-watch-google';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';

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
    private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar,
    private readonly exclusaoProcessador?: ServicoExclusaoProcessador
  ) {}

  @Cron('0 3 * * *')
  async renovarCanaisEReconciliar(): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Renovacao Google Calendar', async (tenantId) => {
      const conexoes = await this.executorTenant.executar(tenantId, (gerenciador) =>
        gerenciador
          .getRepository(ProfissionalGoogleConexaoOrm)
          .find({ where: { tenantId, desconectadoEm: IsNull() } })
      );

      for (const conexao of conexoes) {
        try {
          const executarExclusivo = this.exclusaoProcessador
            ? (operacao: () => Promise<void>) => this.exclusaoProcessador!.executar(tenantId, `google-watch:${conexao.profissionalId}`, operacao)
            : (operacao: () => Promise<void>) => operacao();
          await executarExclusivo(async () => {
            const atual = this.exclusaoProcessador
              ? await this.obterConexaoAtual(conexao.tenantId, conexao.profissionalId)
              : conexao;
            if (!atual) return;
            if (this.precisaRenovar(atual)) await this.renovarCanal(atual);
            if (this.exclusaoProcessador) {
              await this.servicoSincronizacao.reconciliarComExclusao(conexao.tenantId, conexao.profissionalId);
            } else {
              await this.servicoSincronizacao.reconciliar(conexao.tenantId, conexao.profissionalId);
            }
          });
        } catch (erro) {
          this.logger.warn(
            `Falha ao renovar/reconciliar canal do profissional ${conexao.profissionalId}: ${
              erro instanceof Error ? erro.message : 'erro desconhecido'
            }`
          );
        }
      }
    });
  }

  private precisaRenovar(conexao: ProfissionalGoogleConexaoOrm): boolean {
    if (!conexao.canalWatchId || !conexao.canalExpiraEm) return true;
    return conexao.canalExpiraEm.getTime() - Date.now() < JANELA_RENOVACAO_MS;
  }

  private obterConexaoAtual(tenantId: string, profissionalId: string): Promise<ProfissionalGoogleConexaoOrm | null> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({ where: { tenantId, profissionalId } })
    );
  }

  private async renovarCanal(conexao: ProfissionalGoogleConexaoOrm): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(conexao.tenantId, conexao.profissionalId);
    if (!credenciais) return;

    if (conexao.canalWatchId && conexao.canalRecursoId) {
      await this.googleCalendar.pararCanalWatch(credenciais, conexao.canalWatchId, conexao.canalRecursoId);
    }

    const novoCanalId = gerarIdentificadorCanalWatchGoogle(conexao.tenantId);
    const token = randomBytes(24).toString('hex');
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, novoCanalId, urlWebhook(), token);

    await this.executorTenant.executar(conexao.tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const repositorioCanal = gerenciador.getRepository(GoogleCanalWatchOrm);
      const atual = await repositorio.findOne({ where: { tenantId: conexao.tenantId, profissionalId: conexao.profissionalId } });
      if (!atual) return;
      if (conexao.canalWatchId) await repositorioCanal.delete({ canalWatchId: conexao.canalWatchId });
      atual.canalWatchId = novoCanalId;
      atual.canalRecursoId = recursoId;
      atual.canalExpiraEm = expiraEm;
      atual.ultimoSyncToken = undefined;
      atual.falhasConsecutivasSincronizacao = 0;
      await repositorio.save(atual);
      await repositorioCanal.save(
        repositorioCanal.create({
          canalWatchId: novoCanalId,
          tenantId: conexao.tenantId,
          profissionalId: conexao.profissionalId,
          expiraEm,
          token
        })
      );
    });
  }
}
