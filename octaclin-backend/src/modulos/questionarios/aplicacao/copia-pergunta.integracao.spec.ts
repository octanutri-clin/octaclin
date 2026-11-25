import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { SessaoUsuarioOrm } from '../../auth/infraestrutura/sessao-usuario.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { ServicoQuestionarios } from './servico-questionarios';

// A suíte normal não deve inferir acesso ao banco por variáveis do ambiente.
// Somente Testcontainers cria e fornece as conexões utilizadas aqui.
const executar = process.env.QST_P05_POSTGRES === 'true' || process.env.RLS_TESTCONTAINERS === 'true';
const suite = executar ? describe : describe.skip;

suite('QST-P05 — PostgreSQL descartável, runtime e FORCE RLS', () => {
  let container: StartedTestContainer;
  let admin: Client;
  let runtime: DataSource;
  let servico: ServicoQuestionarios;
  const tenant = randomUUID(), outroTenant = randomUUID();
  const usuarioId = randomUUID(), profissionalId = randomUUID(), sessaoId = randomUUID();
  const questionarioId = randomUUID(), origemId = randomUUID(), finalId = randomUUID(), categoriaId = randomUUID();
  const opcaoId = randomUUID(), envioId = randomUUID();
  const ator: UsuarioAutenticado = { tenantId: tenant, usuarioId, papel: 'Professional', sessaoId,
    emailHash: 'hash-sintetico', permissoes: ['questionarios.gerenciar'] };
  const sut = () => servico;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'qst-test-only', POSTGRES_DB: 'qst_p05' })
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,size=256m' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2))
      .withStartupTimeout(60_000).start();
    const conexao = { host: container.getHost(), port: container.getMappedPort(5432), database: 'qst_p05' };
    admin = new Client({ ...conexao, user: 'owner', password: 'qst-test-only' });
    await admin.connect();
    // Schema sintético explícito com as colunas dos leitores/escritores tocados.
    // Não usa synchronize ou migrations externas; não é prova do histórico de migrations.
    await admin.query(`
      CREATE TABLE questionarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, profissional_id uuid NOT NULL,
        titulo varchar(180) NOT NULL, descricao text, status varchar(32) NOT NULL, versao int NOT NULL,
        criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now(), UNIQUE(tenant_id,id));
      CREATE TABLE perguntas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, questionario_id uuid NOT NULL,
        categoria_id uuid NOT NULL, tipo varchar(40) NOT NULL, enunciado text NOT NULL, peso numeric(6,2) NOT NULL,
        obrigatoria boolean NOT NULL, configuracao jsonb NOT NULL DEFAULT '{}', ordem int NOT NULL, chave_clinica varchar(120),
        visivel_biblioteca boolean NOT NULL DEFAULT false, UNIQUE(tenant_id,id),
        FOREIGN KEY(tenant_id,questionario_id) REFERENCES questionarios(tenant_id,id));
      CREATE TABLE opcoes_pergunta(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, pergunta_id uuid NOT NULL,
        rotulo varchar(180) NOT NULL, valor varchar(120) NOT NULL, imagem_url text, ordem int NOT NULL,
        FOREIGN KEY(tenant_id,pergunta_id) REFERENCES perguntas(tenant_id,id));
      CREATE TABLE usuarios(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, email_hash varchar(128) DEFAULT 'sintetico',
        email_criptografado bytea DEFAULT ''::bytea, senha_hash varchar(255) DEFAULT 'sintetico', role varchar(32) NOT NULL,
        ativo boolean NOT NULL, ultimo_login_em timestamptz, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());
      CREATE TABLE sessoes_usuario(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, usuario_id uuid NOT NULL, criado_em timestamptz DEFAULT now(),
        ultima_atividade_em timestamptz DEFAULT now(), expira_em timestamptz NOT NULL, revogado_em timestamptz, motivo_revogacao varchar(40), mfa_verificado_em timestamptz);
      CREATE TABLE profissionais(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, usuario_id uuid NOT NULL, nome_criptografado bytea DEFAULT ''::bytea,
        registro_profissional varchar(80), especialidade varchar(120), arquivado_em timestamptz, preferencias_equivalencia jsonb DEFAULT '{}',
        preferencias_equivalencia_revisao int DEFAULT 0, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());
      CREATE TABLE envios_questionario(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, questionario_id uuid, snapshot_estrutura jsonb, paciente_id uuid DEFAULT gen_random_uuid(), agendamento_id uuid,
        status varchar(40) DEFAULT 'pendente', enviado_em timestamptz, respondido_em timestamptz, revisado_em timestamptz,
        revisado_por_usuario_id uuid, expira_em timestamptz, respostas_rascunho jsonb, rascunho_atualizado_em timestamptz, rascunho_versao int DEFAULT 0);
      CREATE TABLE pacientes(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, profissional_responsavel_id uuid NOT NULL,
        arquivado_em timestamptz, status_ciclo_vida varchar(32) DEFAULT 'ACTIVE');
      CREATE TABLE respostas_checkin(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, paciente_id uuid NOT NULL,
        envio_questionario_id uuid NOT NULL, finalizado_em timestamptz, criado_em timestamptz DEFAULT now(), score_final numeric(8,2));
      CREATE TABLE resposta_valores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
        resposta_checkin_id uuid NOT NULL, pergunta_id uuid NOT NULL, valor jsonb NOT NULL, score_ponderado numeric(8,2));
      CREATE ROLE qst_runtime LOGIN PASSWORD 'runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO qst_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO qst_runtime;
    `);
    for (const tabela of ['questionarios', 'perguntas', 'opcoes_pergunta', 'usuarios', 'sessoes_usuario', 'profissionais', 'envios_questionario', 'pacientes', 'respostas_checkin', 'resposta_valores']) {
      await admin.query(`ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${tabela} FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolado ON ${tabela} USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);`);
    }
    runtime = new DataSource({ type: 'postgres', ...conexao, username: 'qst_runtime', password: 'runtime-test-only',
      synchronize: false, logging: false, extra: { max: 8, application_name: 'qst_p05_runtime', statement_timeout: 10_000 },
      entities: [QuestionarioOrm, PerguntaOrm, OpcaoPerguntaOrm, UsuarioOrm, SessaoUsuarioOrm, ProfissionalOrm, EnvioQuestionarioOrm, PacienteOrm, RespostaCheckinOrm, RespostaValorOrm] });
    await runtime.initialize();
    servico = new ServicoQuestionarios(new ExecutorTenant(runtime));
  }, 90_000);

  beforeEach(async () => {
    await admin.query('TRUNCATE opcoes_pergunta,perguntas,questionarios,usuarios,sessoes_usuario,profissionais,envios_questionario,pacientes,respostas_checkin,resposta_valores CASCADE');
    await admin.query(`INSERT INTO questionarios(id,tenant_id,profissional_id,titulo,status,versao) VALUES($1,$2,$3,'Rascunho sintético','rascunho',4)`, [questionarioId, tenant, profissionalId]);
    await admin.query(`INSERT INTO perguntas(id,tenant_id,questionario_id,categoria_id,tipo,enunciado,peso,obrigatoria,configuracao,ordem,chave_clinica,visivel_biblioteca)
      VALUES($1,$3,$4,$5,'multipla_escolha','Pergunta sintética salva',1.5,false,'{"secao":"Rotina","multipla":true}',1,'comparacao-original',true),
      ($2,$3,$4,$5,'texto_longo','Pergunta final',0,false,'{}',2,NULL,false)`, [origemId, finalId, tenant, questionarioId, categoriaId]);
    await admin.query(`INSERT INTO opcoes_pergunta(id,tenant_id,pergunta_id,rotulo,valor,ordem) VALUES($1,$2,$3,'Opção sintética','opcao',1),(gen_random_uuid(),$2,$3,'Outra sintética','outra',2)`, [opcaoId, tenant, origemId]);
    await admin.query(`INSERT INTO usuarios(id,tenant_id,role,ativo) VALUES($1,$2,'Professional',true);
    `, [usuarioId, tenant]);
    await admin.query(`INSERT INTO sessoes_usuario(id,tenant_id,usuario_id,expira_em) VALUES($1,$2,$3,now()+interval '1 hour')`, [sessaoId, tenant, usuarioId]);
    await admin.query('INSERT INTO profissionais(id,tenant_id,usuario_id) VALUES($1,$2,$3)', [profissionalId, tenant, usuarioId]);
    await admin.query(`INSERT INTO envios_questionario(id,tenant_id,questionario_id,snapshot_estrutura) VALUES($1,$2,$3,'{"versaoQuestionario":1,"titulo":"Versão histórica","perguntas":[]}')`, [envioId, tenant, questionarioId]);
  });

  afterAll(async () => {
    if (runtime?.isInitialized) await runtime.destroy();
    await admin?.end();
    await container?.stop();
  }, 30_000);

  const previa = () => sut().prepararCopiaPergunta(tenant, questionarioId, origemId, ator);
  const confirmar = (revisao: string, usuario = ator) => sut().duplicarPergunta(tenant, questionarioId, origemId, revisao, usuario);
  const estado = async () => (await admin.query(`SELECT id,enunciado,ordem,chave_clinica,visivel_biblioteca FROM perguntas ORDER BY ordem,id`)).rows;

  it('prepara sem escrever e copia com identidades novas, flags seguras e histórico intacto', async () => {
    const antes = await estado();
    const historico = (await admin.query('SELECT * FROM envios_questionario')).rows;
    const p = await previa();
    expect(p.revisao).toMatch(/^[a-f0-9]{64}$/);
    expect(p.definicao).not.toHaveProperty('chaveClinica');
    expect(p.definicao).not.toHaveProperty('tenantId');
    expect(await estado()).toEqual(antes);
    const resultado = await confirmar(p.revisao);
    const depois = await estado();
    expect(depois.map((x: any) => x.id)).toEqual([origemId, resultado.perguntaId, finalId]);
    expect(depois[1]).toMatchObject({ ordem: 2, chave_clinica: null, visivel_biblioteca: false, enunciado: 'Pergunta sintética salva' });
    const opcoes = (await admin.query('SELECT * FROM opcoes_pergunta WHERE pergunta_id=$1 ORDER BY ordem,id', [resultado.perguntaId])).rows;
    expect(opcoes).toHaveLength(2);
    expect(opcoes[0].id).not.toBe(opcaoId);
    expect(opcoes[0]).toMatchObject({ rotulo: 'Opção sintética', valor: 'opcao', ordem: 1 });
    expect(resultado).toEqual({ perguntaId: expect.any(String), versaoQuestionario: 5 });
    expect((await admin.query('SELECT versao FROM questionarios')).rows[0].versao).toBe(5);
    expect((await admin.query('SELECT * FROM envios_questionario')).rows).toEqual(historico);
  });

  it('duas confirmações simultâneas e reenvio produzem uma cópia e conflitos, nunca duplicatas', async () => {
    const p = await previa();
    const trava = runtime.createQueryRunner();
    await trava.connect(); await trava.startTransaction();
    let pendentes: Promise<PromiseSettledResult<unknown>[]> | undefined;
    let resultados: PromiseSettledResult<unknown>[];
    try {
      await trava.query("SELECT set_config('app.tenant_id',$1,true)", [tenant]);
      await trava.query('SELECT id FROM questionarios WHERE id=$1 FOR UPDATE', [questionarioId]);
      pendentes = Promise.allSettled([confirmar(p.revisao), confirmar(p.revisao)]);
      await aguardarBloqueados(2);
      await trava.commitTransaction();
      resultados = await pendentes;
    } finally {
      if (trava.isTransactionActive) await trava.rollbackTransaction();
      await trava.release(); await pendentes;
    }
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    await expect(confirmar(p.revisao)).rejects.toThrow(ConflictException);
    expect(await estado()).toHaveLength(3);
  });

  it.each(['enunciado', 'configuracao', 'ordem', 'opcao'])('rejeita prévia obsoleta após mudança de %s', async (campo) => {
    const p = await previa();
    if (campo === 'opcao') await admin.query("UPDATE opcoes_pergunta SET rotulo='Alterada' WHERE id=$1", [opcaoId]);
    else if (campo === 'enunciado') await admin.query("UPDATE perguntas SET enunciado='Alterada' WHERE id=$1", [origemId]);
    else if (campo === 'configuracao') await admin.query(`UPDATE perguntas SET configuracao='{"secao":"Outra"}' WHERE id=$1`, [origemId]);
    else await admin.query('UPDATE perguntas SET ordem=7 WHERE id=$1', [origemId]);
    await expect(confirmar(p.revisao)).rejects.toThrow(ConflictException);
    expect(await estado()).toHaveLength(2);
  });

  it('reordenação seguida de restauração invalida a revisão antiga (ABA)', async () => {
    const p = await previa();
    await servico.reordenarPerguntas(tenant, questionarioId, { perguntas: [{ id: origemId, ordem: 2 }, { id: finalId, ordem: 1 }] }, ator);
    await servico.reordenarPerguntas(tenant, questionarioId, { perguntas: [{ id: origemId, ordem: 1 }, { id: finalId, ordem: 2 }] }, ator);
    await expect(confirmar(p.revisao)).rejects.toThrow(ConflictException);
  });

  it.each(['publicado', 'arquivado'])('recusa cópia se o rascunho virou %s', async (status) => {
    const p = await previa();
    await servico.atualizarQuestionario(tenant, questionarioId, { status: status as 'publicado' | 'arquivado' }, ator);
    await expect(confirmar(p.revisao)).rejects.toThrow(ConflictException);
    expect(await estado()).toHaveLength(2);
  });

  it('nega tenant/origem inexistente, profissional alheio e permissão removida', async () => {
    await expect(sut().prepararCopiaPergunta(outroTenant, questionarioId, origemId, ator)).rejects.toThrow(ForbiddenException);
    await expect(sut().prepararCopiaPergunta(outroTenant, questionarioId, origemId, { ...ator, tenantId: outroTenant })).rejects.toThrow(NotFoundException);
    await expect(sut().prepararCopiaPergunta(tenant, questionarioId, randomUUID(), ator)).rejects.toThrow(NotFoundException);
    await expect(sut().prepararCopiaPergunta(tenant, questionarioId, origemId, { ...ator, permissoes: [] })).rejects.toThrow(ForbiddenException);
    await admin.query('UPDATE questionarios SET profissional_id=$1 WHERE id=$2', [randomUUID(), questionarioId]);
    await expect(previa()).rejects.toThrow(NotFoundException);
  });

  it.each(['', 'g'.repeat(64), '0'.repeat(65)])('rejeita revisão malformada antes de escrever', async (revisao) => {
    await expect(confirmar(revisao)).rejects.toThrow(BadRequestException);
    expect(await estado()).toHaveLength(2);
  });

  it('falha intermediária ao salvar opções causa rollback de cópia, ordem e versão', async () => {
    const p = await previa();
    const antes = await estado();
    await admin.query(`CREATE FUNCTION negar_copia_opcao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.id <> '${opcaoId}'::uuid THEN RAISE EXCEPTION 'falha sintetica'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER falha_opcao BEFORE INSERT ON opcoes_pergunta FOR EACH ROW EXECUTE FUNCTION negar_copia_opcao();`);
    try { await expect(confirmar(p.revisao)).rejects.toThrow(); }
    finally { await admin.query('DROP TRIGGER falha_opcao ON opcoes_pergunta; DROP FUNCTION negar_copia_opcao()'); }
    expect(await estado()).toEqual(antes);
    expect((await admin.query('SELECT versao FROM questionarios')).rows[0].versao).toBe(4);
    expect((await admin.query('SELECT count(*)::int AS n FROM opcoes_pergunta')).rows[0].n).toBe(2);
  });
  async function aguardarBloqueados(quantidade: number) {
    const limite = Date.now() + 3000;
    while (Date.now() < limite) {
      const resultado = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='qst_p05_runtime' AND wait_event_type='Lock'");
      if (resultado.rows[0].n >= quantidade) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Não foram observadas ${quantidade} operações bloqueadas no PostgreSQL`);
  }

  it.each(['sessao', 'usuario', 'papel', 'profissional'])('reautoriza %s depois de esperar o pai', async (recurso) => {
    const p = await previa();
    const trava = runtime.createQueryRunner();
    await trava.connect(); await trava.startTransaction();
    let resultado: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await trava.query("SELECT set_config('app.tenant_id',$1,true)", [tenant]);
      await trava.query('SELECT id FROM questionarios WHERE id=$1 FOR UPDATE', [questionarioId]);
      resultado = Promise.allSettled([confirmar(p.revisao)]);
      await aguardarBloqueados(1);
      if (recurso === 'sessao') await admin.query('UPDATE sessoes_usuario SET revogado_em=now() WHERE id=$1', [sessaoId]);
      else if (recurso === 'usuario') await admin.query('UPDATE usuarios SET ativo=false WHERE id=$1', [usuarioId]);
      else if (recurso === 'papel') await admin.query("UPDATE usuarios SET role='Patient' WHERE id=$1", [usuarioId]);
      else await admin.query('UPDATE profissionais SET arquivado_em=now() WHERE id=$1', [profissionalId]);
      await trava.commitTransaction();
      const [r] = await resultado;
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(recurso === 'profissional' ? NotFoundException : UnauthorizedException);
    } finally {
      if (trava.isTransactionActive) await trava.rollbackTransaction();
      await trava.release(); await resultado;
    }
    expect(await estado()).toHaveLength(2);
  });

  it('não aceita sessão que expirou durante a espera pelo lock da própria sessão', async () => {
    const p = await previa();
    await admin.query('BEGIN');
    let resultado: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await admin.query("UPDATE sessoes_usuario SET expira_em=clock_timestamp()+interval '500 milliseconds' WHERE id=$1", [sessaoId]);
      resultado = Promise.allSettled([confirmar(p.revisao)]);
      await aguardarBloqueados(1);
      const limite = Date.now() + 3000;
      while (Date.now() < limite) {
        const expirou = await admin.query('SELECT clock_timestamp() >= expira_em AS sim FROM sessoes_usuario WHERE id=$1', [sessaoId]);
        if (expirou.rows[0].sim) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await admin.query('COMMIT');
      const [r] = await resultado;
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    } finally { await admin.query('ROLLBACK'); await resultado; }
    expect(await estado()).toHaveLength(2);
  });

  it('papel runtime e FORCE RLS não permitem ler ou inserir em outro tenant', async () => {
    expect((await runtime.query('SELECT current_user AS papel')).pop().papel).toBe('qst_runtime');
    const flags = await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='perguntas'");
    expect(flags.rows).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
    await new ExecutorTenant(runtime).executar(outroTenant, async (g) => {
      expect(await g.getRepository(PerguntaOrm).count()).toBe(0);
      await expect(g.query("INSERT INTO questionarios(tenant_id,profissional_id,titulo,status,versao) VALUES($1,$2,'Invalido','rascunho',1)", [tenant, profissionalId])).rejects.toThrow(/row-level security/);
    });
  });

  it('a revisão não muda por ordem de chaves JSON e não pode ser usada em outra sessão ou origem', async () => {
    const p = await previa();
    await admin.query(`UPDATE perguntas SET configuracao='{"multipla":true,"secao":"Rotina"}' WHERE id=$1`, [origemId]);
    expect((await previa()).revisao).toBe(p.revisao);
    await expect(sut().duplicarPergunta(tenant, questionarioId, finalId, p.revisao, ator)).rejects.toThrow(ConflictException);
    const outraSessao = randomUUID();
    await admin.query("INSERT INTO sessoes_usuario(id,tenant_id,usuario_id,expira_em) VALUES($1,$2,$3,now()+interval '1 hour')", [outraSessao, tenant, usuarioId]);
    await expect(confirmar(p.revisao, { ...ator, sessaoId: outraSessao })).rejects.toThrow(ConflictException);
  });

  it('falha após renumerar e antes de gravar versão reverte todas as gravações', async () => {
    const p = await previa(), antes = await estado();
    await admin.query(`CREATE FUNCTION falhar_versao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha sintetica versao'; END $$;
      CREATE TRIGGER falha_versao BEFORE UPDATE ON questionarios FOR EACH ROW EXECUTE FUNCTION falhar_versao();`);
    try { await expect(confirmar(p.revisao)).rejects.toThrow(); }
    finally { await admin.query('DROP TRIGGER falha_versao ON questionarios; DROP FUNCTION falhar_versao()'); }
    expect(await estado()).toEqual(antes);
    expect((await admin.query('SELECT count(*)::int AS n FROM opcoes_pergunta')).rows[0].n).toBe(2);
    expect((await admin.query('SELECT versao FROM questionarios')).rows[0].versao).toBe(4);
  });

  it('recusa copiar estrutura com envios legados sem snapshot, sem regravar os envios', async () => {
    await admin.query('UPDATE envios_questionario SET snapshot_estrutura=NULL WHERE id=$1', [envioId]);
    await expect(previa()).rejects.toThrow(ConflictException);
    expect((await admin.query('SELECT snapshot_estrutura FROM envios_questionario')).rows[0].snapshot_estrutura).toBeNull();
    expect(await estado()).toHaveLength(2);
  });

  it.each(['biblioteca', 'fallback-rascunho'])('leitor %s espera edição de opções e recebe uma definição coerente', async (leitor) => {
    if (leitor === 'fallback-rascunho') await admin.query('UPDATE envios_questionario SET snapshot_estrutura=NULL WHERE id=$1', [envioId]);
    await admin.query(`CREATE FUNCTION pausar_opcao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM pg_advisory_xact_lock(20261121,571); RETURN NEW; END $$;
      CREATE TRIGGER pausa_opcao BEFORE INSERT ON opcoes_pergunta FOR EACH ROW EXECUTE FUNCTION pausar_opcao();`);
    await admin.query('SELECT pg_advisory_lock(20261121,571)');
    let escrita: Promise<PromiseSettledResult<unknown>[]> | undefined;
    let leitura: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      escrita = Promise.allSettled([servico.atualizarPergunta(tenant, questionarioId, origemId, {
        enunciado: 'Texto novo confirmado', opcoes: [{ rotulo: 'Nova A', valor: 'nova-a' }, { rotulo: 'Nova B', valor: 'nova-b' }]
      }, ator)]);
      await aguardarBloqueados(1);
      const token = servico.gerarTokenFormularioPaciente(tenant, envioId);
      leitura = Promise.allSettled([leitor === 'biblioteca'
        ? servico.listarBibliotecaPerguntas(tenant)
        : servico.salvarRascunhoFormularioPaciente(token, { versaoBase: 0, respostas: [] })]);
      await aguardarBloqueados(2);
      await admin.query('SELECT pg_advisory_unlock(20261121,571)');
      const [gravacao] = await escrita, [consulta] = await leitura;
      expect(gravacao.status).toBe('fulfilled');
      expect(consulta.status).toBe('fulfilled');
      if (leitor === 'biblioteca') {
        const perguntas = (consulta as PromiseFulfilledResult<any[]>).value;
        expect(perguntas[0]).toMatchObject({ enunciado: 'Texto novo confirmado' });
        expect(perguntas[0].opcoes.map((o: any) => o.valor)).toEqual(['nova-a', 'nova-b']);
      } else expect((consulta as PromiseFulfilledResult<any>).value.rascunhoVersao).toBe(1);
    } finally {
      await admin.query('SELECT pg_advisory_unlock(20261121,571)');
      await escrita; await leitura;
      await admin.query('DROP TRIGGER pausa_opcao ON opcoes_pergunta; DROP FUNCTION pausar_opcao()');
    }
  });

  it.each([null, {}, [], { perguntas: null }])('não presume que snapshot JSON incompleto congele as perguntas: %j', async (snapshot) => {
    await admin.query('UPDATE envios_questionario SET snapshot_estrutura=$1::jsonb WHERE id=$2', [JSON.stringify(snapshot), envioId]);
    await expect(previa()).rejects.toThrow(ConflictException);
    expect((await admin.query('SELECT snapshot_estrutura FROM envios_questionario')).rows[0].snapshot_estrutura).toEqual(snapshot);
    expect(await estado()).toHaveLength(2);
  });

  it('não devolve preparação expirada enquanto esperava pelo perfil', async () => {
    await admin.query("UPDATE sessoes_usuario SET expira_em=clock_timestamp()+interval '500 milliseconds' WHERE id=$1", [sessaoId]);
    await admin.query('BEGIN');
    let resultado: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await admin.query('SELECT id FROM profissionais WHERE id=$1 FOR UPDATE', [profissionalId]);
      resultado = Promise.allSettled([previa()]);
      await aguardarBloqueados(1);
      const limite = Date.now() + 3000;
      while (Date.now() < limite) {
        const expirou = await admin.query('SELECT clock_timestamp() >= expira_em AS sim FROM sessoes_usuario WHERE id=$1', [sessaoId]);
        if (expirou.rows[0].sim) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await admin.query('COMMIT');
      const [r] = await resultado;
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
    } finally { await admin.query('ROLLBACK'); await resultado; }
  });

  it('cópias recíprocas da biblioteca usam ordem global mesmo com UUIDs em caixa diferente', async () => {
    const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const pa = randomUUID(), pb = randomUUID();
    await admin.query(`INSERT INTO questionarios(id,tenant_id,profissional_id,titulo,status,versao)
      VALUES($1,$3,$4,'A','rascunho',1),($2,$3,$4,'B','rascunho',1)`, [a, b, tenant, profissionalId]);
    await admin.query(`INSERT INTO perguntas(id,tenant_id,questionario_id,categoria_id,tipo,enunciado,peso,obrigatoria,configuracao,ordem,visivel_biblioteca)
      VALUES($1,$3,$4,$6,'texto_longo','A',1,false,'{}',1,true),($2,$3,$5,$6,'texto_longo','B',1,false,'{}',1,true)`, [pa, pb, tenant, a, b, categoriaId]);
    const trava = runtime.createQueryRunner();
    await trava.connect(); await trava.startTransaction();
    let pendentes: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await trava.query("SELECT set_config('app.tenant_id',$1,true)", [tenant]);
      await trava.query('SELECT id FROM questionarios WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[a, b]]);
      pendentes = Promise.allSettled([
        servico.incluirPerguntaBiblioteca(tenant, pa, b.toUpperCase(), ator),
        servico.incluirPerguntaBiblioteca(tenant, pb, a.toUpperCase(), ator)
      ]);
      await aguardarBloqueados(2);
      await trava.commitTransaction();
      const resultados = await pendentes;
      expect(resultados.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason.code)).toEqual([]);
      expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    } finally {
      if (trava.isTransactionActive) await trava.rollbackTransaction();
      await trava.release(); await pendentes;
    }
    expect((await admin.query('SELECT count(*)::int AS n FROM perguntas WHERE questionario_id=$1', [a])).rows[0].n).toBe(2);
    expect((await admin.query('SELECT count(*)::int AS n FROM perguntas WHERE questionario_id=$1', [b])).rows[0].n).toBe(2);
  });

  it('QST10-06 prévia preserva banco/snapshot com runtime FORCE RLS e reautoriza propriedade', async () => {
    const antes = (await admin.query('SELECT * FROM perguntas ORDER BY id')).rows;
    const enviosAntes = (await admin.query('SELECT * FROM envios_questionario ORDER BY id')).rows;
    const qAntes = (await admin.query('SELECT * FROM questionarios ORDER BY id')).rows;
    const entrada = { versaoEsperada: 4, titulo: 'Título local', perguntas: [{ id: origemId, dados: { tipo: 'metrica' as const, configuracao: { minimo: 10, maximo: 1 } } }] };
    expect(await sut().validarPreviaEditor(tenant, questionarioId, entrada, ator)).toEqual({ versao: 4, problemas: [{ perguntaId: origemId, campo: 'configuracao', codigo: 'configuracao_invalida' }] });
    expect((await admin.query('SELECT * FROM perguntas ORDER BY id')).rows).toEqual(antes);
    expect((await admin.query('SELECT * FROM envios_questionario ORDER BY id')).rows).toEqual(enviosAntes);
    expect((await admin.query('SELECT * FROM questionarios ORDER BY id')).rows).toEqual(qAntes);
    expect(await sut().obterVersaoEditor(tenant, questionarioId, ator)).toEqual({ versao: 4 });
    await expect(sut().validarPreviaEditor(outroTenant, questionarioId, entrada, { ...ator, tenantId: outroTenant })).rejects.toBeInstanceOf(NotFoundException);
    await expect(sut().validarPreviaEditor(tenant, questionarioId, { ...entrada, perguntas: [{ id: randomUUID(), dados: {} }] }, ator)).rejects.toBeInstanceOf(BadRequestException);
    await admin.query('UPDATE questionarios SET profissional_id=$1 WHERE id=$2', [randomUUID(), questionarioId]);
    await expect(sut().validarPreviaEditor(tenant, questionarioId, entrada, ator)).rejects.toBeInstanceOf(NotFoundException);
    await expect(sut().obterVersaoEditor(tenant, questionarioId, ator)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('QST10-06 espera escritor concorrente e rejeita versão stale após commit sem aplicar prévia', async () => {
    const trava = runtime.createQueryRunner(); await trava.connect(); await trava.startTransaction();
    let pendente: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await trava.query("SELECT set_config('app.tenant_id',$1,true)",[tenant]);
      await trava.query('UPDATE questionarios SET versao=versao+1 WHERE id=$1',[questionarioId]);
      pendente = Promise.allSettled([sut().validarPreviaEditor(tenant, questionarioId, { versaoEsperada: 4, titulo: 'Local', perguntas: [] }, ator)]);
      await aguardarBloqueados(1); await trava.commitTransaction();
      const [resultado] = await pendente;
      expect(resultado.status).toBe('rejected');
      if (resultado.status === 'rejected') expect(resultado.reason).toBeInstanceOf(ConflictException);
      expect((await admin.query('SELECT versao FROM questionarios WHERE id=$1',[questionarioId])).rows[0].versao).toBe(5);
    } finally { if(trava.isTransactionActive)await trava.rollbackTransaction();await trava.release();await pendente; }
  });

  async function prepararRetornoHistorico(semSnapshot = false) {
    const paciente = randomUUID(), resposta = randomUUID();
    const snapshot = { versaoQuestionario: 1, titulo: 'Histórico sintético', perguntas: [
      { id: origemId, tipo: 'metrica', obrigatoria: true, configuracao: { minimo: 0, maximo: 10 }, opcoes: [] },
      { id: finalId, tipo: 'sim_nao', obrigatoria: true, configuracao: {}, opcoes: [] }
    ] };
    await admin.query('INSERT INTO pacientes(id,tenant_id,profissional_responsavel_id) VALUES($1,$2,$3)', [paciente, tenant, profissionalId]);
    await admin.query("UPDATE envios_questionario SET paciente_id=$1,status='respondido',snapshot_estrutura=$2::jsonb WHERE id=$3", [paciente, semSnapshot ? null : JSON.stringify(snapshot), envioId]);
    await admin.query('INSERT INTO respostas_checkin(id,tenant_id,paciente_id,envio_questionario_id,finalizado_em) VALUES($1,$2,$3,$4,now())',[resposta,tenant,paciente,envioId]);
    await admin.query("INSERT INTO resposta_valores(tenant_id,resposta_checkin_id,pergunta_id,valor) VALUES($1,$2,$3,'0'),($1,$2,$4,'false')",[tenant,resposta,origemId,finalId]);
    return { paciente, resposta };
  }

  it('QST10-07 usa snapshot sem gravar, preserva zero/falso e reautoriza carteira sob RLS', async () => {
    const { paciente, resposta } = await prepararRetornoHistorico();
    const antes = (await admin.query('SELECT * FROM envios_questionario WHERE id=$1',[envioId])).rows;
    await admin.query('UPDATE questionarios SET versao=99 WHERE id=$1',[questionarioId]);
    await admin.query("UPDATE perguntas SET enunciado='Definição atual alterada',configuracao='{}' WHERE questionario_id=$1",[questionarioId]);
    expect(await sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)).toEqual({respostaId:resposta,envioId,completude:{estado:'disponivel',versaoQuestionario:1,totalPerguntas:2,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2}});
    expect((await admin.query('SELECT * FROM envios_questionario WHERE id=$1',[envioId])).rows).toEqual(antes);
    await expect(sut().obterCompletudeHistorica(outroTenant,questionarioId,resposta,{...ator,tenantId:outroTenant})).rejects.toBeInstanceOf(NotFoundException);
    await admin.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[randomUUID(),paciente]);
    await expect(sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)).rejects.toBeInstanceOf(NotFoundException);
    expect((await admin.query('SELECT * FROM envios_questionario WHERE id=$1',[envioId])).rows).toEqual(antes);
  });

  it('QST10-07 legado sem snapshot mantém denominadores nulos', async () => {
    const { resposta } = await prepararRetornoHistorico(true);
    const r = await sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator);
    expect(r.completude).toEqual({estado:'desconhecido',motivo:'snapshot_ausente',versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null});
  });

  it('QST10-07 transferência concorrente impede leitura após esperar pelo paciente', async () => {
    const { paciente, resposta } = await prepararRetornoHistorico();
    const trava = runtime.createQueryRunner(); await trava.connect(); await trava.startTransaction();
    let pendente: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await trava.query("SELECT set_config('app.tenant_id',$1,true)",[tenant]);
      await trava.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[randomUUID(),paciente]);
      pendente=Promise.allSettled([sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)]);
      await aguardarBloqueados(1); await trava.commitTransaction();
      const [r]=await pendente;expect(r.status).toBe('rejected');if(r.status==='rejected')expect(r.reason).toBeInstanceOf(NotFoundException);
    } finally { if(trava.isTransactionActive)await trava.rollbackTransaction();await trava.release();await pendente; }
  });

  it('QST10-07 presença null e fora da faixa não reinterpreta qualidade nem regrava valores', async () => {
    const { resposta } = await prepararRetornoHistorico();
    const snapshotAntes=(await admin.query('SELECT snapshot_estrutura FROM envios_questionario WHERE id=$1',[envioId])).rows;
    await admin.query("UPDATE resposta_valores SET valor='null'::jsonb WHERE resposta_checkin_id=$1 AND pergunta_id=$2",[resposta,origemId]);
    expect((await sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)).completude).toMatchObject({estado:'disponivel',totalPerguntas:2,respondidas:1,obrigatorias:2,obrigatoriasRespondidas:1});
    expect((await admin.query('SELECT valor::text AS v FROM resposta_valores WHERE resposta_checkin_id=$1 AND pergunta_id=$2',[resposta,origemId])).rows[0].v).toBe('null');
    await admin.query("UPDATE resposta_valores SET valor='11'::jsonb WHERE resposta_checkin_id=$1 AND pergunta_id=$2",[resposta,origemId]);
    expect((await sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)).completude).toMatchObject({estado:'disponivel',totalPerguntas:2,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2});
    expect((await admin.query('SELECT valor::text AS v FROM resposta_valores WHERE resposta_checkin_id=$1 AND pergunta_id=$2',[resposta,origemId])).rows[0].v).toBe('11');
    await admin.query('UPDATE respostas_checkin SET finalizado_em=NULL WHERE id=$1',[resposta]);
    expect((await sut().obterCompletudeHistorica(tenant,questionarioId,resposta,ator)).completude).toMatchObject({estado:'disponivel',totalPerguntas:2,respondidas:2});
    expect((await admin.query('SELECT finalizado_em FROM respostas_checkin WHERE id=$1',[resposta])).rows[0].finalizado_em).toBeNull();
    expect((await admin.query('SELECT snapshot_estrutura FROM envios_questionario WHERE id=$1',[envioId])).rows).toEqual(snapshotAntes);
  });

});
