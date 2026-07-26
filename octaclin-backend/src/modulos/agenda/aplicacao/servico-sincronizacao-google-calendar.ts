import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { ServicoAgenda } from './servico-agenda';
import { ServicoConexaoGoogleCalendar } from './servico-conexao-google-calendar';
import { EventoGoogleAlterado, ServicoGoogleCalendar, SyncTokenExpiradoError, TokenRevogadoError } from './servico-google-calendar';

export const FILA_SINCRONIZACAO_GOOGLE = 'sincronizacao-google-calendar';

@Injectable()
export class ServicoSincronizacaoGoogleCalendar {
  private readonly logger = new Logger(ServicoSincronizacaoGoogleCalendar.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly servicoAgenda: ServicoAgenda
  ) {}

  async processarNotificacao(canalWatchId: string): Promise<void> {
    const canal = await this.fonteDados.getRepository(GoogleCanalWatchOrm).findOne({ where: { canalWatchId } });
    if (!canal) {
      this.logger.warn(`Notificacao recebida para canal desconhecido/ja desconectado: ${canalWatchId}`);
      return;
    }

    await this.reconciliar(canal.tenantId, canal.profissionalId);
  }

  async reconciliar(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const syncToken = await this.obterSyncTokenArmazenado(tenantId, profissionalId);

    let resultado: { eventos: EventoGoogleAlterado[]; proximoSyncToken?: string };
    try {
      resultado = await this.googleCalendar.listarEventosAlterados(credenciais, syncToken);
    } catch (erro) {
      if (erro instanceof TokenRevogadoError) {
        this.logger.warn(`Refresh token revogado para profissional ${profissionalId}; desconectando integracao Google Agenda.`);
        await this.servicoConexao.desconectar(tenantId, profissionalId);
        return;
      }
      if (!(erro instanceof SyncTokenExpiradoError)) throw erro;
      this.logger.warn(`Sync token expirado para profissional ${profissionalId}; refazendo sincronizacao completa.`);
      await this.armazenarSyncToken(tenantId, profissionalId, undefined);
      resultado = await this.googleCalendar.listarEventosAlterados(credenciais, undefined);
    }

    const { eventos, proximoSyncToken } = resultado;
    let houveFalha = false;

    for (const evento of eventos) {
      try {
        await this.aplicarEvento(tenantId, profissionalId, evento);
      } catch (erro) {
        houveFalha = true;
        this.logger.warn(
          `Falha ao aplicar evento Google ${evento.id} durante reconciliacao: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`
        );
      }
    }

    if (proximoSyncToken && !houveFalha) {
      await this.armazenarSyncToken(tenantId, profissionalId, proximoSyncToken);
    }
  }

  private async obterSyncTokenArmazenado(tenantId: string, profissionalId: string): Promise<string | undefined> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conexao = await gerenciador
        .getRepository(ProfissionalGoogleConexaoOrm)
        .findOne({ where: { tenantId, profissionalId } });
      return conexao?.ultimoSyncToken;
    });
  }

  private async armazenarSyncToken(tenantId: string, profissionalId: string, syncToken: string | undefined): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.ultimoSyncToken = syncToken;
      await repositorio.save(conexao);
    });
  }

  private async aplicarEvento(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; octaclinConsultaId?: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    if (evento.octaclinConsultaId) {
      await this.aplicarEventoDeConsulta(tenantId, profissionalId, evento);
      return;
    }
    await this.aplicarBloqueioExterno(tenantId, profissionalId, evento);
  }

  private async aplicarEventoDeConsulta(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; octaclinConsultaId?: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    const consultaId = evento.octaclinConsultaId as string;
    if (evento.status === 'cancelled') {
      await this.servicoAgenda.cancelarConsultaComoSistema(
        tenantId,
        consultaId,
        { motivo: 'Cancelado direto na Google Agenda.' },
        profissionalId
      );
      return;
    }
    if (evento.inicioEm && evento.fimEm) {
      await this.servicoAgenda.remarcarConsultaComoSistema(
        tenantId,
        consultaId,
        { inicioEm: evento.inicioEm.toISOString(), fimEm: evento.fimEm.toISOString() },
        profissionalId
      );
    }
  }

  private async aplicarBloqueioExterno(
    tenantId: string,
    profissionalId: string,
    evento: { id: string; status: string; inicioEm?: Date; fimEm?: Date }
  ): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaBloqueioExternoOrm);
      const existente = await repositorio.findOne({ where: { tenantId, profissionalId, googleEventId: evento.id } });

      if (evento.status === 'cancelled' || !evento.inicioEm || !evento.fimEm) {
        if (existente) await repositorio.delete({ id: existente.id });
        return;
      }

      const dados = { tenantId, profissionalId, googleEventId: evento.id, inicioEm: evento.inicioEm, fimEm: evento.fimEm };
      await repositorio.save(existente ? { ...existente, ...dados } : repositorio.create(dados));
    });
  }
}
