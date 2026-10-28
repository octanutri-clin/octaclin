import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource, type MigrationInterface } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { CriarReceitasNutricionais1720000001033 } from './1720000001033-CriarReceitasNutricionais';
import { ExecutorTenant } from '../executor-tenant';
import { CriptografiaDadosSensiveis } from '../../seguranca/criptografia-dados-sensiveis';
import { UserActionLogOrm } from '../../auditoria/user-action-log.orm';
import { ProfissionalOrm } from '../../../modulos/profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../../../modulos/planos-alimentares/infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../../../modulos/planos-alimentares/infraestrutura/fonte-composicao-alimento.orm';
import { ReceitaNutricionalOrm } from '../../../modulos/planos-alimentares/infraestrutura/receita-nutricional.orm';
import { ServicoReceitasNutricionais } from '../../../modulos/planos-alimentares/aplicacao/servico-receitas-nutricionais';
import { ServicoPorcionamentoReceita } from '../../../modulos/planos-alimentares/aplicacao/servico-porcionamento-receita';
import type { UsuarioAutenticado } from '../../../modulos/auth/dominio/usuario-autenticado';

const executar = process.env.RLS_TESTCONTAINERS === 'true';
(executar ? describe : describe.skip)('FOOD07 PostgreSQL descartável — metadados/CAS/RLS', () => {
  let container: StartedTestContainer, owner: Client, runtime: DataSource, servico: ServicoReceitasNutricionais;
  const tenant = randomUUID(), outroTenant = randomUUID(), p1 = randomUUID(), p2 = randomUUID(), pOutro = randomUUID(), legadoId = randomUUID();
  const crypto = new CriptografiaDadosSensiveis();
  const legadoCipher = crypto.criptografar(JSON.stringify({ instrucoes: 'Controle legado', itens: [{ descricao: 'Alimento sintético', quantidade: 1, unidade: 'g', porcaoGramas: 100,
    nutrientesPor100g: { energiaKcal: 100, proteinasG: 1, carboidratosG: 20, gordurasG: 1 } }] }));
  const usuario = (profissionalId = p1, tenantId = tenant): UsuarioAutenticado => ({ usuarioId: profissionalId, tenantId, papel: 'Professional', emailHash: 'sintetico', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] });
  const dados = (etiqueta = 'Controle', origem: 'pessoal' | 'clinica' = 'pessoal') => ({
    nome: 'Receita sintética', origem, tipo: 'receita' as const, categoria: 'Lanche',
    itens: [{ descricao: 'Alimento sintético', quantidade: 1, unidade: 'g', porcaoGramas: 100,
      nutrientesPor100g: { energiaKcal: 100, proteinasG: 1, carboidratosG: 20, gordurasG: 1 }, substituicoes: [] }],
    metadados: { etiquetas: [etiqueta], baseQuantidades: 'receita_inteira' as const, rendimentoPorcoes: 4 }
  });
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine').withTmpFs({ '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=256m' })
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'owner-test', POSTGRES_DB: 'food07_test' })
      .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).withStartupTimeout(60000).start();
    const conexao = { host: container.getHost(), port: container.getMappedPort(5432), database: 'food07_test' };
    owner = new Client({ ...conexao, user: 'owner', password: 'owner-test' }); await owner.connect();
    await owner.query(`create table tenants(id uuid primary key);
      create table usuarios(id uuid primary key,tenant_id uuid not null references tenants(id),unique(tenant_id,id));
      create table profissionais(id uuid primary key,tenant_id uuid not null references tenants(id),usuario_id uuid not null,nome_criptografado bytea not null,registro_profissional varchar(80),especialidade varchar(120),arquivado_em timestamptz,criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),unique(tenant_id,id));
      create table user_action_logs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,usuario_id uuid,acao varchar(120) not null,recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb not null default '{}',criado_em timestamptz not null default now());`);
    await owner.query('insert into tenants(id) values($1),($2)', [tenant, outroTenant]);
    for (const [id, t] of [[p1, tenant], [p2, tenant], [pOutro, outroTenant]]) {
      await owner.query('insert into usuarios(id,tenant_id) values($1,$2)', [id, t]);
      await owner.query("insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$1,decode('00','hex'))", [id, t]);
    }
    const migrator = new DataSource({ type: 'postgres', ...conexao, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false });
    await migrator.initialize(); const runner = migrator.createQueryRunner(); await runner.connect();
    try {
      await new CriarReceitasNutricionais1720000001033().up(runner);
      // Fixture mínima dos campos legados da 1066, não alegação de executar toda a 1066.
      await runner.query('alter table receitas_nutricionais add column categoria varchar(80), add column versao_atual integer not null default 1 check(versao_atual>0)');
      await runner.query('insert into receitas_nutricionais(id,tenant_id,profissional_id,criado_por_usuario_id,origem,tipo,nome_criptografado,conteudo_criptografado,total_itens) values($1,$2,$3,$3,\'pessoal\',\'receita\',$4,$5,1)', [legadoId, tenant, p1, crypto.criptografar('Legado'), legadoCipher]);
      const alvo = (criarOpcoesTypeOrm().migrations as (new () => MigrationInterface)[]).find(m => m.name === 'MetadadosReceitasNutricionais1720000001080');
      if (alvo) await new alvo().up(runner); // Ausente no RED: primeira asserção prova coluna ausente, não erro de setup.
    } finally { await runner.release(); await migrator.destroy(); }
    await owner.query(`create role food07_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food07_test to food07_runtime; grant usage on schema public to food07_runtime;
      grant select,insert,update,delete on all tables in schema public to food07_runtime;`);
    for (const tabela of ['profissionais', 'user_action_logs']) await owner.query(`alter table ${tabela} enable row level security; alter table ${tabela} force row level security;
      create policy fixture_tenant on ${tabela} using(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) with check(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);`);
    // Catálogo global somente leitura, como a política endurecida da1030.
    // Criado DEPOIS do grant DML das tabelas tenant-aware para não ampliar privilégios.
    await owner.query(`create table fontes_composicao_alimentos (
      id uuid primary key,catalogo_id uuid,codigo varchar(80),nome varchar(180),versao varchar(80),base_codigo varchar(80),licenca text,
      url_fonte text,url_artefato text,checksum_arquivo char(64),hash_conteudo char(64),publicada_em date,capturada_em timestamptz,
      esquema_versao varchar(40),esquema_nutrientes jsonb,direito_uso_status varchar(24),direito_uso_referencia text,
      direito_uso_aprovado_em timestamptz,responsavel_aprovacao varchar(180),situacao varchar(20),importada_em timestamptz);
      create table alimentos_composicao (
      id uuid primary key,fonte_id uuid,importacao_id uuid,hash_registro char(64),codigo_origem varchar(120),nome varchar(240),preparacao varchar(180),
      base_gramas numeric(12,3),energia_kcal numeric(16,8),proteinas_g numeric(16,8),carboidratos_g numeric(16,8),lipidios_g numeric(16,8),
      fibras_g numeric(16,8),sodio_mg numeric(16,8),micronutrientes jsonb,criado_em timestamptz);
      grant select on fontes_composicao_alimentos,alimentos_composicao to food07_runtime;`);
    runtime = new DataSource({ type: 'postgres', ...conexao, username: 'food07_runtime', password: 'runtime-test',
      entities: [ReceitaNutricionalOrm, ProfissionalOrm, UserActionLogOrm, AlimentoComposicaoOrm, FonteComposicaoAlimentoOrm], synchronize: false, logging: false,
      extra: { max: 6, application_name: 'food07-runtime-test' } });
    await runtime.initialize(); servico = new ServicoReceitasNutricionais(new ExecutorTenant(runtime), crypto);
  }, 90000);
  afterAll(async () => { if (runtime?.isInitialized) await runtime.destroy(); await owner?.end(); await container?.stop(); }, 30000);

  it('schema aditivo tem coluna/default/GIN/constraints sem reescrever legado', async () => {
    const col = await owner.query("select attnotnull from pg_attribute where attrelid='receitas_nutricionais'::regclass and attname='etiquetas_hashes'");
    expect(col.rows).toEqual([{ attnotnull: true }]);
    const r = await owner.query('select etiquetas_hashes,conteudo_criptografado,versao_atual from receitas_nutricionais where id=$1', [legadoId]);
    expect(r.rows[0]).toEqual({ etiquetas_hashes: [], conteudo_criptografado: legadoCipher, versao_atual: 1 });
    expect((await owner.query("select indexdef from pg_indexes where indexname='idx_receitas_nutricionais_etiquetas'")).rows[0].indexdef).toContain('USING gin');
    await expect(owner.query('update receitas_nutricionais set etiquetas_hashes=$1 where id=$2', [Array(11).fill('x'), legadoId])).rejects.toMatchObject({ code: '23514' });
    await expect(owner.query('update receitas_nutricionais set etiquetas_hashes=array[null]::text[] where id=$1', [legadoId])).rejects.toMatchObject({ code: '23514' });
  });
  it('runtime não é owner/bypass, FORCE RLS nega ausência de tenant e DDL', async () => {
    expect((await runtime.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    expect((await owner.query("select relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) owner from pg_class where relname='receitas_nutricionais'")).rows[0])
      .toEqual({ relrowsecurity: true, relforcerowsecurity: true, owner: 'owner' });
    expect(await runtime.query('select id from receitas_nutricionais')).toEqual([]);
    await expect(runtime.query('alter table receitas_nutricionais add column proibido text')).rejects.toMatchObject({ code: '42501' });
    expect(await new ExecutorTenant(runtime).executar(outroTenant, g => g.query('select id from receitas_nutricionais'))).toEqual([]);
  });
  it('ciphertext/índice/versionamento preservam omissão e bloqueiam pessoal alheio/tenant diferente', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Café'));
    const row = (await owner.query('select * from receitas_nutricionais where id=$1', [r.id])).rows[0];
    expect(row.etiquetas_hashes).toEqual([crypto.gerarHashPerfilExato(tenant, 'tag', 'Café')]);
    expect(row.conteudo_criptografado.toString('utf8')).not.toContain('Café');
    const { metadados: _omitido, ...legado } = dados();
    await servico.atualizar(tenant, r.id, usuario(), { ...legado, versaoEsperada: 1 });
    expect((await servico.obter(tenant, r.id, usuario())).metadados?.etiquetas).toEqual(['Café']);
    await expect(servico.obter(tenant, r.id, usuario(p2))).rejects.toMatchObject({ status: 404 });
    await expect(servico.obter(outroTenant, r.id, usuario(pOutro, outroTenant))).rejects.toMatchObject({ status: 404 });
    await servico.atualizar(tenant, r.id, usuario(), { ...dados(), versaoEsperada: 2, metadados: { etiquetas: [] } });
    expect((await owner.query('select etiquetas_hashes from receitas_nutricionais where id=$1', [r.id])).rows[0].etiquetas_hashes).toEqual([]);
  });
  it('filtro opera antes de count/offset em 101+ receitas e deriva índice diferente em outro tenant', async () => {
    for (let i = 0; i < 102; i++) await servico.criar(tenant, usuario(), dados(i === 101 ? 'Exclusivo' : 'Lote', 'clinica'));
    await servico.criar(outroTenant, usuario(pOutro, outroTenant), dados('Exclusivo', 'clinica'));
    const r = await servico.consultar(tenant, usuario(p2), { etiqueta: ' exclusivo ', limite: 1, pagina: 1 });
    expect(r.total).toBe(1); expect(r.itens).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain('etiquetasHashes');
    const h1 = crypto.gerarHashPerfilExato(tenant, 'tag', 'Exclusivo'), h2 = crypto.gerarHashPerfilExato(outroTenant, 'tag', 'Exclusivo');
    expect(h1).not.toBe(h2);
    const pagina = await servico.consultar(tenant, usuario(), { etiqueta: 'Lote', limite: 25, pagina: 5 });
    expect(pagina.total).toBe(101); expect(pagina.itens).toHaveLength(1);
  });
  it('T03 prévia real não grava; revisão antiga e profissional revogado são rejeitados', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Prévia'));
    const previa = new ServicoPorcionamentoReceita(new ExecutorTenant(runtime), servico);
    const ler = async () => (await owner.query('select conteudo_criptografado,etiquetas_hashes,versao_atual from receitas_nutricionais where id=$1', [r.id])).rows[0];
    const antes = await ler();
    const logsAntes = (await owner.query('select count(*)::int n from user_action_logs')).rows[0].n;
    const p = await previa.prever(tenant, r.id, usuario(), { versaoEsperada: 1, porcoesDesejadas: 1.5 });
    expect(p.estado).toBe('calculavel');
    if (p.estado !== 'calculavel') throw new Error('Prévia não calculável');
    expect(p.itens[0].porcaoGramas).toBe(37.5);
    expect(p.totais.energiaKcal.valor).toBe(37.5);
    expect(await ler()).toEqual(antes);
    expect((await owner.query('select count(*)::int n from user_action_logs')).rows[0].n).toBe(logsAntes);
    await servico.atualizar(tenant, r.id, usuario(), { ...dados(), versaoEsperada: 1 });
    await expect(previa.prever(tenant, r.id, usuario(), { versaoEsperada: 1, porcoesDesejadas: 1.5 })).rejects.toMatchObject({ status: 409 });
    await owner.query('update profissionais set arquivado_em=now() where id=$1', [p1]);
    try {
      await expect(previa.prever(tenant, r.id, usuario(), { versaoEsperada: 2, porcoesDesejadas: 1.5 })).rejects.toMatchObject({ status: 404 });
    } finally { await owner.query('update profissionais set arquivado_em=null where id=$1', [p1]); }
  });
  it('T03 catálogo funciona com grants apenas SELECT, sem FOR SHARE ou privilégio adicional', async () => {
    const alimento = randomUUID(), fonte = randomUUID();
    await owner.query("insert into fontes_composicao_alimentos(id,codigo,versao,hash_conteudo,situacao,direito_uso_status) values($1,'SINTETICA','1',$2,'ativa','aprovado')", [fonte, 'a'.repeat(64)]);
    await owner.query("insert into alimentos_composicao(id,fonte_id,nome,base_gramas,energia_kcal,proteinas_g,carboidratos_g,lipidios_g,micronutrientes) values($1,$2,'Alimento sintético',100,100,1,20,1,'{}')", [alimento, fonte]);
    expect((await runtime.query("select has_table_privilege(current_user,'alimentos_composicao','UPDATE') permitido"))[0].permitido).toBe(false);
    await expect(runtime.query('select id from alimentos_composicao for share')).rejects.toMatchObject({ code: '42501' });
    const r = await servico.criar(tenant, usuario(), { ...dados(), itens: [{ alimentoComposicaoId: alimento, quantidade: 1, unidade: 'g', porcaoGramas: 100, substituicoes: [] }] });
    const previa = new ServicoPorcionamentoReceita(new ExecutorTenant(runtime), servico);
    await expect(previa.prever(tenant, r.id, usuario(), { versaoEsperada: 1, porcoesDesejadas: 1.5 })).resolves.toMatchObject({ estado: 'calculavel', totais: { energiaKcal: { valor: 37.5 } } });
  });
  it('duas edições realmente bloqueadas na mesma linha têm um único vencedor CAS', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Concorrência'));
    let bloqueado = true;
    await owner.query('begin'); await owner.query('select id from receitas_nutricionais where id=$1 for update', [r.id]);
    const comandos = Promise.allSettled([
      servico.atualizar(tenant, r.id, usuario(), { ...dados('Primeira'), versaoEsperada: 1 }),
      servico.atualizar(tenant, r.id, usuario(), { ...dados('Segunda'), versaoEsperada: 1 })
    ]);
    try {
      const limite = Date.now() + 2000;
      let aguardando = 0;
      while (Date.now() < limite) {
        // Estatísticas de atividade são mantidas no snapshot da transação que
        // segura o lock. Atualizar só a observação, não mexer no lock/barreira.
        await owner.query('select pg_stat_clear_snapshot()');
        aguardando = (await owner.query("select count(*)::int n from pg_stat_activity where application_name='food07-runtime-test' and wait_event_type='Lock'")).rows[0].n;
        if (aguardando >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(aguardando).toBe(2);
      await owner.query('commit'); bloqueado = false;
      const respostas = await comandos;
      expect(respostas.filter(x => x.status === 'fulfilled')).toHaveLength(1);
      expect(respostas.filter(x => x.status === 'rejected')).toHaveLength(1);
      expect((await owner.query('select versao_atual from receitas_nutricionais where id=$1', [r.id])).rows[0].versao_atual).toBe(2);
    } finally { if (bloqueado) await owner.query('rollback'); await comandos; }
  });
  it('falha posterior na auditoria faz rollback de cifra/índice/versão integralmente', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Antes'));
    const antes = (await owner.query('select conteudo_criptografado,etiquetas_hashes,versao_atual from receitas_nutricionais where id=$1', [r.id])).rows[0];
    await owner.query(`create function falha_auditoria_food07() returns trigger language plpgsql as $$ begin raise exception 'Falha sintética'; end $$;
      create trigger prova_rollback before insert on user_action_logs for each row execute function falha_auditoria_food07();`);
    try { await expect(servico.atualizar(tenant, r.id, usuario(), { ...dados('Depois'), versaoEsperada: 1 })).rejects.toThrow(); }
    finally { await owner.query('drop trigger prova_rollback on user_action_logs; drop function falha_auditoria_food07()'); }
    expect((await owner.query('select conteudo_criptografado,etiquetas_hashes,versao_atual from receitas_nutricionais where id=$1', [r.id])).rows[0]).toEqual(antes);
  });
});
