import 'dotenv/config';
import 'reflect-metadata';
import { validarAlvoStagingE2E } from './alvo-staging-e2e';

const TENANTS = [
  { id: '23100000-0000-4000-8000-000000000001', slug: 'octaclin-e2e-alfa' },
  { id: '23100000-0000-4000-8000-000000000002', slug: 'octaclin-e2e-beta' }
] as const;

function identificadorSql(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

async function executar() {
  const runtimeUrl = process.env.E2E_DATABASE_URL;
  const alvo = validarAlvoStagingE2E(
    runtimeUrl,
    process.env.E2E_CONFIRMAR_BANCO,
    process.env.E2E_CONFIRMAR_REMOTO === 'SIM'
  );
  process.env.DATABASE_URL = runtimeUrl;
  process.env.BANCO_EXECUTAR_MIGRACOES = 'false';
  const [{ fonteDados }, { ExecutorTenant }] = await Promise.all([
    import('../banco-dados/fonte-dados'),
    import('../banco-dados/executor-tenant')
  ]);

  try {
    await fonteDados.initialize();
    const papel = (await fonteDados.query(
      'select current_user as usuario, rolsuper, rolbypassrls from pg_roles where rolname = current_user'
    )) as Array<{ usuario: string; rolsuper: boolean; rolbypassrls: boolean }>;
    if (!papel[0]?.usuario || papel[0].rolsuper || papel[0].rolbypassrls) {
      throw new Error('Role runtime E2E nao pode ter SUPERUSER nem BYPASSRLS.');
    }

    const tabelas = (await fonteDados.query(`
      select c.relname as tabela, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
       where n.nspname = 'public'
         and c.relkind = 'r'
         and a.attname = 'tenant_id'
         and not a.attisdropped
       order by c.relname
    `)) as Array<{ tabela: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>;
    if (!tabelas.length || tabelas.some((tabela) => !tabela.relrowsecurity || !tabela.relforcerowsecurity)) {
      const invalidas = tabelas.filter((tabela) => !tabela.relrowsecurity || !tabela.relforcerowsecurity).map((item) => item.tabela);
      throw new Error(`Canario RLS falhou: tabelas sem ENABLE/FORCE: ${invalidas.join(', ') || 'nenhuma tabela encontrada'}.`);
    }

    for (const tabela of tabelas) {
      const linhas = (await fonteDados.query(`select count(*)::int as total from ${identificadorSql(tabela.tabela)}`)) as Array<{
        total: number | string;
      }>;
      if (Number(linhas[0]?.total) !== 0) {
        throw new Error(`Canario RLS falhou: ${tabela.tabela} ficou visivel sem contexto de tenant.`);
      }
    }

    const tenantsExistentes = (await fonteDados.query(
      'select id, slug from tenants where id = any($1::uuid[]) order by slug',
      [TENANTS.map((tenant) => tenant.id)]
    )) as Array<{ id: string; slug: string }>;
    if (tenantsExistentes.length !== TENANTS.length) {
      throw new Error('Os dois tenants sinteticos da Fase 231 nao foram preparados.');
    }

    const executor = new ExecutorTenant(fonteDados);
    for (const tenant of TENANTS) {
      await executor.executar(tenant.id, async (gerenciador) => {
        const contexto = (await gerenciador.query(
          "select current_setting('app.tenant_id', true) as tenant_id"
        )) as Array<{ tenant_id: string }>;
        if (contexto[0]?.tenant_id !== tenant.id) throw new Error(`Contexto RLS incorreto para ${tenant.slug}.`);

        const usuarios = (await gerenciador.query(
          'select count(*)::int as total, count(*) filter (where tenant_id <> $1)::int as cruzados from usuarios',
          [tenant.id]
        )) as Array<{ total: number | string; cruzados: number | string }>;
        if (Number(usuarios[0]?.total) < 2 || Number(usuarios[0]?.cruzados) !== 0) {
          throw new Error(`Isolamento de usuarios falhou para ${tenant.slug}.`);
        }
      });
    }

    console.log(
      JSON.stringify(
        {
          fase: 231,
          banco: alvo.banco,
          remoto: alvo.remoto,
          role: papel[0].usuario,
          roleSemBypassRls: true,
          tabelasTenantComRlsForcado: tabelas.length,
          tabelasVisiveisSemTenant: 0,
          tenantsValidados: TENANTS.map((tenant) => tenant.slug)
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
