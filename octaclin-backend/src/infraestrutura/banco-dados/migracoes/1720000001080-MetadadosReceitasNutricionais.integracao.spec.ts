import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DataSource, type MigrationInterface } from 'typeorm';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { CompartilharReceitasNutricionais1720000001066 } from './1720000001066-CompartilharReceitasNutricionais';
import { PacienteOrm } from '../../../modulos/pacientes/infraestrutura/paciente.orm';
import { CompartilhamentoReceitaNutricionalOrm } from '../../../modulos/planos-alimentares/infraestrutura/compartilhamento-receita-nutricional.orm';
import { EntregaCompartilhamentoReceitaOrm } from '../../../modulos/planos-alimentares/infraestrutura/entrega-compartilhamento-receita.orm';
import { PreferenciaCompartilhamentoReceitaOrm } from '../../../modulos/planos-alimentares/infraestrutura/preferencia-compartilhamento-receita.orm';
import { SubscriptionPushPacienteOrm } from '../../../modulos/planos-alimentares/infraestrutura/subscription-push-paciente.orm';
import { ServicoCompartilhamentoReceitas } from '../../../modulos/planos-alimentares/aplicacao/servico-compartilhamento-receitas';
import { ProcessadorCompartilhamentoReceitas } from '../../../modulos/planos-alimentares/aplicacao/processador-compartilhamento-receitas';
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
  const tenant = randomUUID(), outroTenant = randomUUID(), p1 = randomUUID(), p2 = randomUUID(), pOutro = randomUUID(), pacienteId = randomUUID(), pacienteDois = randomUUID(), pacienteUser = randomUUID(), legadoId = randomUUID();
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
    await owner.query(`create table pacientes (
      id uuid primary key,tenant_id uuid not null,usuario_id uuid,profissional_responsavel_id uuid,nome_criptografado bytea,
      contato_criptografado bytea,busca_hashes text[] not null default '{}',perfil_filtros_hashes text[],data_nascimento date,
      referencia_externa varchar(180),status_adesao varchar(40),score_risco numeric(5,2),ultimo_checkin_em timestamptz,arquivado_em timestamptz,
      status_ciclo_vida varchar(30),deletion_requested_at timestamptz,retention_reason varchar(60),retention_until timestamptz,legal_basis varchar(60),
      deleted_at timestamptz,criado_em timestamptz default now(),atualizado_em timestamptz default now(),unique(tenant_id,id));`);
    await owner.query('insert into usuarios(id,tenant_id) values($1,$2),($3,$2)', [pacienteUser, tenant, pacienteDois]);
    for (const id of [pacienteId, pacienteDois]) await owner.query('insert into pacientes(id,tenant_id,usuario_id,profissional_responsavel_id,nome_criptografado,contato_criptografado) values($1,$2,$3,$4,$5,$6)',
      [id, tenant, id === pacienteId ? pacienteUser : pacienteDois, p1, crypto.criptografar('Paciente sintético'), crypto.criptografar(JSON.stringify({ email: 'sintetico@example.invalid' }))]);
    const migrator = new DataSource({ type: 'postgres', ...conexao, username: 'owner', password: 'owner-test', entities: [], synchronize: false, logging: false });
    await migrator.initialize(); const runner = migrator.createQueryRunner(); await runner.connect();
    try {
      await new CriarReceitasNutricionais1720000001033().up(runner);
      // T04 agora ensaia a1066 real, incluindo FKs, RLS, índices e trigger imutável.
      await new CompartilharReceitasNutricionais1720000001066().up(runner);
      await runner.query('insert into receitas_nutricionais(id,tenant_id,profissional_id,criado_por_usuario_id,origem,tipo,nome_criptografado,conteudo_criptografado,total_itens) values($1,$2,$3,$3,\'pessoal\',\'receita\',$4,$5,1)', [legadoId, tenant, p1, crypto.criptografar('Legado'), legadoCipher]);
      const alvo = (criarOpcoesTypeOrm().migrations as (new () => MigrationInterface)[]).find(m => m.name === 'MetadadosReceitasNutricionais1720000001080');
      if (alvo) await new alvo().up(runner); // Ausente no RED: primeira asserção prova coluna ausente, não erro de setup.
    } finally { await runner.release(); await migrator.destroy(); }
    await owner.query(`create role food07_runtime login password 'runtime-test' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant connect on database food07_test to food07_runtime; grant usage on schema public to food07_runtime;
      grant select,insert,update,delete on all tables in schema public to food07_runtime;`);
    for (const tabela of ['profissionais', 'user_action_logs', 'pacientes']) await owner.query(`alter table ${tabela} enable row level security; alter table ${tabela} force row level security;
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
      entities: [ReceitaNutricionalOrm, ProfissionalOrm, UserActionLogOrm, AlimentoComposicaoOrm, FonteComposicaoAlimentoOrm, PacienteOrm, CompartilhamentoReceitaNutricionalOrm, EntregaCompartilhamentoReceitaOrm, PreferenciaCompartilhamentoReceitaOrm, SubscriptionPushPacienteOrm], synchronize: false, logging: false,
      extra: { max: 6, application_name: 'food07-runtime-test' } });
    await runtime.initialize(); servico = new ServicoReceitasNutricionais(new ExecutorTenant(runtime), crypto);
  }, 90000);
  afterAll(async () => { if (runtime?.isInitialized) await runtime.destroy(); await owner?.end(); await container?.stop(); }, 30000);

  const envios = () => new ServicoCompartilhamentoReceitas(new ExecutorTenant(runtime), crypto, new ServicoPorcionamentoReceita(new ExecutorTenant(runtime), servico));
  async function pedidoEnvio(ids: string[], paciente = pacienteId, chave = randomUUID()) {
    const versoesEsperadas = [], porcionamentos = [];
    const previa = new ServicoPorcionamentoReceita(new ExecutorTenant(runtime), servico);
    for (const receitaId of ids) {
      const r = await servico.obter(tenant, receitaId, usuario());
      const p = await previa.prever(tenant, receitaId, usuario(), { versaoEsperada: r.versaoAtual, porcoesDesejadas: 1.5 });
      versoesEsperadas.push({ receitaId, versao: r.versaoAtual });
      porcionamentos.push({ receitaId, porcoesDesejadas: 1.5, fingerprintPrevia: p.fingerprint,
        confirmacaoConferenciaInstrucoes: true as const, instrucoesPersonalizadas: 'Prepare as quantidades ajustadas.' });
    }
    return { pacienteId: paciente, chaveIdempotencia: chave, receitaIds: ids, versoesEsperadas, porcionamentos, canais: ['portal'] as ('portal' | 'email')[], confirmacaoRevisaoManual: true };
  }
  async function sessoesAguardando(numero: number) {
    const ate = Date.now() + 2000;
    let n = 0;
    while (Date.now() < ate) {
      await owner.query('select pg_stat_clear_snapshot()');
      n = (await owner.query("select count(*)::int n from pg_stat_activity where application_name='food07-runtime-test' and wait_event_type='Lock'")).rows[0].n;
      if (n >= numero) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return n;
  }
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
  it('T04 snapshot porcionado cifrado/imutável, projeção e isolamento efetivos', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Envio', 'clinica')), d = await pedidoEnvio([r.id]);
    const fonteAntes = (await owner.query('select conteudo_criptografado from receitas_nutricionais where id=$1', [r.id])).rows[0].conteudo_criptografado;
    const a = await envios().compartilhar(tenant, usuario(), d);
    const row = (await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [a.itens[0].id])).rows[0];
    const snap = JSON.parse(crypto.descriptografar(row.snapshot_criptografado));
    expect(snap.conteudo.itens[0].porcaoGramas).toBe(37.5);
    expect(snap.conteudo.instrucoes).toBe('Prepare as quantidades ajustadas.');
    expect(snap.contextoCompartilhamento.hashPedidoCompartilhamento).toMatch(/^[a-f0-9]{64}$/);
    expect(row.snapshot_criptografado.toString('utf8')).not.toContain('Prepare as quantidades');
    await expect(owner.query('update compartilhamentos_receita_nutricional set snapshot_criptografado=$1 where id=$2', [crypto.criptografar('{}'), a.itens[0].id])).rejects.toThrow('imutavel');
    const paciente = { ...usuario(), usuarioId: pacienteUser, papel: 'Patient' as const };
    const publico = await envios().obterPortal(tenant, paciente, a.itens[0].id);
    expect(publico.receita).toMatchObject({ porcionamento: { porcoesDesejadas: 1.5, ingredientesAjustados: true } });
    expect(JSON.stringify(publico)).not.toMatch(/contextoCompartilhamento|hashPedido|fingerprint|originais|etiquetas/);
    expect(await new ExecutorTenant(runtime).executar(outroTenant, g => g.query('select id from compartilhamentos_receita_nutricional where id=$1', [a.itens[0].id]))).toEqual([]);
    expect((await owner.query('select conteudo_criptografado from receitas_nutricionais where id=$1', [r.id])).rows[0].conteudo_criptografado).toEqual(fonteAntes);
  });
  it('T04 duas intenções iguais sob contenção persistem um único share/entrega', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Idempotência', 'clinica')), d = await pedidoEnvio([r.id]);
    await owner.query('begin'); await owner.query('select id from pacientes where id=$1 for update', [pacienteId]);
    const ps = Promise.allSettled([envios().compartilhar(tenant, usuario(), d), envios().compartilhar(tenant, usuario(), d)]);
    try { expect(await sessoesAguardando(2)).toBe(2); }
    finally { await owner.query('commit'); }
    const rs = await ps; expect(rs.every(x => x.status === 'fulfilled')).toBe(true);
    if (rs[0].status !== 'fulfilled' || rs[1].status !== 'fulfilled') throw new Error('Intenção rejeitada');
    expect(rs[1].value).toEqual(rs[0].value);
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where tenant_id=$1 and idempotencia like $2', [tenant, d.chaveIdempotencia + ':%'])).rows[0].n).toBe(1);
    expect((await owner.query('select count(*)::int n from entregas_compartilhamento_receita where compartilhamento_id=$1', [rs[0].value.itens[0].id])).rows[0].n).toBe(1);
  });
  it('T04 lotes recíprocos de pacientes diferentes adquirem receitas em ordem global', async () => {
    const a = await servico.criar(tenant, usuario(), dados('OrdemA', 'clinica')), b = await servico.criar(tenant, usuario(), dados('OrdemB', 'clinica'));
    const da = await pedidoEnvio([a.id, b.id]), db = await pedidoEnvio([b.id, a.id], pacienteDois);
    await owner.query('begin'); await owner.query('select id from receitas_nutricionais where id=$1 for update', [[a.id, b.id].sort()[0]]);
    const ps = Promise.allSettled([envios().compartilhar(tenant, usuario(), da), envios().compartilhar(tenant, usuario(), db)]);
    try { expect(await sessoesAguardando(2)).toBe(2); }
    finally { await owner.query('commit'); }
    const rs = await ps; expect(rs.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where receita_id=any($1::uuid[])', [[a.id, b.id]])).rows[0].n).toBe(4);
  });
  it('T04 edição entre prévia e persistência rejeita conteúdo stale após o lock', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Versão', 'clinica')), d = await pedidoEnvio([r.id]);
    await owner.query('begin'); await owner.query('update receitas_nutricionais set versao_atual=2 where id=$1', [r.id]);
    const p = envios().compartilhar(tenant, usuario(), d).then(x => ({ ok: x }), erro => ({ erro }));
    try { expect(await sessoesAguardando(1)).toBe(1); }
    finally { await owner.query('commit'); }
    expect(await p).toMatchObject({ erro: { status: 409 } });
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where receita_id=$1', [r.id])).rows[0].n).toBe(0);
  });
  it('T04 transferência concorrente revalida carteira antes de criar qualquer share', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Transferência', 'clinica')), d = await pedidoEnvio([r.id]);
    await owner.query('begin'); await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2', [p2, pacienteId]);
    const p = envios().compartilhar(tenant, usuario(), d).then(x => ({ ok: x }), erro => ({ erro }));
    try { expect(await sessoesAguardando(1)).toBe(1); }
    finally { await owner.query('commit'); }
    try { expect(await p).toMatchObject({ erro: { status: 404 } }); }
    finally { await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2', [p1, pacienteId]); }
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where receita_id=$1', [r.id])).rows[0].n).toBe(0);
  });
  it('T04 revogação concorrente de canal é conferida sob lock', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Consentimento', 'clinica')), d = await pedidoEnvio([r.id]); d.canais.push('email');
    await owner.query('insert into preferencias_compartilhamento_receita(tenant_id,paciente_id,email_ativo,email_consentido_em) values($1,$2,true,now())', [tenant, pacienteId]);
    await owner.query('begin'); await owner.query('update preferencias_compartilhamento_receita set email_ativo=false where paciente_id=$1', [pacienteId]);
    const p = envios().compartilhar(tenant, usuario(), d).then(x => ({ ok: x }), erro => ({ erro }));
    try { expect(await sessoesAguardando(1)).toBe(1); }
    finally { await owner.query('commit'); }
    expect(await p).toMatchObject({ erro: { status: 403 } });
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where receita_id=$1', [r.id])).rows[0].n).toBe(0);
  });
  it('T04 falha na entrega do segundo item reverte lote e substituição do ativo anterior', async () => {
    const a = await servico.criar(tenant, usuario(), dados('RollbackA', 'clinica')), b = await servico.criar(tenant, usuario(), dados('RollbackB', 'clinica'));
    const anterior = await envios().compartilhar(tenant, usuario(), await pedidoEnvio([a.id]));
    const bytes = (await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [anterior.itens[0].id])).rows[0].snapshot_criptografado;
    const ids = [a.id, b.id].sort(), d = await pedidoEnvio(ids);
    await owner.query(`create function falha_segunda_entrega_food07() returns trigger language plpgsql as $$ begin
      if (select receita_id from compartilhamentos_receita_nutricional where id=new.compartilhamento_id)='${ids[1]}'::uuid then raise exception 'Falha sintética'; end if;
      return new; end $$;
      create trigger falha_entrega before insert on entregas_compartilhamento_receita for each row execute function falha_segunda_entrega_food07();`);
    try { await expect(envios().compartilhar(tenant, usuario(), d)).rejects.toThrow(); }
    finally { await owner.query('drop trigger falha_entrega on entregas_compartilhamento_receita; drop function falha_segunda_entrega_food07()'); }
    const rows = (await owner.query('select id,status,snapshot_criptografado from compartilhamentos_receita_nutricional where receita_id=any($1::uuid[])', [ids])).rows;
    expect(rows).toEqual([{ id: anterior.itens[0].id, status: 'ativo', snapshot_criptografado: bytes }]);
  });
  it('T04 ativação agendada usa cópia congelada e substitui a versão ativa sem recalcular biblioteca', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Agendado', 'clinica')), primeiro = await envios().compartilhar(tenant, usuario(), await pedidoEnvio([r.id]));
    const d = { ...await pedidoEnvio([r.id]), agendadoPara: new Date(Date.now() + 86400000).toISOString() };
    const novo = await envios().compartilhar(tenant, usuario(), d);
    const antes = (await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [novo.itens[0].id])).rows[0].snapshot_criptografado;
    await servico.atualizar(tenant, r.id, usuario(), { ...dados(), versaoEsperada: 1, instrucoes: 'Preparação nova da biblioteca.' });
    // Somente a data de elegibilidade da entrega da fixture simula o vencimento.
    await owner.query("update entregas_compartilhamento_receita set agendado_para=now()-interval '1 minute' where compartilhamento_id=$1", [novo.itens[0].id]);
    const entrega = (await owner.query('select id from entregas_compartilhamento_receita where compartilhamento_id=$1', [novo.itens[0].id])).rows[0].id;
    const externo = { enviar: jest.fn(async () => { throw new Error('Provider externo proibido na prova'); }) };
    const worker = new ProcessadorCompartilhamentoReceitas(runtime, new ExecutorTenant(runtime), crypto, externo as never, externo as never);
    await (worker as any).processar(tenant, entrega);
    expect((await owner.query('select status from compartilhamentos_receita_nutricional where id=$1', [primeiro.itens[0].id])).rows[0].status).toBe('substituido');
    const row = (await owner.query('select status,snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [novo.itens[0].id])).rows[0];
    expect(row.status).toBe('ativo'); expect(row.snapshot_criptografado).toEqual(antes); expect(externo.enviar).not.toHaveBeenCalled();
  });

  it('T04 retirada concorrente à transferência também revalida carteira sob lock', async () => {
    const r = await servico.criar(tenant, usuario(), dados('Retirada', 'clinica')), a = await envios().compartilhar(tenant, usuario(), await pedidoEnvio([r.id]));
    await owner.query('begin'); await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2', [p2, pacienteId]);
    const p = envios().retirar(tenant, usuario(), a.itens[0].id).then(x => ({ ok: x }), erro => ({ erro }));
    let aguardando = 0;
    try { aguardando = await sessoesAguardando(1); }
    finally { await owner.query('commit'); }
    try {
      expect(await p).toMatchObject({ erro: { status: 404 } });
      expect(aguardando).toBe(1);
      expect((await owner.query('select status from compartilhamentos_receita_nutricional where id=$1', [a.itens[0].id])).rows[0].status).toBe('ativo');
    } finally { await owner.query('update pacientes set profissional_responsavel_id=$1 where id=$2', [p1, pacienteId]); }
  });
  it('T04 composição alterada e fonte revogada invalidam a confirmação da prévia', async () => {
    const alimento = randomUUID(), fonte = randomUUID();
    await owner.query("insert into fontes_composicao_alimentos(id,codigo,versao,hash_conteudo,situacao,direito_uso_status) values($1,'SINTETICA','1',$2,'ativa','aprovado')", [fonte, 'b'.repeat(64)]);
    await owner.query("insert into alimentos_composicao(id,fonte_id,nome,base_gramas,energia_kcal,proteinas_g,carboidratos_g,lipidios_g,micronutrientes) values($1,$2,'Alimento sintético',100,100,1,20,1,'{}')", [alimento, fonte]);
    const r = await servico.criar(tenant, usuario(), { ...dados('Fonte', 'clinica'), itens: [{ alimentoComposicaoId: alimento, quantidade: 1, unidade: 'g', porcaoGramas: 100, substituicoes: [] }] });
    const d = await pedidoEnvio([r.id]);
    const valido = await envios().compartilhar(tenant, usuario(), d);
    const bytes = (await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [valido.itens[0].id])).rows[0].snapshot_criptografado;
    const novaIntencao = { ...d, chaveIdempotencia: randomUUID() };
    await owner.query('update alimentos_composicao set energia_kcal=200 where id=$1', [alimento]);
    await expect(envios().compartilhar(tenant, usuario(), novaIntencao)).rejects.toMatchObject({ status: 409 });
    const atual = await pedidoEnvio([r.id]);
    await owner.query("update fontes_composicao_alimentos set situacao='inativa' where id=$1", [fonte]);
    await expect(envios().compartilhar(tenant, usuario(), atual)).rejects.toMatchObject({ status: 409 });
    expect((await owner.query('select count(*)::int n from compartilhamentos_receita_nutricional where receita_id=$1', [r.id])).rows[0].n).toBe(1);
    expect((await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [valido.itens[0].id])).rows[0].snapshot_criptografado).toEqual(bytes);
  });

  it('T04 replay de snapshot legado real não preenche hash nem muda sua cópia', async () => {
    const r = await servico.criar(tenant, usuario(), dados('LegadoEnvio', 'clinica')), id = randomUUID(), chave = randomUUID();
    const conteudo = { itens: dados().itens, instrucoes: 'Preparação legada.' };
    const bytes = crypto.criptografar(JSON.stringify({ nome: 'Receita legada', versao: 1, conteudo }));
    await owner.query("insert into compartilhamentos_receita_nutricional(id,tenant_id,receita_id,idempotencia,paciente_id,enviado_por_usuario_id,versao_origem,snapshot_criptografado,status,enviado_em) values($1,$2,$3,$4,$5,$6,1,$7,'ativo',now())", [id, tenant, r.id, chave + ':' + r.id, pacienteId, p1, bytes]);
    await owner.query("insert into entregas_compartilhamento_receita(tenant_id,compartilhamento_id,canal,status,agendado_para,idempotencia) values($1,$2,'portal','enviado',now(),$3)", [tenant, id, 'legado:' + id]);
    const d = { pacienteId, chaveIdempotencia: chave, receitaIds: [r.id], versoesEsperadas: [{ receitaId: r.id, versao: 1 }], canais: ['portal'] as 'portal'[], confirmacaoRevisaoManual: true };
    expect((await envios().compartilhar(tenant, usuario(), d)).itens[0].id).toBe(id);
    await expect(envios().compartilhar(tenant, usuario(), await pedidoEnvio([r.id], pacienteId, chave))).rejects.toMatchObject({ status: 409 });
    const publico = await envios().obterPortal(tenant, { ...usuario(), usuarioId: pacienteUser, papel: 'Patient' }, id);
    expect(publico.receita).toEqual({ nome: 'Receita legada', versao: 1, conteudo });
    expect((await owner.query('select snapshot_criptografado from compartilhamentos_receita_nutricional where id=$1', [id])).rows[0].snapshot_criptografado).toEqual(bytes);
  });

});
