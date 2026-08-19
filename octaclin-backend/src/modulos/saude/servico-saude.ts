import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { redisConfigurado } from '../comunicacoes/aplicacao/configuracao-redis';

export const REDIS_SAUDE = 'REDIS_SAUDE';

export interface ClienteRedisSaude {
  ping(): Promise<string>;
}

export type StatusHealth = 'ok' | 'degradado' | 'falha';

export interface CheckHealth {
  status: StatusHealth;
  mensagem?: string;
  detalhes?: Record<string, string | number | boolean>;
}

export interface HealthDetalhado {
  status: StatusHealth;
  servico: 'octaclin-backend';
  horario: string;
  uptimeSegundos: number;
  checks: {
    backend: CheckHealth;
    banco: CheckHealth;
    migracoes: CheckHealth;
    redis: CheckHealth;
    email: CheckHealth;
    whatsapp: CheckHealth;
    googleCalendar: CheckHealth;
    ia: CheckHealth;
  };
}

function valorDefinido(nome: string): boolean {
  return Boolean(process.env[nome]?.trim());
}

function mensagemErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Falha desconhecida.';
}

function timeoutHealthBancoMs(): number {
  const configurado = Number(process.env.BANCO_HEALTH_TIMEOUT_MS ?? 1500);
  return Number.isInteger(configurado) && configurado >= 10 && configurado <= 10000 ? configurado : 1500;
}

@Injectable()
export class ServicoSaude {
  constructor(
    private readonly fonteDados: DataSource,
    @Optional() @Inject(REDIS_SAUDE) private readonly redis?: ClienteRedisSaude
  ) {}

  async verificarDetalhado(): Promise<HealthDetalhado> {
    const [banco, migracoes, redis] = await Promise.all([
      this.verificarBanco(),
      this.verificarMigracoes(),
      this.verificarRedis()
    ]);
    const checks = {
      backend: this.verificarBackend(),
      banco,
      migracoes,
      redis,
      email: this.verificarEmail(),
      whatsapp: this.verificarWhatsapp(),
      googleCalendar: this.verificarGoogleCalendar(),
      ia: this.verificarIa()
    };

    return {
      status: this.calcularStatusGeral(Object.values(checks)),
      servico: 'octaclin-backend',
      horario: new Date().toISOString(),
      uptimeSegundos: Math.round(process.uptime()),
      checks
    };
  }

  private verificarBackend(): CheckHealth {
    return {
      status: 'ok',
      detalhes: {
        ambiente: process.env.NODE_ENV ?? 'development'
      }
    };
  }

  private async verificarBanco(): Promise<CheckHealth> {
    try {
      if (!this.fonteDados.isInitialized) {
        return { status: 'falha', mensagem: 'DataSource nao inicializado.' };
      }

      const inicio = performance.now();
      await this.executarComTimeout(this.fonteDados.query('SELECT 1'), timeoutHealthBancoMs());
      const latenciaMs = Math.round((performance.now() - inicio) * 10) / 10;
      return {
        status: 'ok',
        detalhes: {
          latenciaMs,
          ...this.obterMetricasPoolPostgres()
        }
      };
    } catch (erro) {
      return {
        status: 'falha',
        mensagem: mensagemErro(erro)
      };
    }
  }

  private obterMetricasPoolPostgres(): Record<string, number> {
    const opcoes = (this.fonteDados.options ?? {}) as { extra?: { max?: unknown } };
    const driver = (this.fonteDados.driver ?? {}) as unknown as {
      master?: { totalCount?: unknown; idleCount?: unknown; waitingCount?: unknown };
    };
    const metricas: Record<string, number> = {};

    if (typeof opcoes.extra?.max === 'number') metricas.poolMax = opcoes.extra.max;
    if (typeof driver.master?.totalCount === 'number') metricas.poolTotal = driver.master.totalCount;
    if (typeof driver.master?.idleCount === 'number') metricas.poolOciosas = driver.master.idleCount;
    if (typeof driver.master?.waitingCount === 'number') metricas.poolAguardando = driver.master.waitingCount;

    return metricas;
  }

  /**
   * Banco atras do codigo e falha, nao degradacao.
   *
   * Em 2026-08-06 producao estava cinco migrations atras (`1015` a `1019`): as
   * features das Fases 206 a 209 nao tinham como funcionar, entidades apontavam
   * para colunas inexistentes, e este endpoint respondia `200` o tempo todo. O
   * `SELECT 1` do check de banco passa igual com o schema errado — conexao viva
   * nao quer dizer schema certo. Sem este check a deriva so aparece quando um
   * usuario abre a tela.
   */
  private async verificarMigracoes(): Promise<CheckHealth> {
    try {
      if (!this.fonteDados.isInitialized) {
        return { status: 'falha', mensagem: 'DataSource nao inicializado.' };
      }

      const registradas = this.fonteDados.migrations.length;
      if (!(await this.executarComTimeout(this.fonteDados.showMigrations(), timeoutHealthBancoMs()))) {
        return { status: 'ok', detalhes: { registradas } };
      }

      return {
        status: 'falha',
        mensagem: 'Migrations pendentes; o schema esta atras do codigo. Rode pnpm --dir octaclin-backend migration:run.',
        detalhes: { registradas }
      };
    } catch (erro) {
      return { status: 'falha', mensagem: mensagemErro(erro) };
    }
  }

