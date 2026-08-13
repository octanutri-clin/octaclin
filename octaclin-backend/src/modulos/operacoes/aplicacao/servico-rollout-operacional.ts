import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ServicoFeatureFlags } from '../../../infraestrutura/feature-flags/servico-feature-flags';
import { ServicoTelemetriaOperacional } from '../../../infraestrutura/observabilidade/servico-telemetria-operacional';
import { obterPapelProcesso } from '../../../infraestrutura/processamento/papel-processo';
import { FILA_SINCRONIZACAO_GOOGLE } from '../../agenda/aplicacao/servico-sincronizacao-google-calendar';
import { FILA_AUTOMACOES } from '../../automacoes/aplicacao/servico-automacoes';
import { FILA_NOTIFICACOES } from '../../comunicacoes/aplicacao/servico-comunicacoes';
import { ServicoSaude } from '../../saude/servico-saude';

type StatusRollout = 'ok' | 'atencao' | 'critico';

export interface MetricaFilaOperacional {
  nome: string;
  status: 'ok' | 'indisponivel';
  esperando: number;
  ativas: number;
  atrasadas: number;
  falharam: number;
  pausada: boolean;
}

export interface ResultadoRolloutOperacional {
  status: StatusRollout;
  decisaoSugerida: 'promover' | 'observar' | 'rollback';
  geradoEm: string;
  release: { commit: string; servicoId: string; ambiente: string; papelProcesso: string };
  health: { status: 'ok' | 'degradado' | 'falha'; checks: Record<string, 'ok' | 'degradado' | 'falha'> };
  telemetria: ReturnType<ServicoTelemetriaOperacional['obterSnapshot']>;
  filas: MetricaFilaOperacional[];
  flags: Awaited<ReturnType<ServicoFeatureFlags['listar']>>;
}

@Injectable()
export class ServicoRolloutOperacional {
  constructor(
    private readonly telemetria: ServicoTelemetriaOperacional,
    private readonly saude: ServicoSaude,
    private readonly featureFlags: ServicoFeatureFlags,
    @InjectQueue(FILA_NOTIFICACOES) private readonly filaNotificacoes: Queue,
    @InjectQueue(FILA_SINCRONIZACAO_GOOGLE) private readonly filaGoogle: Queue,
    @InjectQueue(FILA_AUTOMACOES) private readonly filaAutomacoes: Queue
  ) {}

  async obter(tenantId: string): Promise<ResultadoRolloutOperacional> {
    const [health, flags, filas] = await Promise.all([
      this.saude.verificarDetalhado(),
      this.featureFlags.listar(tenantId),
      Promise.all([
        this.obterFila('notificacoes', this.filaNotificacoes),
        this.obterFila('google_calendar', this.filaGoogle),
        this.obterFila('automacoes', this.filaAutomacoes)
      ])
    ]);
    const telemetria = this.telemetria.obterSnapshot();
    const status = this.calcularStatus(health.status, telemetria.http.taxaErro5xx, telemetria.http.duracaoP95Ms, filas, flags.configuracaoValida);

    return {
      status,
      decisaoSugerida: status === 'critico' ? ('rollback' as const) : status === 'atencao' ? ('observar' as const) : ('promover' as const),
      geradoEm: new Date().toISOString(),
      release: {
        commit: (process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'local').slice(0, 12),
        servicoId: process.env.RENDER_SERVICE_ID ? 'configurado' : 'nao_informado',
        ambiente: process.env.NODE_ENV ?? 'development',
        papelProcesso: obterPapelProcesso()
      },
      health: {
        status: health.status,
        checks: Object.fromEntries(Object.entries(health.checks).map(([nome, check]) => [nome, check.status]))
      },
      telemetria,
      filas,
      flags
    };
  }

  private async obterFila(nome: string, fila: Queue): Promise<MetricaFilaOperacional> {
    try {
      const [contagens, pausada] = await Promise.all([
        fila.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        fila.isPaused()
      ]);
      return {
        nome,
        status: 'ok',
        esperando: contagens.waiting ?? 0,
        ativas: contagens.active ?? 0,
        atrasadas: contagens.delayed ?? 0,
        falharam: contagens.failed ?? 0,
        pausada
      };
    } catch {
      return { nome, status: 'indisponivel', esperando: 0, ativas: 0, atrasadas: 0, falharam: 0, pausada: false };
    }
  }

  private calcularStatus(
    health: 'ok' | 'degradado' | 'falha',
    taxaErro5xx: number,
    p95Ms: number,
    filas: MetricaFilaOperacional[],
    flagsValidas: boolean
  ): StatusRollout {
    if (
      health === 'falha' ||
      taxaErro5xx >= 0.05 ||
      filas.some((fila) => fila.status === 'indisponivel' || fila.pausada)
    ) {
      return 'critico';
    }
    if (
      health === 'degradado' ||
      taxaErro5xx >= 0.01 ||
      p95Ms > 1500 ||
      filas.some((fila) => fila.falharam > 0) ||
      filas.some((fila) => fila.esperando + fila.atrasadas > 100) ||
      !flagsValidas
    ) {
      return 'atencao';
    }
    return 'ok';
  }
}
