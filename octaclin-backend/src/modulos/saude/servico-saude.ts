import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

/**
 * Vocabulario fechado do payload publico (PR 52, fase 2).
 *
 * Ate esta fase o `catch` dos checks de banco devolvia `erro.message` direto
 * para `GET /health/detalhado`, que **nao tem guarda nenhuma**: uma falha de
 * conexao entregava a qualquer um na internet a mensagem crua do driver
 * Postgres -- host, porta, nome do banco, usuario, versao e, num erro de
 * autenticacao, o proprio texto que o servidor devolveu. Isso e reconhecimento
 * de infraestrutura de graca, e estava listado como pendencia na secao 6 do
 * relatorio de seguranca do PR 52.
 *
 * A correcao nao e "sanitizar a mensagem": mensagem de driver e texto de
 * terceiro, e filtrar texto de terceiro por lista negra e a aposta que sempre
 * perde. O payload publico passa a sair de um vocabulario fechado escrito
 * aqui, e o unico caminho de um erro para dentro dele e o `instanceof` abaixo.
 *
 * A politica de trilha (secao 7) ja tinha decidido a mesma coisa para o log de
 * falha de auditoria pelo mesmo motivo: "a mensagem de um erro de banco carrega
 * SQL, valor de parametro e as vezes host ou credencial". Por isso nem o log
 * estruturado abaixo recebe `erro.message` -- so o nome da classe.
 */
const MENSAGEM_BANCO_INDISPONIVEL = 'Banco indisponivel.';
const MENSAGEM_MIGRACOES_INDISPONIVEL = 'Nao foi possivel verificar as migrations.';
const MENSAGEM_TEMPO_ESGOTADO = 'Tempo esgotado.';
const MENSAGEM_REDIS_INDISPONIVEL = 'Redis indisponivel.';

/**
 * Erro proprio do timeout, para que o payload publico consiga distinguir "o
 * pool nao devolveu conexao no prazo" de "o banco recusou a consulta" sem
 * precisar olhar `erro.message`.
 *
 * A distincao vale para quem opera -- as duas falhas tem causa e acao
 * diferentes -- e nao vaza nada: o texto e escrito neste arquivo, e nao pelo
 * driver.
 */
class ErroTempoEsgotado extends Error {
  constructor() {
    super(MENSAGEM_TEMPO_ESGOTADO);
    this.name = 'ErroTempoEsgotado';
  }
}

/** Nome da classe do erro. E o unico detalhe do erro que sai deste modulo, e sai so para o log. */
function nomeDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : 'ErroDesconhecido';
}

function timeoutHealthBancoMs(): number {
  const configurado = Number(process.env.BANCO_HEALTH_TIMEOUT_MS ?? 1500);
  return Number.isInteger(configurado) && configurado >= 10 && configurado <= 10000 ? configurado : 1500;
}