  private async verificarRedis(): Promise<CheckHealth> {
    if (!redisConfigurado()) {
      return {
        status: 'degradado',
        mensagem: 'Redis nao configurado; filas e rate limits distribuidos devem ser validados antes de producao multi-replica.'
      };
    }

    if (!this.redis) return { status: 'falha', mensagem: 'Redis indisponivel.' };

    try {
      const resposta = await this.executarComTimeout(this.redis.ping(), 1_500);
      if (resposta !== 'PONG') return { status: 'falha', mensagem: 'Redis indisponivel.' };

      return {
        status: 'ok',
        detalhes: {
          configurado: true,
          tls: process.env.REDIS_URL?.startsWith('rediss://') || process.env.REDIS_TLS === 'true'
        }
      };
    } catch {
      return { status: 'falha', mensagem: 'Redis indisponivel.' };
    }
  }

  private async executarComTimeout<T>(operacao: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operacao,
        new Promise<T>((_, rejeitar) => {
          timer = setTimeout(() => rejeitar(new Error('Tempo esgotado.')), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private verificarEmail(): CheckHealth {
    const smtpConfigurado = valorDefinido('EMAIL_SMTP_USUARIO') && valorDefinido('EMAIL_SMTP_SENHA');
    const gmailApiConfigurado =
      valorDefinido('GMAIL_CLIENT_ID') && valorDefinido('GMAIL_CLIENT_SECRET') && valorDefinido('GMAIL_REFRESH_TOKEN');

    if (!smtpConfigurado && !gmailApiConfigurado) {
      return {
        status: 'degradado',
        mensagem: 'Email nao configurado para SMTP ou Gmail API.'
      };
    }

    return {
      status: 'ok',
      detalhes: {
        provedor: gmailApiConfigurado ? 'gmail_api' : 'smtp'
      }
    };
  }

  /**
   * O servico de IA e opcional: enquanto IA_SERVICE_URL e IA_SERVICE_TOKEN nao
   * existirem, o produto entregue nao usa IA e a ausencia nao e problema. Por
   * isso o check responde 'ok' com configurado: false, em vez de degradar a
   * saude geral e deixar o monitor externo vermelho por uma integracao que
   * ninguem ligou. Meia configuracao, porem, e erro de operacao e degrada.
   *
   * O detalhe nunca inclui host nem token: quem precisa do endereco le a
   * variavel no Render, nao um endpoint publico.
   */
  private verificarIa(): CheckHealth {
    const url = valorDefinido('IA_SERVICE_URL');
    const token = valorDefinido('IA_SERVICE_TOKEN');

    if (!url && !token) {
      return { status: 'ok', detalhes: { configurado: false } };
    }

    if (!url || !token) {
      return {
        status: 'degradado',
        mensagem: 'Servico de IA incompleto; configure IA_SERVICE_URL e IA_SERVICE_TOKEN juntos.'
      };
    }

    return { status: 'ok', detalhes: { configurado: true } };
  }

  private verificarWhatsapp(): CheckHealth {
    if (!valorDefinido('META_WHATSAPP_TOKEN') || !valorDefinido('META_WHATSAPP_PHONE_NUMBER_ID')) {
      return {
        status: 'degradado',
        mensagem: 'WhatsApp Meta incompleto; verifique token e phone number id.'
      };
    }

    return {
      status: 'ok',
      detalhes: {
        apiVersion: process.env.META_WHATSAPP_API_VERSION ?? 'v21.0'
      }
    };
  }

  private verificarGoogleCalendar(): CheckHealth {
    const configurado =
      valorDefinido('GOOGLE_CALENDAR_CLIENT_ID') &&
      valorDefinido('GOOGLE_CALENDAR_CLIENT_SECRET');

    if (!configurado) {
      return {
        status: 'degradado',
        mensagem: 'Google Calendar incompleto; verifique client id e client secret.'
      };
    }

    return {
      status: 'ok',
      detalhes: {
        calendarIdConfigurado: valorDefinido('GOOGLE_CALENDAR_ID'),
        modo: valorDefinido('GOOGLE_CALENDAR_REFRESH_TOKEN') ? 'refresh_global_compativel' : 'oauth_por_profissional'
      }
    };
  }

  private calcularStatusGeral(checks: CheckHealth[]): StatusHealth {
    if (checks.some((check) => check.status === 'falha')) return 'falha';
    if (checks.some((check) => check.status === 'degradado')) return 'degradado';
    return 'ok';
  }
}
