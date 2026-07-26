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
    redis: CheckHealth;
    email: CheckHealth;
    whatsapp: CheckHealth;
    googleCalendar: CheckHealth;
  };
}

function valorDefinido(nome: string): boolean {
  return Boolean(process.env[nome]?.trim());
}

function mensagemErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Falha desconhecida.';
}

@Injectable()
export class ServicoSaude {
  constructor(
    private readonly fonteDados: DataSource,
    @Optional() @Inject(REDIS_SAUDE) private readonly redis?: ClienteRedisSaude
  ) {}

  async verificarDetalhado(): Promise<HealthDetalhado> {
    const checks = {
      backend: this.verificarBackend(),
      banco: await this.verificarBanco(),
      redis: await this.verificarRedis(),
      email: this.verificarEmail(),
      whatsapp: this.verificarWhatsapp(),
      googleCalendar: this.verificarGoogleCalendar()
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

      await this.fonteDados.query('SELECT 1');
      return { status: 'ok' };
    } catch (erro) {
      return {
        status: 'falha',
        mensagem: mensagemErro(erro)
      };
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
      valorDefinido('GOOGLE_CALENDAR_CLIENT_SECRET') &&
      valorDefinido('GOOGLE_CALENDAR_REFRESH_TOKEN');

    if (!configurado) {
      return {
        status: 'degradado',
        mensagem: 'Google Calendar incompleto; verifique client id, client secret e refresh token.'
      };
    }

    return {
      status: 'ok',
      detalhes: {
        calendarIdConfigurado: valorDefinido('GOOGLE_CALENDAR_ID')
      }
    };
  }

  private calcularStatusGeral(checks: CheckHealth[]): StatusHealth {
    if (checks.some((check) => check.status === 'falha')) return 'falha';
    if (checks.some((check) => check.status === 'degradado')) return 'degradado';
    return 'ok';
  }
}
