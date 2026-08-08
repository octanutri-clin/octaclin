import 'dotenv/config';
import { SQL_METRICAS_CONTA_CLIENTE } from '../../modulos/clientes/aplicacao/consulta-metricas-conta-cliente';

interface AlvoPerformance {
  banco: string;
  remoto: boolean;
}

interface PoolPostgres {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
}

interface ExecutorTenantPerformance {
  executar<T>(tenantId: string, operacao: (gerenciador: { query(sql: string, parametros?: unknown[]): Promise<unknown> }) => Promise<T>): Promise<T>;
}

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validarAlvoPerformance(
  databaseUrl: string | undefined,
  confirmacao: string | undefined,
  permitirRemoto: boolean
): AlvoPerformance {
  if (!databaseUrl) throw new Error('PERF_DATABASE_URL e obrigatoria. Nao reutilize DATABASE_URL.');
  const url = new URL(databaseUrl);
  const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!banco || banco !== confirmacao?.trim()) {
    throw new Error(`Banco de performance nao confirmado. Informe PERF_CONFIRMAR_BANCO=${banco || '<nome-do-banco>'}.`);
  }

  const remoto = !['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
  if (!/(^|[_-])(test|staging|integracao|integration|perf)([_-]|$)/i.test(banco)) {
    throw new Error('O banco precisa ser dedicado a teste, staging, integracao ou perf. Producao e recusada.');
  }
  if (remoto && !permitirRemoto) {
    throw new Error('Banco remoto exige CONFIRMAR_PERFORMANCE_REMOTA=SIM.');
  }

  return { banco, remoto };
}

export function calcularPercentil(amostra: number[], percentil: number): number {
  if (!amostra.length) return 0;
  const ordenada = [...amostra].sort((a, b) => a - b);
  const indice = Math.max(0, Math.ceil(percentil * ordenada.length) - 1);
  return ordenada[Math.min(indice, ordenada.length - 1)];
}

function inteiroAmbiente(nome: string, padrao: number, minimo: number, maximo: number): number {
  const valor = process.env[nome]?.trim();
  if (!valor) return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw new Error(`${nome} deve ser um inteiro entre ${minimo} e ${maximo}.`);
  }
  return numero;
}

function concorrencias(): number[] {
  const valores = (process.env.PERF_CONCORRENCIAS ?? '1,5,10')
    .split(',')
    .map((valor) => Number(valor.trim()));
  if (!valores.length || valores.some((valor) => !Number.isInteger(valor) || valor < 1 || valor > 50)) {
    throw new Error('PERF_CONCORRENCIAS deve conter inteiros entre 1 e 50 separados por virgula.');
  }
  return [...new Set(valores)];
}

function obterPool(fonteDados: { driver?: unknown }): PoolPostgres | undefined {
  return (fonteDados.driver as { master?: PoolPostgres } | undefined)?.master;
}

async function medirConcorrencia(
  executorTenant: ExecutorTenantPerformance,
  tenantId: string,
  total: number,
  concorrencia: number,
  pool?: PoolPostgres
) {
  const duracoes: number[] = [];
  let proximo = 0;
  let maiorFilaPool = pool?.waitingCount ?? 0;
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);

  const monitor = setInterval(() => {
    maiorFilaPool = Math.max(maiorFilaPool, pool?.waitingCount ?? 0);
  }, 2);

  async function trabalhador() {
    while (true) {
      const indice = proximo++;
      if (indice >= total) return;
      const inicio = performance.now();
      await executorTenant.executar(tenantId, async (gerenciador) => {
        await gerenciador.query(SQL_METRICAS_CONTA_CLIENTE, [tenantId, inicioMes]);
      });
      duracoes.push(performance.now() - inicio);
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concorrencia, total) }, () => trabalhador()));
  } finally {
    clearInterval(monitor);
  }

  return {
    concorrencia,
    requisicoes: total,
    erros: 0,
    p50Ms: Number(calcularPercentil(duracoes, 0.5).toFixed(1)),
    p95Ms: Number(calcularPercentil(duracoes, 0.95).toFixed(1)),
    p99Ms: Number(calcularPercentil(duracoes, 0.99).toFixed(1)),
    maxMs: Number(Math.max(...duracoes).toFixed(1)),
    poolFilaMax: maiorFilaPool
  };
}

