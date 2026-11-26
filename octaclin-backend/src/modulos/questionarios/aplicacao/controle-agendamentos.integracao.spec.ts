import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ControleAgendamentosQuestionario1720000001088 } from '../../../infraestrutura/banco-dados/migracoes/1720000001088-ControleAgendamentosQuestionario';
import { IndicesConsultaRespostasQuestionario1720000001087 } from '../../../infraestrutura/banco-dados/migracoes/1720000001087-IndicesConsultaRespostasQuestionario';
import { ServicoRespostasPaginadas } from './servico-respostas-paginadas';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Client } from 'pg';
import { DataSource, EntityManager } from 'typeorm';
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

// Apenas banco descartável com role runtime/FORCE RLS; nenhum ambiente externo.
const suite = process.env.RLS_TESTCONTAINERS === 'true' ? describe : describe.skip;
suite('QST10-09: comandos e gerações autorizadas em PostgreSQL', () => {
  let container: StartedTestContainer, admin: Client, runtime: DataSource, servico: ServicoQuestionarios;
  const tenant=randomUUID(), outroTenant=randomUUID(), usuarioId=randomUUID(), profissionalId=randomUUID(), sessaoId=randomUUID();
  const questionarioId=randomUUID(), pacienteId=randomUUID(), agendamentoId=randomUUID();
  const agora=new Date('2026-11-24T12:00:00Z');
  const ator: UsuarioAutenticado={tenantId:tenant,usuarioId,papel:'Professional',sessaoId,emailHash:'sintetico',permissoes:['questionarios.gerenciar']};
  beforeAll(async()=>{
    container=await new GenericContainer('postgres:15-alpine')
      .withEnvironment({POSTGRES_USER:'owner',POSTGRES_PASSWORD:'qst-test-only',POSTGRES_DB:'qst09'})
      .withTmpFs({'/var/lib/postgresql/data':'rw,size=256m'}).withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i,2)).start();
    const conexao={host:container.getHost(),port:container.getMappedPort(5432),database:'qst09'};
    admin=new Client({...conexao,user:'owner',password:'qst-test-only'});await admin.connect();
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
      CREATE TABLE usuarios(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, UNIQUE(tenant_id,id), email_hash varchar(128) DEFAULT 'sintetico',
        email_criptografado bytea DEFAULT ''::bytea, senha_hash varchar(255) DEFAULT 'sintetico', role varchar(32) NOT NULL,
        ativo boolean NOT NULL, ultimo_login_em timestamptz, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());
      CREATE TABLE sessoes_usuario(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, usuario_id uuid NOT NULL, criado_em timestamptz DEFAULT now(),
        ultima_atividade_em timestamptz DEFAULT now(), expira_em timestamptz NOT NULL, revogado_em timestamptz, motivo_revogacao varchar(40), mfa_verificado_em timestamptz);
      CREATE TABLE profissionais(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, usuario_id uuid NOT NULL, nome_criptografado bytea DEFAULT ''::bytea,
        registro_profissional varchar(80), especialidade varchar(120), arquivado_em timestamptz, preferencias_equivalencia jsonb DEFAULT '{}',
        preferencias_equivalencia_revisao int DEFAULT 0, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now());
      CREATE TABLE envios_questionario(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, questionario_id uuid, snapshot_estrutura jsonb, paciente_id uuid DEFAULT gen_random_uuid(), agendamento_id uuid,
        status varchar(40) DEFAULT 'pendente', enviado_em timestamptz, respondido_em timestamptz, revisado_em timestamptz,
        revisado_por_usuario_id uuid, expira_em timestamptz, respostas_rascunho jsonb, rascunho_atualizado_em timestamptz, rascunho_versao int DEFAULT 0);
      CREATE TABLE pacientes(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, profissional_responsavel_id uuid NOT NULL,
        arquivado_em timestamptz, status_ciclo_vida varchar(32) DEFAULT 'ACTIVE', usuario_id uuid,
        nome_criptografado bytea DEFAULT ''::bytea,contato_criptografado bytea,busca_hashes text[] DEFAULT '{}',
        perfil_filtros_hashes text[] DEFAULT '{}',data_nascimento date,referencia_externa varchar(180),status_adesao varchar(40) DEFAULT 'novo',
        score_risco numeric(5,2) DEFAULT 0,ultimo_checkin_em timestamptz,deletion_requested_at timestamptz,retention_reason varchar(60),
        retention_until timestamptz,legal_basis varchar(60),deleted_at timestamptz,criado_em timestamptz DEFAULT now(),atualizado_em timestamptz DEFAULT now());
      CREATE TABLE respostas_checkin(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, paciente_id uuid NOT NULL,
        envio_questionario_id uuid NOT NULL, finalizado_em timestamptz, criado_em timestamptz DEFAULT now(), score_final numeric(8,2));
      CREATE TABLE resposta_valores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
        resposta_checkin_id uuid NOT NULL, pergunta_id uuid NOT NULL, valor jsonb NOT NULL, score_ponderado numeric(8,2));
      CREATE TABLE tenant_configuracoes(tenant_id uuid NOT NULL, chave text NOT NULL, valor jsonb NOT NULL);
      CREATE TABLE agendamentos_questionario(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
        questionario_id uuid NOT NULL, paciente_id uuid, regra_cron varchar(120), data_fixa timestamptz,
        timezone varchar(80) DEFAULT 'America/Sao_Paulo', ativo boolean DEFAULT true,
        ultima_execucao_em timestamptz, proxima_execucao_em timestamptz, criado_em timestamptz DEFAULT now());
      CREATE TABLE user_action_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,usuario_id uuid,
        acao varchar(120),recurso_tipo varchar(120),recurso_id uuid,ip inet,user_agent text,metadados jsonb DEFAULT '{}',criado_em timestamptz DEFAULT now());
      CREATE ROLE qst_runtime LOGIN PASSWORD 'runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO qst_runtime;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO qst_runtime;
    `);
    for (const tabela of ['questionarios', 'perguntas', 'opcoes_pergunta', 'usuarios', 'sessoes_usuario', 'profissionais', 'envios_questionario', 'pacientes', 'respostas_checkin', 'resposta_valores', 'tenant_configuracoes','agendamentos_questionario','user_action_logs']) {
      await admin.query(`ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${tabela} FORCE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolado ON ${tabela} USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);`);
    }

    const owner=new DataSource({type:'postgres',...conexao,username:'owner',password:'qst-test-only',entities:[],synchronize:false,logging:false});
    await owner.initialize();const qr=owner.createQueryRunner();
    try{await qr.startTransaction();await new ControleAgendamentosQuestionario1720000001088().up(qr);await qr.commitTransaction();}
    finally{await qr.release();await owner.destroy();}
    runtime=new DataSource({type:'postgres',...conexao,username:'qst_runtime',password:'runtime-test-only',
      synchronize:false,logging:false,extra:{max:8,application_name:'qst09_runtime',statement_timeout:10000},
      entities:[QuestionarioOrm,PerguntaOrm,OpcaoPerguntaOrm,UsuarioOrm,SessaoUsuarioOrm,ProfissionalOrm,EnvioQuestionarioOrm,PacienteOrm,AgendamentoQuestionarioOrm,UserActionLogOrm]});
    await runtime.initialize();servico=new ServicoQuestionarios(new ExecutorTenant(runtime));
  },90000);
  beforeEach(async()=>{
    await admin.query('truncate agendamentos_questionario,user_action_logs,envios_questionario,questionarios,usuarios,sessoes_usuario,profissionais,pacientes,perguntas,opcoes_pergunta cascade');
    await admin.query("insert into usuarios(id,tenant_id,role,ativo) values($1,$2,'Professional',true)",[usuarioId,tenant]);
    await admin.query("insert into sessoes_usuario(id,tenant_id,usuario_id,expira_em) values($1,$2,$3,now()+interval '1 hour')",[sessaoId,tenant,usuarioId]);
    await admin.query('insert into profissionais(id,tenant_id,usuario_id) values($1,$2,$3)',[profissionalId,tenant,usuarioId]);
    await admin.query("insert into questionarios(id,tenant_id,profissional_id,titulo,status,versao) values($1,$2,$3,'Sintético','publicado',1)",[questionarioId,tenant,profissionalId]);
    await admin.query('insert into pacientes(id,tenant_id,profissional_responsavel_id) values($1,$2,$3)',[pacienteId,tenant,profissionalId]);
    await admin.query("insert into agendamentos_questionario(id,tenant_id,questionario_id,paciente_id,regra_cron,proxima_execucao_em) values($1,$2,$3,$4,'0 8 * * *',$5)",[agendamentoId,tenant,questionarioId,pacienteId,new Date('2026-11-23T11:00:00Z')]);
  });
  afterAll(async()=>{if(runtime?.isInitialized)await runtime.destroy();await admin?.end();await container?.stop();},30000);
  const pendentes=new Set<Promise<unknown>>();
  function rastrear<T>(p:Promise<T>):Promise<T>{
    pendentes.add(p);void p.then(()=>pendentes.delete(p),()=>pendentes.delete(p));return p;
  }
  afterEach(async()=>{
    // Mesmo se o teste falhar, liberar a barreira e drenar antes do próximo TRUNCATE.
    await admin.query('rollback');await Promise.allSettled([...pendentes]);jest.restoreAllMocks();
  });
  const comando=(acao:'pausar'|'retomar'|'reconfirmar',revisao=1,usuario=ator)=>rastrear(servico.comandarAgendamento(tenant,questionarioId,pacienteId,agendamentoId,acao,revisao,true,usuario));
  const gerar=()=>rastrear(servico.processarAgendamentosVencidos(tenant,agora));
  const registro=async()=>(await admin.query('select * from agendamentos_questionario where id=$1',[agendamentoId])).rows[0];
  const envios=async()=>(await admin.query('select * from envios_questionario order by id')).rows;

  it('legado sem ator não gera novo envio nem inventa autoria',async()=>{
    expect(await gerar()).toBe(0);
    expect(await envios()).toHaveLength(0);expect((await registro()).autorizado_por_usuario_id).toBeNull();
  });
  it('ator inativado não gera mesmo com referência anterior válida',async()=>{
    await admin.query('update agendamentos_questionario set autorizado_por_usuario_id=$1',[usuarioId]);
    await admin.query('update usuarios set ativo=false where id=$1',[usuarioId]);
    expect(await gerar()).toBe(0);expect(await envios()).toHaveLength(0);
  });
  it('transferência da carteira bloqueia geração pelo ator anterior',async()=>{
    await admin.query('update agendamentos_questionario set autorizado_por_usuario_id=$1',[usuarioId]);
    await admin.query('update pacientes set profissional_responsavel_id=$1',[randomUUID()]);
    expect(await gerar()).toBe(0);expect(await envios()).toHaveLength(0);
  });
  it('criação registra ator atual e projeção não revela referências internas',async()=>{
    const a=await servico.criarAgendamento(tenant,{questionarioId,pacienteId,regraCron:'0 8 * * *'},ator);
    expect(a).toMatchObject({ativo:true,revisao:1,reconfirmacaoNecessaria:false,pacienteId});
    expect(a).not.toHaveProperty('autorizadoPorUsuarioId');expect(a).not.toHaveProperty('tenantId');
    expect((await admin.query('select autorizado_por_usuario_id from agendamentos_questionario where id=$1',[a.id])).rows[0].autorizado_por_usuario_id).toBe(usuarioId);
  });
  it('pausa/reconfirmação preservam envios e rascunhos existentes; reconfirmar não retoma',async()=>{
    await admin.query(`insert into envios_questionario(tenant_id,questionario_id,paciente_id,status,respostas_rascunho,rascunho_versao,snapshot_estrutura)
      values($1,$2,$3,'enviado','[{"perguntaId":"sintetico","valor":false}]',3,'{"versaoQuestionario":1,"titulo":"Histórico","perguntas":[]}')`,[tenant,questionarioId,pacienteId]);
    const antes=await envios();
    expect(await comando('pausar')).toMatchObject({estado:'pausado',revisao:2,reconfirmacaoNecessaria:true});
    expect(await comando('reconfirmar',2)).toMatchObject({estado:'pausado',revisao:3,reconfirmacaoNecessaria:false});
    expect(await envios()).toEqual(antes);
    expect((await admin.query('select acao from user_action_logs order by criado_em,id')).rows.map(x=>x.acao))
      .toEqual(['questionarios.agendamento.pausar','questionarios.agendamento.reconfirmar']);
  });
  it('CAS simultâneo e reenvio aplicam somente uma pausa e uma auditoria',async()=>{
    const resultados=await Promise.allSettled([comando('pausar'),comando('pausar')]);
    expect(resultados.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const rejeicao=resultados.find(r=>r.status==='rejected') as PromiseRejectedResult;
    expect(rejeicao.reason).toBeInstanceOf(ConflictException);
    await expect(comando('pausar')).rejects.toBeInstanceOf(ConflictException);
    expect((await registro()).revisao).toBe(2);
    expect((await admin.query('select count(*)::int n from user_action_logs')).rows[0].n).toBe(1);
  });
  it('reconfirmação ativa agenda somente próximo futuro sem envio imediato',async()=>{
    const a=await comando('reconfirmar');
    expect(a.reconfirmacaoNecessaria).toBe(false);expect(a.proximaExecucaoEm!.getTime()).toBeGreaterThan(Date.now());
    expect(await envios()).toHaveLength(0);
  });
  it('sem confirmação explícita não altera revisão',async()=>{
    await expect(servico.comandarAgendamento(tenant,questionarioId,pacienteId,agendamentoId,'pausar',1,false,ator)).rejects.toBeInstanceOf(BadRequestException);
    expect((await registro()).revisao).toBe(1);
  });
  it.each(['Collaborator','Patient','Client'] as const)('papel atual %s nega mesmo com contexto Professional antigo',async papel=>{
    await admin.query('update usuarios set role=$1 where id=$2',[papel,usuarioId]);
    await expect(comando('reconfirmar')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(comando('reconfirmar',1,{...ator,papel})).rejects.toBeInstanceOf(ForbiddenException);
    expect((await registro()).autorizado_por_usuario_id).toBeNull();
  });
  it('sessão revogada impede comandos e lista',async()=>{
    await admin.query('update sessoes_usuario set revogado_em=now()');
    await expect(comando('pausar')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servico.listarAgendamentos(tenant,questionarioId,pacienteId,1,ator)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('carteira transferida impede reconfirmar e consultar agenda',async()=>{
    await admin.query('update pacientes set profissional_responsavel_id=$1',[randomUUID()]);
    await expect(comando('reconfirmar')).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.listarAgendamentos(tenant,questionarioId,pacienteId,1,ator)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('tenant diferente e paciente adulterado não concedem leitura ou comando',async()=>{
    await expect(servico.listarAgendamentos(outroTenant,questionarioId,pacienteId,1,{...ator,tenantId:outroTenant})).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.comandarAgendamento(tenant,questionarioId,randomUUID(),agendamentoId,'pausar',1,true,ator)).rejects.toBeInstanceOf(NotFoundException);
    expect((await registro()).revisao).toBe(1);
  });
  it('lista limitada a25, ordem estável e página seguinte sem repetição',async()=>{
    await admin.query(`insert into agendamentos_questionario(tenant_id,questionario_id,paciente_id,regra_cron)
      select $1,$2,$3,'0 8 * * *' from generate_series(1,25)`,[tenant,questionarioId,pacienteId]);
    const p1=await servico.listarAgendamentos(tenant,questionarioId,pacienteId,1,ator);
    const p2=await servico.listarAgendamentos(tenant,questionarioId,pacienteId,2,ator);
    expect(p1.itens).toHaveLength(25);expect(p1.temMais).toBe(true);expect(p2.itens).toHaveLength(1);
    expect(new Set([...p1.itens,...p2.itens].map(a=>a.id)).size).toBe(26);
    await expect(servico.listarAgendamentos(tenant,questionarioId,pacienteId,0,ator)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('falha na auditoria reverte pausa integralmente',async()=>{
    await admin.query(`create function falha_auditoria_qst09() returns trigger language plpgsql as $$ begin raise exception 'falha sintética'; end $$;
      create trigger falha_auditoria before insert on user_action_logs for each row execute function falha_auditoria_qst09();`);
    try{await expect(comando('pausar')).rejects.toThrow('falha sintética');expect((await registro()).ativo).toBe(true);expect((await registro()).revisao).toBe(1);}
    finally{await admin.query('drop trigger falha_auditoria on user_action_logs;drop function falha_auditoria_qst09()');}
  });

  async function aguardarBloqueados(minimo:number){
    const prazo=performance.now()+5000;
    while(performance.now()<prazo){
      const n=(await admin.query("select count(*)::int n from pg_stat_activity where application_name='qst09_runtime' and wait_event_type='Lock'")).rows[0].n;
      if(n>=minimo)return;
      await new Promise(r=>setTimeout(r,10));
    }
    throw new Error('A barreira de concorrência não foi observada.');
  }
  async function bloquearAgenda(){
    await admin.query('begin');await admin.query('select id from agendamentos_questionario where id=$1 for update',[agendamentoId]);
  }
  async function autorizarFixture(){await admin.query('update agendamentos_questionario set autorizado_por_usuario_id=$1',[usuarioId]);}
  it('dois workers com candidatos simultâneos geram uma única ocorrência e uma auditoria',async()=>{
    // O relógio de efetivação precisa corresponder à referência desta fixture.
    // A barreira usa performance.now e conserva seu prazo real.
    jest.spyOn(Date,'now').mockReturnValue(agora.getTime());
    await autorizarFixture();await bloquearAgenda();
    const a=gerar();const b=gerar();
    try{await aguardarBloqueados(2);}finally{await admin.query('commit');}
    expect((await Promise.all([a,b])).sort()).toEqual([0,1]);
    expect(await envios()).toHaveLength(1);expect((await registro()).revisao).toBe(2);
    expect((await registro()).proxima_execucao_em).toEqual(new Date('2026-11-25T11:00:00Z'));
    expect((await admin.query('select count(*)::int n from user_action_logs')).rows[0].n).toBe(1);
  });
  it('pausa confirmada primeiro impede worker que aguardava a mesma agenda',async()=>{
    await autorizarFixture();await bloquearAgenda();
    const pausa=comando('pausar');await aguardarBloqueados(1);
    const worker=gerar();
    try{await aguardarBloqueados(2);}finally{await admin.query('commit');}
    expect(await pausa).toMatchObject({estado:'pausado',revisao:2});expect(await worker).toBe(0);expect(await envios()).toHaveLength(0);
  });
  it('worker que confirma primeiro invalida revisão da pausa posterior sem duplicar envio',async()=>{
    await autorizarFixture();await bloquearAgenda();
    const worker=gerar();await aguardarBloqueados(1);
    // Capturar a rejeição imediatamente evita unhandled rejection enquanto a barreira está fechada.
    const pausa=comando('pausar').then(v=>({valor:v,erro:undefined}),erro=>({valor:undefined,erro}));
    try{await aguardarBloqueados(2);}finally{await admin.query('commit');}
    expect(await worker).toBe(1);expect((await pausa).erro).toBeInstanceOf(ConflictException);expect(await envios()).toHaveLength(1);
  });
  it.each(['carteira','revogacao'] as const)('%s alterada antes da liberação do lock é revalidada pelo worker',async tipo=>{
    await autorizarFixture();await admin.query('begin');
    if(tipo==='carteira')await admin.query('update pacientes set profissional_responsavel_id=$1 where id=$2',[randomUUID(),pacienteId]);
    else await admin.query('update usuarios set ativo=false where id=$1',[usuarioId]);
    const worker=gerar();
    try{await aguardarBloqueados(1);}finally{await admin.query('commit');}
    expect(await worker).toBe(0);expect(await envios()).toHaveLength(0);expect((await registro()).revisao).toBe(2);expect((await registro()).autorizado_por_usuario_id).toBeNull();
  });
  it('falha após inserir envio reverte envio, revisão, próxima execução e auditoria',async()=>{
    await autorizarFixture();const antes=await registro();
    await admin.query(`create function falha_geracao_qst09() returns trigger language plpgsql as $$ begin raise exception 'falha geracao sintética'; end $$;
      create trigger falha_geracao before insert on user_action_logs for each row execute function falha_geracao_qst09();`);
    try{
      await expect(gerar()).rejects.toThrow('falha geracao sintética');
      expect(await envios()).toHaveLength(0);expect(await registro()).toEqual(antes);
    }finally{await admin.query('drop trigger falha_geracao on user_action_logs;drop function falha_geracao_qst09()');}
  });

  it('espera pelo lock não grava próxima ocorrência já vencida nem recupera minutos perdidos',async()=>{
    await autorizarFixture();await admin.query("update agendamentos_questionario set regra_cron='* * * * *'");
    await bloquearAgenda();const clock=jest.spyOn(Date,'now').mockReturnValue(agora.getTime());
    const worker=gerar();
    try{
      await aguardarBloqueados(1);clock.mockReturnValue(new Date('2026-11-24T12:03:30Z').getTime());
      await admin.query('commit');expect(await worker).toBe(1);
      expect((await registro()).proxima_execucao_em).toEqual(new Date('2026-11-24T12:04:00Z'));
      expect((await registro()).ultima_execucao_em).toEqual(new Date('2026-11-24T12:03:30Z'));
    }finally{clock.mockRestore();await admin.query('rollback');}
  });

  it('timezone ausente ou null usa a mesma normalização ao calcular e persistir',async()=>{
    for(const timezone of [undefined,null]){
      const a=await servico.criarAgendamento(tenant,{questionarioId,pacienteId,regraCron:'0 8 * * *',timezone:timezone as unknown as string},ator);
      expect(a.timezone).toBe('America/Sao_Paulo');expect(a.proximaExecucaoEm!.getUTCHours()).toBe(11);
    }
  });

});