@Injectable()
export class ServicoSaude {
  /**
   * O detalhe da falha continua existindo -- muda de destino.
   *
   * A alternativa considerada foi expor o detalhe num endpoint autenticado
   * (`GuardaJwt` + `@Papeis('SuperAdmin')`), como o repositorio ja fez em
   * `GET /operacoes/providers` justamente por `/health/detalhado` ser publico.
   * Ela foi recusada aqui por um motivo operacional concreto: quem consome
   * `/health/detalhado` e `/health/pronto` e sonda **nao autenticada** --
   * `scripts/monitor-producao.mjs` e o workflow de E2E de staging chamam sem
   * token --, e o momento em que o detalhe importa e exatamente o momento em
   * que o banco esta fora, isto e, em que emitir um JWT provavelmente tambem
   * falha. Um detalhe que so aparece quando o sistema esta saudavel nao serve
   * para diagnosticar indisponibilidade.
   *
   * O log estruturado ja tem a audiencia certa (o coletor do provedor, que so
   * a operacao le), ja e o canal que o runbook manda consultar junto do health,
   * e nao depende do banco para funcionar. O que ele carrega e o nome da classe
   * do erro, e nao a mensagem -- mesma regra da secao 7 da politica de trilha.
   * A mensagem crua do driver continua disponivel onde ela ja estava e onde e
   * legitima: nos logs que o proprio TypeORM/pg emitem.
   */
  private readonly logger = new Logger(ServicoSaude.name);

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
      return this.reportarFalha('banco', erro, MENSAGEM_BANCO_INDISPONIVEL);
    }
  }

  /**
   * Ponto unico de saida de **erro capturado** deste modulo: registra o que a
   * operacao precisa e devolve o que o publico pode ver. Todo `catch` daqui
   * termina nesta funcao, e ter um so evita que o proximo check novo volte a
   * montar `mensagem` a partir do erro por descuido.
   *
   * O qualificador nao e enfeite. Este modulo tambem devolve `falha` em
   * condicoes que ele proprio detecta -- fonte de dados nao inicializada, PING
   * que nao responde PONG, cliente Redis ausente. Essas nao passam por aqui
   * porque nao ha erro a registrar: o texto que vai ao publico ja e a
   * informacao inteira, e nao existe detalhe sendo suprimido. O que nao pode
   * voltar a acontecer e um `catch` devolver constante e descartar o erro em
   * silencio, como o de Redis fazia ate esta correcao: o bloco da classe promete
   * que o detalhe da falha muda de destino, e destino nenhum nao e um destino.
   */
  private reportarFalha(check: string, erro: unknown, mensagem: string): CheckHealth {
    this.logger.warn({ evento: 'saude.check.falha', check, erroNome: nomeDoErro(erro) });
    return {
      status: 'falha',
      mensagem: erro instanceof ErroTempoEsgotado ? MENSAGEM_TEMPO_ESGOTADO : mensagem
    };
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
      return this.reportarFalha('migracoes', erro, MENSAGEM_MIGRACOES_INDISPONIVEL);
    }
  }

  private async verificarRedis(): Promise<CheckHealth> {
    if (!redisConfigurado()) {
      return {
        status: 'degradado',
        mensagem: 'Redis nao configurado; filas e rate limits distribuidos devem ser validados antes de producao multi-replica.'
      };
    }

    if (!this.redis) return { status: 'falha', mensagem: MENSAGEM_REDIS_INDISPONIVEL };

    try {
      const resposta = await this.executarComTimeout(this.redis.ping(), 1_500);
      if (resposta !== 'PONG') return { status: 'falha', mensagem: MENSAGEM_REDIS_INDISPONIVEL };

      return {
        status: 'ok',
        detalhes: {
          configurado: true,
          tls: process.env.REDIS_URL?.startsWith('rediss://') || process.env.REDIS_TLS === 'true'
        }
      };
    } catch (erro) {
      // Passou a sair por `reportarFalha` nesta correcao. Antes o erro do
      // cliente Redis era descartado sem log nenhum: o operador via `falha` no
      // payload publico e nao tinha onde olhar para saber se foi recusa de
      // conexao, TLS ou timeout. Como nos demais checks, so o nome da classe do
      // erro vai ao log, e o timeout passa a se distinguir no payload -- mesma
      // regra do check de banco, e nao um vocabulario proprio do Redis.
      return this.reportarFalha('redis', erro, MENSAGEM_REDIS_INDISPONIVEL);
    }
  }

  private async executarComTimeout<T>(operacao: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operacao,
        new Promise<T>((_, rejeitar) => {
          timer = setTimeout(() => rejeitar(new ErroTempoEsgotado()), timeoutMs);
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
   * isso o check nunca degrada a saude geral.
   *
   * Meia configuracao tambem nao degrada, e isso e uma decisao, nao descuido.
   * Na primeira versao ela degradava, foi para producao e derrubou o monitor
   * externo: uma das duas variaveis estava definida la, sobra de exploracao
   * anterior, e o alerta abriu incidente por uma integracao que ninguem usa.
   * Enquanto a IA do produto nao estiver escolhida, isso e ruido e nao risco.
   * A configuracao parcial fica visivel no payload, para quem for ligar a IA
   * saber que ha variavel orfa antes de configurar o par.
   *
   * Quando a IA entrar em uso de verdade, este check vira sonda real do
   * ai-service e meia configuracao volta a ser falha.
   *
   * O detalhe nunca inclui host nem token: quem precisa do endereco le a
   * variavel no Render, nao um endpoint publico.
   */
  private verificarIa(): CheckHealth {
    const url = valorDefinido('IA_SERVICE_URL');
    const token = valorDefinido('IA_SERVICE_TOKEN');

    if (url && token) {
      return { status: 'ok', detalhes: { configurado: true } };
    }

    if (url || token) {
      return {
        status: 'ok',
        mensagem: 'Servico de IA com configuracao parcial; defina IA_SERVICE_URL e IA_SERVICE_TOKEN juntos ou remova a variavel avulsa.',
        detalhes: { configurado: false, configuracaoParcial: true }
      };
    }

    return { status: 'ok', detalhes: { configurado: false } };
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