async function executar() {
  const url = process.env.PERF_DATABASE_URL;
  const alvo = validarAlvoPerformance(
    url,
    process.env.PERF_CONFIRMAR_BANCO,
    process.env.CONFIRMAR_PERFORMANCE_REMOTA === 'SIM'
  );
  const tenantIdInformado = process.env.PERF_TENANT_ID?.trim() ?? '';
  const tenantSlug = process.env.PERF_TENANT_SLUG?.trim() ?? '';
  if (tenantIdInformado && !UUID_VALIDO.test(tenantIdInformado)) {
    throw new Error('PERF_TENANT_ID deve ser um UUID valido do ambiente sintetico.');
  }
  if (!tenantIdInformado && !tenantSlug) {
    throw new Error('Informe PERF_TENANT_ID ou PERF_TENANT_SLUG do ambiente sintetico.');
  }

  process.env.DATABASE_URL = url;
  process.env.BANCO_EXECUTAR_MIGRACOES = 'false';
  process.env.NODE_ENV = 'production';

  const [{ fonteDados }, { ExecutorTenant }] = await Promise.all([
    import('../banco-dados/fonte-dados'),
    import('../banco-dados/executor-tenant')
  ]);

  try {
    await fonteDados.initialize();
    const papelAtual = (await fonteDados.query(
      'select current_user as usuario, rolsuper, rolbypassrls from pg_roles where rolname = current_user'
    )) as Array<{ usuario?: string; rolsuper?: boolean; rolbypassrls?: boolean }>;
    const papel = papelAtual[0];
    if (!papel?.usuario || papel.rolsuper || papel.rolbypassrls) {
      throw new Error(
        `Role de benchmark recusada: ${papel?.usuario ?? 'desconhecida'} nao pode ter SUPERUSER nem BYPASSRLS.`
      );
    }

    const tabelaPaciente = (await fonteDados.query(
      "select relrowsecurity, relforcerowsecurity from pg_class where oid = 'pacientes'::regclass"
    )) as Array<{ relrowsecurity?: boolean; relforcerowsecurity?: boolean }>;
    if (!tabelaPaciente[0]?.relrowsecurity || !tabelaPaciente[0]?.relforcerowsecurity) {
      throw new Error('Canario RLS falhou: a tabela pacientes precisa de ENABLE e FORCE ROW LEVEL SECURITY.');
    }

    const foraContexto = (await fonteDados.query('select count(*)::int as total from pacientes')) as Array<{
      total?: number | string;
    }>;
    const pacientesVisiveisSemTenant = Number(foraContexto[0]?.total ?? Number.NaN);
    if (!Number.isInteger(pacientesVisiveisSemTenant) || pacientesVisiveisSemTenant !== 0) {
      throw new Error('Canario RLS falhou: pacientes ficaram visiveis sem contexto de tenant.');
    }

    const tenant = tenantIdInformado
      ? await fonteDados.query('select id from tenants where id = $1 and status = $2', [tenantIdInformado, 'ativo'])
      : await fonteDados.query('select id from tenants where slug = $1 and status = $2', [tenantSlug, 'ativo']);
    if (!tenant.length) throw new Error('Tenant sintetico nao encontrado ou inativo no banco confirmado.');
    const tenantId = String(tenant[0].id);
    if (!UUID_VALIDO.test(tenantId)) throw new Error('Tenant sintetico retornou identificador invalido.');

    const executor = new ExecutorTenant(fonteDados) as ExecutorTenantPerformance;
    await executor.executar(tenantId, async (gerenciador) => {
      const contexto = (await gerenciador.query("select current_setting('app.tenant_id', true) as tenant_id")) as Array<{
        tenant_id?: string;
      }>;
      if (contexto[0]?.tenant_id !== tenantId) throw new Error('Canario RLS falhou ao aplicar app.tenant_id.');
    });

    const total = inteiroAmbiente('PERF_REQUISICOES', 50, 5, 500);
    const pool = obterPool(fonteDados);
    const resultados = [];
    for (const concorrencia of concorrencias()) {
      resultados.push(await medirConcorrencia(executor, tenantId, total, concorrencia, pool));
    }

    console.log(
      JSON.stringify(
        {
          fase: 215,
          banco: alvo.banco,
          remoto: alvo.remoto,
          consulta: 'metricas_conta_cliente',
          pool: {
            max: (fonteDados.options.extra as { max?: number } | undefined)?.max,
            total: pool?.totalCount,
            ociosas: pool?.idleCount
          },
          rls: {
            role: papel.usuario,
            enable: tabelaPaciente[0].relrowsecurity,
            force: tabelaPaciente[0].relforcerowsecurity,
            pacientesVisiveisSemTenant,
            contextoTenantAplicado: true
          },
          resultados
        },
        null,
        2
      )
    );
  } finally {
    delete process.env.DATABASE_URL;
    if (fonteDados.isInitialized) await fonteDados.destroy();
  }
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
