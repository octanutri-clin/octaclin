import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

/**
 * Prova de isolamento por tenant em Postgres real (PR 11 da governanca).
 *
 * Conecta como a role `octaclin_rls_prova`: sem BYPASSRLS, sem propriedade
 * das tabelas. E a unica forma de provar algo aqui -- a role dona das
 * tabelas (a mesma que roda as migrations) ignora RLS por padrao no
 * Postgres, entao o teste sempre passaria mesmo com a policy quebrada.
 *
 * So roda quando as envs RLS_PROVA_BANCO_* estao presentes (CI). Localmente,
 * sem um Postgres real de pe, o describe e pulado.
 */
const HOST = process.env.RLS_PROVA_BANCO_HOST;
const PORTA = process.env.RLS_PROVA_BANCO_PORTA;
const USUARIO = process.env.RLS_PROVA_BANCO_USUARIO;
const SENHA = process.env.RLS_PROVA_BANCO_SENHA;
const BANCO = process.env.RLS_PROVA_BANCO_NOME;

const podeRodar = Boolean(HOST && PORTA && USUARIO && SENHA && BANCO);
const descrever = podeRodar ? describe : describe.skip;

descrever('isolamento de tenant via RLS real (usuarios)', () => {
  let cliente: Client;
  let tenantA: string;
  let tenantB: string;
  let usuarioIdTenantB: string;

  async function comoTenant(tenantId: string | undefined) {
    await cliente.query("select set_config('app.tenant_id', $1, false)", [tenantId ?? '']);
  }

  beforeAll(async () => {
    cliente = new Client({
      host: HOST,
      port: Number(PORTA),
      user: USUARIO,
      password: SENHA,
      database: BANCO
    });
    await cliente.connect();

    tenantA = randomUUID();
    tenantB = randomUUID();
    await cliente.query('insert into tenants (id, nome, slug) values ($1, $2, $3), ($4, $5, $6)', [
      tenantA,
      'Prova RLS Tenant A',
      `prova-rls-a-${tenantA}`,
      tenantB,
      'Prova RLS Tenant B',
      `prova-rls-b-${tenantB}`
    ]);

    await comoTenant(tenantA);
    await cliente.query(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, 'prova-rls-hash-a', $2, 'prova-rls-senha-a', 'SuperAdmin')`,
      [tenantA, Buffer.from('a')]
    );

    await comoTenant(tenantB);
    const usuarioB = await cliente.query<{ id: string }>(
      `insert into usuarios (tenant_id, email_hash, email_criptografado, senha_hash, role)
       values ($1, 'prova-rls-hash-b', $2, 'prova-rls-senha-b', 'SuperAdmin')
       returning id`,
      [tenantB, Buffer.from('b')]
    );
    usuarioIdTenantB = usuarioB.rows[0].id;
  });

  afterAll(async () => {
    await cliente.end();
  });

  it('tenant ve somente os proprios usuarios', async () => {
    await comoTenant(tenantA);
    const resultado = await cliente.query('select tenant_id from usuarios');
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].tenant_id).toBe(tenantA);
  });

  it('tenant nao ve nem edita usuario de outro tenant, mesmo buscando por id direto', async () => {
    await comoTenant(tenantA);

    const busca = await cliente.query('select id from usuarios where id = $1', [usuarioIdTenantB]);
    expect(busca.rows).toHaveLength(0);

    const atualizacao = await cliente.query('update usuarios set ativo = false where id = $1', [usuarioIdTenantB]);
    expect(atualizacao.rowCount).toBe(0);
  });

  it('sem app.tenant_id de sessao, RLS nega tudo (fail-closed)', async () => {
    await comoTenant(undefined);
    const resultado = await cliente.query('select tenant_id from usuarios');
    expect(resultado.rows).toHaveLength(0);
  });
});
