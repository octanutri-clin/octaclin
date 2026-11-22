import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoQuestionarios } from './servico-questionarios';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('QPRO-01 — CSV filtrado em PostgreSQL runtime e FORCE RLS', () => {
  let container: StartedTestContainer, admin: Client, runtime: DataSource, sut: ServicoQuestionarios;
  const t = randomUUID(), outro = randomUUID(), u = randomUUID(), p = randomUUID(), paciente = randomUUID();
  const q = randomUUID(), envio = randomUUID(), pergunta = randomUUID(), a = randomUUID(), b = randomUUID();
  const ator: UsuarioAutenticado = { tenantId: t, usuarioId: u, papel: 'Professional', emailHash: 'sintetico', permissoes: ['questionarios.ler'] };
  beforeAll(async () => {
    container = await new GenericContainer('postgres:15-alpine')
      .withEnvironment({ POSTGRES_USER: 'owner', POSTGRES_PASSWORD: 'export-synthetic-only', POSTGRES_DB: 'exportacao' })
      .withTmpFs({ '/var/lib/postgresql/data': 'rw,size=256m' }).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i, 2)).start();
    const conexao = { host: container.getHost(), port: container.getMappedPort(5432), database: 'exportacao' };
    admin = new Client({ ...conexao, user: 'owner', password: 'export-synthetic-only' }); await admin.connect();
    // Schema sintético explícito; não representa ensaio do histórico de migrations.
    await admin.query(`
      CREATE TABLE profissionais(id uuid PRIMARY KEY,tenant_id uuid,usuario_id uuid,nome_criptografado bytea DEFAULT ''::bytea,registro_profissional text,especialidade text,arquivado_em timestamptz,preferencias_equivalencia jsonb,preferencias_equivalencia_revisao int DEFAULT 0,criado_em timestamptz,atualizado_em timestamptz);
      CREATE TABLE pacientes(id uuid PRIMARY KEY,tenant_id uuid,profissional_responsavel_id uuid,arquivado_em timestamptz);
      CREATE TABLE questionarios(id uuid PRIMARY KEY,tenant_id uuid,profissional_id uuid,titulo text,descricao text,status text,versao int,criado_em timestamptz,atualizado_em timestamptz);
      CREATE TABLE envios_questionario(id uuid PRIMARY KEY,tenant_id uuid,questionario_id uuid,paciente_id uuid,agendamento_id uuid,status text,enviado_em timestamptz,respondido_em timestamptz,revisado_em timestamptz,revisado_por_usuario_id uuid,expira_em timestamptz,snapshot_estrutura jsonb,respostas_rascunho jsonb,rascunho_atualizado_em timestamptz,rascunho_versao int DEFAULT 0);
      CREATE TABLE perguntas(id uuid PRIMARY KEY,tenant_id uuid,questionario_id uuid,categoria_id uuid,tipo text,enunciado text,peso numeric,obrigatoria bool,configuracao jsonb,ordem int,chave_clinica text,visivel_biblioteca bool);
      CREATE TABLE respostas_checkin(id uuid PRIMARY KEY,tenant_id uuid,paciente_id uuid,envio_questionario_id uuid,score_final numeric,finalizado_em timestamptz,criado_em timestamptz);
      CREATE TABLE resposta_valores(id uuid PRIMARY KEY,tenant_id uuid,resposta_checkin_id uuid,pergunta_id uuid,valor jsonb,score_ponderado numeric);
      CREATE ROLE export_runtime LOGIN PASSWORD 'runtime-synthetic-only' NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO export_runtime;
      GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO export_runtime;
    `);
    for (const table of ['profissionais','pacientes','questionarios','envios_questionario','perguntas','respostas_checkin','resposta_valores']) {
      await admin.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_scope ON ${table} USING (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
    }
    await admin.query('INSERT INTO profissionais(id,tenant_id,usuario_id) VALUES($1,$2,$3)', [p,t,u]);
    await admin.query('INSERT INTO pacientes VALUES($1,$2,$3,NULL)', [paciente,t,p]);
    await admin.query('INSERT INTO questionarios(id,tenant_id,profissional_id,titulo,status,versao) VALUES($1,$2,$3,$4,$5,1)', [q,t,p,'Sintético','publicado']);
    await admin.query('INSERT INTO envios_questionario(id,tenant_id,questionario_id,paciente_id) VALUES($1,$2,$3,$4)', [envio,t,q,paciente]);
    await admin.query('INSERT INTO perguntas(id,tenant_id,questionario_id,tipo,enunciado,configuracao) VALUES($1,$2,$3,$4,$5,$6)', [pergunta,t,q,'texto_longo','Pergunta congelada','{}']);
    for (const [id,valor] of [[a,'0'],[b,'false']]) {
      await admin.query('INSERT INTO respostas_checkin(id,tenant_id,paciente_id,envio_questionario_id,finalizado_em) VALUES($1,$2,$3,$4,now())',[id,t,paciente,envio]);
      await admin.query('INSERT INTO resposta_valores(id,tenant_id,resposta_checkin_id,pergunta_id,valor) VALUES($1,$2,$3,$4,$5)',[randomUUID(),t,id,pergunta,valor]);
    }
    runtime = new DataSource({ type: 'postgres', ...conexao, username: 'export_runtime', password: 'runtime-synthetic-only',
      entities: [QuestionarioOrm,EnvioQuestionarioOrm,PerguntaOrm,RespostaCheckinOrm,RespostaValorOrm,ProfissionalOrm] });
    await runtime.initialize(); sut = new ServicoQuestionarios(new ExecutorTenant(runtime));
  }, 60_000);
  afterAll(async () => { await runtime?.destroy(); await admin?.end(); await container?.stop(); });
  test('role runtime não ignora RLS e apenas a seleção é exportada', async () => {
    const [role] = await runtime.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    expect(role).toEqual({ rolsuper:false, rolbypassrls:false });
    const csv = await sut.exportarRespostasCsv(t,q,ator,[a]);
    expect(csv).toContain(a); expect(csv).not.toContain(b); expect(csv).toContain(',0');
  });
  test('outro tenant e seleção adulterada falham integralmente', async () => {
    const ocultos = await new ExecutorTenant(runtime).executar(outro, m => m.query('SELECT id FROM respostas_checkin WHERE id=$1',[a]));
    expect(ocultos).toEqual([]); // Sem filtro tenant na consulta: prova da política RLS.
    await expect(sut.exportarRespostasCsv(outro,q,{...ator,tenantId:outro},[a])).rejects.toThrow();
    await expect(sut.exportarRespostasCsv(t,q,ator,[a,randomUUID()])).rejects.toThrow();
  });
  test('transferência de carteira impede exportação posterior sem alterar respostas', async () => {
    await admin.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[randomUUID(),paciente]);
    try { await expect(sut.exportarRespostasCsv(t,q,ator,[a])).rejects.toThrow(); }
    finally { await admin.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[p,paciente]); }
    const {rows} = await admin.query('SELECT count(*)::int AS n FROM resposta_valores WHERE tenant_id=$1',[t]);
    expect(rows[0].n).toBe(2);
  });
  test('transferência concorrente revalida carteira após aguardar o lock', async () => {
    await admin.query('BEGIN');
    let aberto = true;
    await admin.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[randomUUID(),paciente]);
    const resultado = sut.exportarRespostasCsv(t,q,ator,[a]).then(() => 'exportou', () => 'negada');
    try {
      let aguardando = false;
      const limite = Date.now() + 3000;
      while (!aguardando && Date.now() < limite) {
        const {rows} = await admin.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='export_runtime' AND wait_event_type='Lock') AS aguardando");
        aguardando = rows[0].aguardando;
        if (!aguardando) await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(aguardando).toBe(true);
      await admin.query('COMMIT'); aberto = false;
      await expect(resultado).resolves.toBe('negada');
    } finally {
      if (aberto) await admin.query('ROLLBACK');
      await resultado;
      await admin.query('UPDATE pacientes SET profissional_responsavel_id=$1 WHERE id=$2',[p,paciente]);
    }
  });
});
