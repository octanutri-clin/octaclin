import { randomUUID } from 'crypto';
import { DataSource, DataSourceOptions } from 'typeorm';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { criarOpcoesTypeOrm } from '../../../infraestrutura/banco-dados/opcoes-typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ConteudoPiloto, ContextoGamificacaoPiloto } from './contexto-piloto';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';
import { ServicoConquistasPiloto } from './servico-conquistas-piloto';
import { ServicoExcecaoRetencaoPiloto } from './servico-excecao-retencao-piloto';
import { ServicoRetencaoPiloto } from './servico-retencao-piloto';
import { ServicoModeracaoPiloto } from './servico-moderacao-piloto';
import { ServicoGamificacao } from './servico-gamificacao';
import { ServicoCirculosPiloto } from './servico-circulos-piloto';
import { ServicoPublicacoesPiloto } from './servico-publicacoes-piloto';
import { TERMO_COMUNIDADE, TERMO_CONQUISTAS } from '../dominio/piloto-gamificacao';
import { ServicoPacientes } from '../../pacientes/aplicacao/servico-pacientes';
import { ServicoPortalCliente } from '../../clientes/aplicacao/servico-portal-cliente';
import { ServicoPortalPaciente } from '../../pacientes/aplicacao/servico-portal-paciente';
import { ServicoProfissionais } from '../../profissionais/aplicacao/servico-profissionais';

const executar = process.env.RLS_TESTCONTAINERS === 'true';
(executar ? describe : describe.skip)('piloto317 PostgreSQL descartavel real', () => {
  let container: StartedTestContainer | undefined, owner: DataSource | undefined, runtime: DataSource | undefined;
  let executor: ExecutorTenant, config: ServicoConfiguracaoPiloto, conquistas: ServicoConquistasPiloto;
  let circulos: ServicoCirculosPiloto, publicacoes: ServicoPublicacoesPiloto, moderacao:ServicoModeracaoPiloto;
  let prof: UsuarioAutenticado, patient: UsuarioAutenticado, gestor: UsuarioAutenticado, profId: string, pacienteId: string;
  const envAntes = { ...process.env };
  jest.setTimeout(240000);
  beforeAll(async () => {
    for (const key of ['DATABASE_URL','BANCO_HOST','BANCO_PORTA','BANCO_USUARIO','BANCO_SENHA','BANCO_NOME','BANCO_SSL','BANCO_EXECUTAR_MIGRACOES']) delete process.env[key];
    process.env.GAMIFICACAO_PILOTO_OPERACAO_APROVADA='true';
    container=await new GenericContainer('timescale/timescaledb-ha:pg15').withEnvironment({POSTGRES_USER:'octaclin',POSTGRES_PASSWORD:'octaclin_testcontainers',POSTGRES_DB:'fase317_sintetica'}).withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections',2)).start();
    const options={...criarOpcoesTypeOrm(),type:'postgres',host:container.getHost(),port:container.getMappedPort(5432),username:'octaclin',password:'octaclin_testcontainers',database:'fase317_sintetica',ssl:false,synchronize:false,logging:false,migrationsRun:false} as DataSourceOptions;
    owner=await new DataSource(options).initialize(); await owner.runMigrations();
    await owner.query(`create role fase317_runtime with login password 'fase317_runtime_sintetica' nosuperuser nocreatedb nocreaterole nobypassrls;
      grant usage on schema public to fase317_runtime; grant select,insert,update,delete on all tables in schema public to fase317_runtime;`);
    runtime=await new DataSource({...options,username:'fase317_runtime',password:'fase317_runtime_sintetica'} as DataSourceOptions).initialize();
    executor=new ExecutorTenant(runtime); config=new ServicoConfiguracaoPiloto(executor);
    const base=new ContextoGamificacaoPiloto(executor,new ConteudoPiloto(new CriptografiaDadosSensiveis()),config);
    conquistas=new ServicoConquistasPiloto(base);circulos=new ServicoCirculosPiloto(base);publicacoes=new ServicoPublicacoesPiloto(base,circulos);moderacao=new ServicoModeracaoPiloto(base,publicacoes);
    const [tenant]=await owner.query(`insert into tenants(nome,slug) values('Clinica sintetica',$1) returning id`,[randomUUID()]);
    const makeUser=async (papel: UsuarioAutenticado['papel'],permissoes: UsuarioAutenticado['permissoes']): Promise<UsuarioAutenticado> => {
      const [row]=await owner!.query(`insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica',$4) returning id`,[tenant.id,randomUUID(),Buffer.from('fixture-sintetica'),papel]);
      return {tenantId:tenant.id,usuarioId:row.id,papel,emailHash:'',permissoes};
    };
    prof=await makeUser('Professional',['gamificacao.gerenciar','pacientes.gerenciar']);
    patient=await makeUser('Patient',[]);gestor=await makeUser('Client',['cliente.configuracoes.gerenciar']);
    const [pr]=await owner.query(`insert into profissionais(tenant_id,usuario_id,nome_criptografado) values($1,$2,$3) returning id`,[tenant.id,prof.usuarioId,new CriptografiaDadosSensiveis().criptografar('Profissional sintetico')]);profId=pr.id;
    const [p]=await owner.query(`insert into pacientes(tenant_id,usuario_id,profissional_responsavel_id,nome_criptografado,data_nascimento) values($1,$2,$3,$4,'1990-01-01') returning id`,[tenant.id,patient.usuarioId,profId,Buffer.from('paciente-sintetico')]);pacienteId=p.id;
    await config.atualizar(tenant.id,gestor,{conquistas:true,comunidade:true,versaoEsperada:0});
  });
  afterAll(async () => {
    try { await runtime?.destroy(); } finally { try { await owner?.destroy(); } finally { await container?.stop(); process.env=envAntes; } }
  });
  const criar = () => conquistas.conceder(prof,pacienteId,{chave:randomUUID(),versaoEsperada:0,titulo:'Marco sintetico',descricao:'Conteudo sintetico para teste',icone:'award'});
  it('concede com snapshot cifrado e nao projeta antes de compartilhar e aceitar', async () => {
    const grant=await criar();
    const rows=await executor.executar(prof.tenantId,m => m.query(`select snapshot_criptografado from paciente_badges where tenant_id=$1 and id=$2`,[prof.tenantId,grant.id]));
    expect(rows[0].snapshot_criptografado.toString()).not.toContain('Marco sintetico');
    expect((await conquistas.listarPortal(patient,{})).itens.some(row => row.id===grant.id)).toBe(false);
    const shared=await conquistas.compartilhar(prof,pacienteId,grant.id,{chave:randomUUID(),versaoEsperada:1,compartilhado:true});
    const before=(await conquistas.listarPortal(patient,{})).itens.find(row => row.id===grant.id)!;
    expect(before).not.toHaveProperty('titulo'); expect(before).not.toHaveProperty('pacienteId');
    await conquistas.consentir(patient,grant.id,{chave:randomUUID(),versaoEsperada:0,aceitar:true,geracao:shared.geracao,termoVersao:TERMO_CONQUISTAS});
    const after=(await conquistas.listarPortal(patient,{})).itens.find(row => row.id===grant.id)!;
    expect(after).toMatchObject({titulo:'Marco sintetico',aceito:true}); expect(after).not.toHaveProperty('snapshotCriptografado');
  });
  it('dois comandos concorrentes iguais criam uma unica conquista', async () => {
    const d={chave:randomUUID(),versaoEsperada:0,titulo:'Concorrencia sintetica',icone:'award'};
    const [a,b]=await Promise.all([conquistas.conceder(prof,pacienteId,d),conquistas.conceder(prof,pacienteId,d)]);
    expect(a).toEqual(b);
    await expect(conquistas.conceder(prof,pacienteId,{...d,titulo:'Divergente'})).rejects.toThrow('Chave ja usada');
  });
  it('snapshot e autor nao podem ser sobrescritos pela role runtime', async () => {
    const g=await criar();
    await expect(executor.executar(prof.tenantId,m => m.query(`update paciente_badges set snapshot_criptografado=$3 where tenant_id=$1 and id=$2`,[prof.tenantId,g.id,Buffer.from('adulterado')]))).rejects.toThrow('Snapshot da conquista');
  });
  it('revogacao permanece disponivel com flag desligada e nao concede acesso ao texto', async () => {
    const g=await criar(); const shared=await conquistas.compartilhar(prof,pacienteId,g.id,{chave:randomUUID(),versaoEsperada:1,compartilhado:true});
    await conquistas.consentir(patient,g.id,{chave:randomUUID(),versaoEsperada:0,aceitar:true,geracao:shared.geracao,termoVersao:TERMO_CONQUISTAS});
    await config.atualizar(prof.tenantId,gestor,{conquistas:false,comunidade:true,versaoEsperada:1});
    const privacidade=await conquistas.listarConsentimentos(patient,{});
    expect(privacidade.itens.some(row=>row.id===g.id)).toBe(true);
    expect(privacidade.itens.every(row=>!('titulo' in row) && !('descricao' in row))).toBe(true);
    const revoked=await conquistas.consentir(patient,g.id,{chave:randomUUID(),versaoEsperada:1,aceitar:false,geracao:shared.geracao,termoVersao:TERMO_CONQUISTAS});
    expect(revoked.aceito).toBe(false);
    await expect(conquistas.listarPortal(patient,{})).rejects.toThrow('Piloto indisponivel');
    await config.atualizar(prof.tenantId,gestor,{conquistas:true,comunidade:true,versaoEsperada:2});
    expect((await conquistas.listarPortal(patient,{})).itens.find(row => row.id===g.id)).not.toHaveProperty('titulo');
  });
  it('convite, aceite, publicacao imediata, comentario e reacao usam somente o escopo aceito', async () => {
    const r=await circulos.criar(prof,{chave:randomUUID(),versaoEsperada:0,nome:'Circulo sintetico',objetivo:'Convivencia sintetica'});
    await expect(publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Sem convite'})).rejects.toThrow('Participacao indisponivel');
    const convite=await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:0});
    const preview=(await circulos.listar(patient,{})).itens.find(item=>item.id===r.id);
    expect(preview).toMatchObject({destinatarios:{clinica:'Clinica sintetica',profissional:'Profissional sintetico'}});
    expect(preview).not.toHaveProperty('profissional_id');
    await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:convite.versao,geracao:convite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Participante sintetico'});
    const p=await publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Publicacao sintetica'});
    const c=await publicacoes.comentar(patient,r.id,p.id,{chave:randomUUID(),versaoEsperada:0,texto:'Comentario sintetico'});
    await publicacoes.curtir(patient,r.id,p.id,c.id,{chave:randomUUID(),versaoEsperada:1,curti:true});
    const feed=await publicacoes.feed(patient,r.id,{});
    expect(feed.itens).toEqual([expect.objectContaining({texto:'Publicacao sintetica',autor:'Participante sintetico'})]);
    expect(feed.itens[0]).not.toHaveProperty('paciente_id');
    expect((await publicacoes.comentarios(patient,r.id,p.id,{})).itens[0]).toMatchObject({texto:'Comentario sintetico',reacoes:{total:1,curti:true}});
    expect((await publicacoes.quemCurtiu(patient,r.id,p.id,c.id,{})).itens).toEqual([{nome:'Participante sintetico'}]);
    const [row]=await executor.executar(patient.tenantId,m=>m.query('select conteudo,status,conteudo_criptografado from posts_comunidade where tenant_id=$1 and id=$2',[patient.tenantId,p.id]));
    expect(row.status).toBe('publicado');expect(row.conteudo).toBe('Conteudo privado');expect(row.conteudo_criptografado.toString()).not.toContain('Publicacao sintetica');
    await circulos.sair(patient,r.id,{chave:randomUUID(),versaoEsperada:2});
    await expect(publicacoes.curtir(patient,r.id,p.id,undefined,{chave:randomUUID(),versaoEsperada:1,curti:true})).rejects.toThrow('Participacao indisponivel');
    const [hidden]=await executor.executar(patient.tenantId,m=>m.query('select status,eliminar_em from posts_comunidade where tenant_id=$1 and id=$2',[patient.tenantId,p.id]));
    expect(hidden.status).toBe('oculto');expect(hidden.eliminar_em).toBeInstanceOf(Date);
    expect((await publicacoes.feed(prof,r.id,{})).itens).toEqual([]);
    const novo=await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:3});
    await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:novo.versao,geracao:novo.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Novo aceite sintetico'});
    expect((await publicacoes.feed(patient,r.id,{})).itens).toEqual([]);
    await expect(publicacoes.comentarios(patient,r.id,p.id,{})).rejects.toThrow('Publicacao nao encontrada');
  });

  it('denuncia e privada; decisao de retirada oculta conteudo e replay nao o republica', async () => {
    const r=(await circulos.listar(prof,{})).itens[0];
    const d={chave:randomUUID(),versaoEsperada:0,texto:'Texto sintetico para moderacao'};
    const p=await publicacoes.publicar(patient,r.id,d);
    await publicacoes.editar(patient,r.id,p.id,undefined,{chave:randomUUID(),versaoEsperada:1,texto:'Texto sintetico revisado'});
    const report=await moderacao.denunciar(patient,r.id,p.id,undefined,{chave:randomUUID(),versaoEsperada:2,motivo:'Motivo sintetico'});
    expect((await publicacoes.feed(patient,r.id,{})).itens.some(row=>row.id===p.id)).toBe(true);
    await expect(moderacao.listar(patient,r.id,{})).rejects.toThrow();
    const fila=await moderacao.listar(prof,r.id,{});expect(fila.itens[0].evidencia).toMatchObject({texto:'Texto sintetico revisado',motivo:'Motivo sintetico'});
    await moderacao.decidir(prof,r.id,report.id,{chave:randomUUID(),versaoEsperada:1,retirar:true,justificativa:'Revisao sintetica'});
    expect((await publicacoes.feed(patient,r.id,{})).itens.some(row=>row.id===p.id)).toBe(false);
    expect(await publicacoes.publicar(patient,r.id,d)).toEqual(p);
    expect((await publicacoes.feed(patient,r.id,{})).itens.some(row=>row.id===p.id)).toBe(false);
  });
  it('legado nao lista circulos317 nem publica neles',async()=>{
    await owner!.query(`insert into tenant_configuracoes(tenant_id,chave,valor) values($1,'gamificacao',$2::jsonb)`,[prof.tenantId,JSON.stringify({comunidadeHabilitada:true,metasBadgesHabilitados:true})]);
    const legado=new ServicoGamificacao(executor),r=(await circulos.listar(prof,{})).itens[0];
    expect((await legado.listarCirculos(prof.tenantId,prof)).some(row=>row.id===r.id)).toBe(false);
    await expect(legado.criarPost(prof.tenantId,{circuloId:r.id,pacienteId,conteudo:'Tentativa sintetica legada'},prof)).rejects.toThrow();
  });
  it('FORCE RLS protege as seis tabelas novas com role runtime sem bypass',async()=>{
    const [role]=await runtime!.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user');expect(role).toMatchObject({rolsuper:false,rolbypassrls:false});
    const tables=['consentimentos_conquistas','comentarios_comunidade','curtidas_comunidade','denuncias_comunidade','revisoes_publicacao','comandos_gamificacao'];
    const rows=await owner!.query('select relname,relrowsecurity,relforcerowsecurity from pg_class where relname=any($1::text[])',[tables]);
    expect(rows).toHaveLength(6);for(const row of rows) expect(row).toMatchObject({relrowsecurity:true,relforcerowsecurity:true});
    const other=randomUUID();
    for(const table of tables) expect(await executor.executar(other,m=>m.query(`select id from ${table} where tenant_id=$1`,[prof.tenantId]))).toEqual([]);
    const comandosDeOutroTenant=[
      ['consentimentos_conquistas','paciente_id,conquista_id,usuario_id,geracao,termo_versao','$2,$3,$4,1,\'sintetico\''],
      ['comentarios_comunidade','circulo_id,post_id,paciente_id,autor_usuario_id,geracao_membro','$3,$3,$2,$4,1'],
      ['curtidas_comunidade','circulo_id,post_id,paciente_id,geracao_membro','$3,$3,$2,1'],
      ['denuncias_comunidade','circulo_id,post_id,paciente_id','$3,$3,$2'],
      ['revisoes_publicacao','circulo_id,post_id,versao','$3,$3,1'],
      ['comandos_gamificacao','usuario_id,chave,acao,fingerprint_criptografado,resultado_criptografado',"$4,$3,'sintetico','\\x01'::bytea,'\\x01'::bytea"]
    ];
    for(const [table,colunas,valores] of comandosDeOutroTenant) {
      await expect(executor.executar(prof.tenantId,m=>m.query(`with entradas as (select $1::uuid,$2::uuid,$3::uuid,$4::uuid) insert into ${table}(tenant_id,${colunas}) values($1,${valores})`,[other,pacienteId,randomUUID(),prof.usuarioId]))).rejects.toThrow('row-level security');
    }
  });

  it('retencao remove corpos vencidos e preserva tombstone contra replay',async()=>{
    const r=(await circulos.listar(prof,{})).itens[0],d={chave:randomUUID(),versaoEsperada:0,texto:'Corpo sintetico vencido'};
    const p=await publicacoes.publicar(patient,r.id,d);
    await publicacoes.retirar(patient,r.id,p.id,undefined,{chave:randomUUID(),versaoEsperada:1});
    await owner!.query(`update posts_comunidade set eliminar_em=now()-interval '1 second' where id=$1`,[p.id]);
    await owner!.query(`update revisoes_publicacao set eliminar_em=now()-interval '1 second' where post_id=$1`,[p.id]);
    await owner!.query(`update comandos_gamificacao set criado_em=now()-interval '91 days' where chave=$1`,[d.chave]);
    await new ServicoRetencaoPiloto(executor,circulos).limparTenant(prof.tenantId);
    expect(await owner!.query('select id from posts_comunidade where id=$1',[p.id])).toEqual([]);
    expect(await owner!.query('select id from revisoes_publicacao where post_id=$1',[p.id])).toEqual([]);
    await expect(publicacoes.publicar(patient,r.id,d)).rejects.toThrow('Comando expirado');
  });

  it('mudanca de nascimento oculta autoria; menor nao publica e revogacao continua disponivel',async()=>{
    const r=(await circulos.listar(prof,{})).itens[0];
    await owner!.query("update pacientes set data_nascimento='2015-01-01' where id=$1",[pacienteId]);
    try {
      await expect(publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Bloqueado sintetico'})).rejects.toThrow();
      expect((await publicacoes.feed(prof,r.id,{})).itens).toEqual([]);
      const [member]=await owner!.query('select versao_piloto from membros_circulo where circulo_id=$1 and paciente_id=$2',[r.id,pacienteId]);
      await circulos.sair(patient,r.id,{chave:randomUUID(),versaoEsperada:member.versao_piloto});
    } finally { await owner!.query("update pacientes set data_nascimento='1990-01-01' where id=$1",[pacienteId]); }
  });
  it('transferencia de carteira bloqueia profissional anterior e esconde conquistas compartilhadas',async()=>{
    const grant=await criar();await conquistas.compartilhar(prof,pacienteId,grant.id,{chave:randomUUID(),versaoEsperada:1,compartilhado:true});
    const [u]=await owner!.query(`insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica','Professional') returning id`,[prof.tenantId,randomUUID(),Buffer.from('sintetica')]);
    const [pr]=await owner!.query('insert into profissionais(tenant_id,usuario_id,nome_criptografado) values($1,$2,$3) returning id',[prof.tenantId,u.id,Buffer.from('sintetica')]);
    await owner!.query('update pacientes set profissional_responsavel_id=$2 where id=$1',[pacienteId,pr.id]);
    try {
      await expect(conquistas.listarProfissional(prof,pacienteId,{})).rejects.toThrow('Paciente nao encontrado');
      expect((await conquistas.listarPortal(patient,{})).itens.some(g=>g.id===grant.id)).toBe(false);
    } finally { await owner!.query('update pacientes set profissional_responsavel_id=$2 where id=$1',[pacienteId,profId]); }
  });
  it('usuario revogado no banco nao consegue usar identidade antiga',async()=>{
    await owner!.query('update usuarios set ativo=false where id=$1',[prof.usuarioId]);
    try { await expect(conquistas.listarProfissional(prof,pacienteId,{})).rejects.toThrow('Acesso nao autorizado'); }
    finally { await owner!.query('update usuarios set ativo=true where id=$1',[prof.usuarioId]); }
  });
  it('modelo do snapshot nao pode ser rebaixado para contornar o trigger',async()=>{
    const grant=await criar();
    await expect(executor.executar(prof.tenantId,m=>m.query('update paciente_badges set modelo_versao=1 where tenant_id=$1 and id=$2',[prof.tenantId,grant.id]))).rejects.toThrow('Snapshot da conquista');
  });

  it('nomes e contadores nao vazam identidade interna; saida oculta comentarios e curtidas',async()=>{
    const r=await circulos.criar(prof,{chave:randomUUID(),versaoEsperada:0,nome:'Segundo circulo sintetico',objetivo:'Interacoes sinteticas'});
    const [user]=await owner!.query(`insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica','Patient') returning id`,[prof.tenantId,randomUUID(),Buffer.from('sintetica')]);
    const [pac]=await owner!.query("insert into pacientes(tenant_id,usuario_id,profissional_responsavel_id,nome_criptografado,data_nascimento) values($1,$2,$3,$4,'1991-01-01') returning id",[prof.tenantId,user.id,profId,Buffer.from('sintetica')]);
    const outra:UsuarioAutenticado={...patient,usuarioId:user.id};
    await expect(publicacoes.feed(outra,r.id,{})).rejects.toThrow('Participacao indisponivel');
    for(const [ator,pid,nome] of [[patient,pacienteId,'Pessoa A sintetica'],[outra,pac.id,'Pessoa B sintetica']] as const) {
      const inv=await circulos.convidar(prof,r.id,pid,{chave:randomUUID(),versaoEsperada:0});
      await circulos.aceitar(ator,r.id,{chave:randomUUID(),versaoEsperada:inv.versao,geracao:inv.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:nome});
    }
    const post=await publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Interacao A sintetica'});
    await publicacoes.comentar(outra,r.id,post.id,{chave:randomUUID(),versaoEsperada:0,texto:'Interacao B sintetica'});
    await publicacoes.curtir(outra,r.id,post.id,undefined,{chave:randomUUID(),versaoEsperada:1,curti:true});
    await expect(publicacoes.editar(outra,r.id,post.id,undefined,{chave:randomUUID(),versaoEsperada:1,texto:'Tentativa de edicao'})).rejects.toThrow('Somente o autor');
    expect((await publicacoes.quemCurtiu(patient,r.id,post.id,undefined,{})).itens).toEqual([{nome:'Pessoa B sintetica'}]);
    await circulos.sair(outra,r.id,{chave:randomUUID(),versaoEsperada:2});
    expect((await publicacoes.feed(patient,r.id,{})).itens[0].reacoes).toEqual({total:0,curti:false});
    expect((await publicacoes.comentarios(patient,r.id,post.id,{})).itens).toEqual([]);
    expect((await publicacoes.quemCurtiu(patient,r.id,post.id,undefined,{})).itens).toEqual([]);
    const [revision]=await owner!.query(`select rv.eliminar_em from revisoes_publicacao rv join comentarios_comunidade cm on cm.id=rv.comentario_id where cm.paciente_id=$1`,[pac.id]);expect(revision.eliminar_em).toBeInstanceOf(Date);
  });
  it('paginacao usa data+id e rejeita cursor de outra pessoa',async()=>{
    const r=(await circulos.listar(prof,{})).itens[0];
    const [member]=await owner!.query('select geracao from membros_circulo where circulo_id=$1 and paciente_id=$2',[r.id,pacienteId]);
    for(let i=0;i<21;i++) {
      const id=randomUUID();
      const bytes=publicacoes.base.conteudo.cifrar(`${prof.tenantId}:post:${id}:1`,`Pagina sintetica ${i}`);
      await owner!.query(`insert into posts_comunidade(id,tenant_id,circulo_id,paciente_id,conteudo,status,modelo_versao,autor_usuario_id,geracao_membro,conteudo_criptografado,criado_em) values($1,$2,$3,$4,'Conteudo privado','publicado',317,$5,$6,$7,'2026-01-01T00:00:00Z')`,[id,prof.tenantId,r.id,pacienteId,patient.usuarioId,member.geracao,bytes]);
    }
    const first=await publicacoes.feed(patient,r.id,{});expect(first.itens).toHaveLength(20);expect(first.temMais).toBe(true);
    const next=await publicacoes.feed(patient,r.id,{cursor:first.proximoCursor});expect(next.itens.length).toBeGreaterThan(0);
    expect(next.itens.some(row=>first.itens.some(before=>before.id===row.id))).toBe(false);
    await expect(publicacoes.feed(prof,r.id,{cursor:first.proximoCursor})).rejects.toThrow('Conteudo indisponivel');
  });
  it('excecao legal preserva somente evidencia ate o prazo e nunca projeta texto ao gestor',async()=>{
    const [row]=await owner!.query('select id,versao from denuncias_comunidade where tenant_id=$1 limit 1',[prof.tenantId]);
    await owner!.query("update denuncias_comunidade set eliminar_em=now()+interval '1 minute' where id=$1",[row.id]);
    const service=new ServicoExcecaoRetencaoPiloto(config,publicacoes.base);
    const list=await service.listar(gestor) as {itens:Array<Record<string,unknown>>;temMais:boolean};
    expect(list.itens).toContainEqual(expect.objectContaining({id:row.id,versao:Number(row.versao),holdAte:null}));
    expect(JSON.stringify(list)).not.toContain('evidencia');
    const result=await service.registrar(prof.tenantId,gestor,row.id,{chave:randomUUID(),versaoEsperada:row.versao,holdAte:new Date(Date.now()+86400000).toISOString(),justificativa:'Necessidade legal sintetica explicitamente confirmada',confirmacaoLegal:true});
    expect(result).not.toHaveProperty('evidencia');
    await owner!.query("update denuncias_comunidade set eliminar_em=now()-interval '1 second' where id=$1",[row.id]);
    await new ServicoRetencaoPiloto(executor,circulos).limparTenant(prof.tenantId);
    const [kept]=await owner!.query('select evidencia_criptografada from denuncias_comunidade where id=$1',[row.id]);expect(kept.evidencia_criptografada).not.toBeNull();
    await owner!.query("update denuncias_comunidade set hold_ate=now()-interval '1 second' where id=$1",[row.id]);
    await new ServicoRetencaoPiloto(executor,circulos).limparTenant(prof.tenantId);
    expect(await owner!.query('select id from denuncias_comunidade where id=$1',[row.id])).toEqual([]);
  });
  it('moderador pode revogar uma participacao sem revelar lista de membros',async()=>{
    const r=(await circulos.listar(prof,{})).itens[0];
    const member=await circulos.obterConvite(prof,r.id,pacienteId);
    await circulos.revogar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:member.versao});
    expect((await circulos.obterConvite(prof,r.id,pacienteId)).estado).toBe('revogado');
    expect((await circulos.listar(patient,{})).itens.some(row=>row.id===r.id)).toBe(false);
    await expect(publicacoes.feed(patient,r.id,{})).rejects.toThrow('Participacao indisponivel');
  });

  it('role runtime nao reescreve uma revisao nem apaga antes do prazo',async()=>{
    const [r]=await owner!.query('select id from revisoes_publicacao where tenant_id=$1 and (eliminar_em is null or eliminar_em>now()) limit 1',[prof.tenantId]);
    await expect(executor.executar(prof.tenantId,m=>m.query('update revisoes_publicacao set conteudo_criptografado=$3 where tenant_id=$1 and id=$2',[prof.tenantId,r.id,Buffer.from('adulterado')]))).rejects.toThrow('Revisao de publicacao imutavel');
    await expect(executor.executar(prof.tenantId,m=>m.query('update revisoes_publicacao set conteudo_criptografado=null where tenant_id=$1 and id=$2',[prof.tenantId,r.id]))).rejects.toThrow('Revisao de publicacao imutavel');
    await expect(executor.executar(prof.tenantId,m=>m.query('delete from revisoes_publicacao where tenant_id=$1 and id=$2',[prof.tenantId,r.id]))).rejects.toThrow('Revisao nao pode ser apagada');
  });

  it('listas de revogacao funcionam com flags desligadas sem nomes ou textos',async()=>{
    await config.atualizar(prof.tenantId,gestor,{conquistas:false,comunidade:false,versaoEsperada:3});
    try {
      const circles=await circulos.listarParticipacoes(patient,{});
      expect(circles.itens.length).toBeGreaterThan(0);expect(circles.itens.every(r=>!('nome' in r) && !('objetivo' in r))).toBe(true);
      const consents=await conquistas.listarConsentimentos(patient,{});expect(consents.itens.every(r=>!('titulo' in r))).toBe(true);
      await expect(publicacoes.feed(patient,circles.itens[0].id,{})).rejects.toThrow('Piloto indisponivel');
    } finally { await config.atualizar(prof.tenantId,gestor,{conquistas:true,comunidade:true,versaoEsperada:4}); }
  });

  it('retirada sem denuncia preserva replay e nao inventa nova versao ao repetir',async()=>{
    const r=await circulos.criar(prof,{chave:randomUUID(),versaoEsperada:0,nome:'Retirada sintetica',objetivo:'Prova sem denuncia'});
    const invite=await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:0});
    await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:invite.versao,geracao:invite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Nome sintetico'});
    const post=await publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Texto retirado sem denuncia'});
    const command={chave:randomUUID(),versaoEsperada:1};
    expect(await publicacoes.retirar(prof,r.id,post.id,undefined,command)).toMatchObject({versao:2,estado:'retirado'});
    expect(await publicacoes.retirar(prof,r.id,post.id,undefined,command)).toMatchObject({versao:2,estado:'retirado'});
    await expect(publicacoes.retirar(prof,r.id,post.id,undefined,{chave:randomUUID(),versaoEsperada:2})).rejects.toThrow('Publicacao ja retirada');
    const [stored]=await owner!.query('select versao_piloto from posts_comunidade where id=$1',[post.id]);expect(stored.versao_piloto).toBe(2);
  });

  it('publicacao concorrente com saida nunca permanece visivel apos a saida confirmada',async()=>{
    const r=await circulos.criar(prof,{chave:randomUUID(),versaoEsperada:0,nome:'Corrida sintetica',objetivo:'Prova de revogacao'});
    const invite=await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:0});
    const accepted=await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:invite.versao,geracao:invite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Nome sintetico'});
    const [,saida]=await Promise.allSettled([
      publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Texto sintetico em corrida'}),
      circulos.sair(patient,r.id,{chave:randomUUID(),versaoEsperada:accepted.versao})
    ]);
    expect(saida.status).toBe('fulfilled');expect((await publicacoes.feed(prof,r.id,{})).itens).toEqual([]);
    await expect(publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Texto apos saida'})).rejects.toThrow('Participacao indisponivel');
  });

  it('transferencia e retorno antes do cron nao restauram consentimento nem conteudo', async () => {
    const cripto = new CriptografiaDadosSensiveis();
    await owner!.query('update pacientes set nome_criptografado=$2 where id=$1',[pacienteId,cripto.criptografar('Paciente sintetico')]);
    const servico = new ServicoPacientes(executor,cripto,{} as ServicoPortalCliente);
    const r = (await circulos.listar(prof,{})).itens.find(item=>item.estado==='ativo') ?? await circulos.criar(prof,{chave:randomUUID(),versaoEsperada:0,nome:'Ida e retorno sinteticos',objetivo:'Revogacao persistente'});
    const anterior = await circulos.obterConvite(prof,r.id,pacienteId);
    const convite = await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:anterior.versao});
    await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:convite.versao,geracao:convite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Pessoa sintetica'});
    const post = await publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Texto sintetico de ida e retorno'});
    const [u] = await owner!.query(`insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica','Professional') returning id`,[prof.tenantId,randomUUID(),Buffer.from('sintetica')]);
    const [pr] = await owner!.query('insert into profissionais(tenant_id,usuario_id,nome_criptografado) values($1,$2,$3) returning id',[prof.tenantId,u.id,cripto.criptografar('Profissional sintetico B')]);
    try {
      await servico.atualizar(prof.tenantId,pacienteId,{profissionalResponsavelId:pr.id},gestor);
      await servico.atualizar(prof.tenantId,pacienteId,{profissionalResponsavelId:profId},gestor);
      expect((await publicacoes.feed(prof,r.id,{})).itens.some(p=>p.id===post.id)).toBe(false);
      await expect(publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Retorno sem novo aceite'})).rejects.toThrow();
      const [m] = await owner!.query('select estado_piloto,revogado_em,eliminar_em from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3',[prof.tenantId,r.id,pacienteId]);
      expect(m.estado_piloto).toBe('revogado');
      expect(m.revogado_em).not.toBeNull();
      expect(m.eliminar_em).not.toBeNull();
    } finally {
      await owner!.query('update pacientes set profissional_responsavel_id=$2 where id=$1',[pacienteId,profId]);

    }
  });
  it.each(['nascimento-console','nascimento-portal','arquivamento-paciente','acesso-paciente','arquivamento-profissional'] as const)(
    'ida e retorno de %s exigem novo aceite sem depender do cron', async caminho => {
      const cripto = new CriptografiaDadosSensiveis();
      const servico = new ServicoPacientes(executor,cripto,{checarLimite:async()=>({permitido:true})} as unknown as ServicoPortalCliente);
      const portal = new ServicoPortalPaciente(executor,cripto);
      const profissionais = new ServicoProfissionais(executor,cripto,{} as never);
      const r = (await circulos.listar(prof,{})).itens.find(item=>item.estado==='ativo')!;
      expect(r).toBeDefined();
      const anterior = await circulos.obterConvite(prof,r.id,pacienteId);
      const convite = await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:anterior.versao});
      await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:convite.versao,geracao:convite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Pessoa sintetica'});
      const post = await publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Historico sintetico de retorno'});
      const grant = await criar();
      const share = await conquistas.compartilhar(prof,pacienteId,grant.id,{chave:randomUUID(),versaoEsperada:1,compartilhado:true});
      await conquistas.consentir(patient,grant.id,{chave:randomUUID(),versaoEsperada:0,aceitar:true,geracao:share.geracao,termoVersao:TERMO_CONQUISTAS});
      try {
        if(caminho==='nascimento-console') {
          await servico.atualizar(prof.tenantId,pacienteId,{dataNascimento:'1991-01-01'},gestor);
          await servico.atualizar(prof.tenantId,pacienteId,{dataNascimento:'1990-01-01'},gestor);
        } else if(caminho==='nascimento-portal') {
          await portal.atualizarPerfil(prof.tenantId,patient.usuarioId,{dataNascimento:'1991-01-01'});
          await portal.atualizarPerfil(prof.tenantId,patient.usuarioId,{dataNascimento:'1990-01-01'});
        } else if(caminho==='arquivamento-paciente') {
          await servico.arquivar(prof.tenantId,pacienteId,gestor);
          await servico.restaurar(prof.tenantId,pacienteId,gestor);
        } else if(caminho==='acesso-paciente') {
          await servico.desativarContaAcesso(prof.tenantId,pacienteId,gestor);
          await owner!.query('update usuarios set ativo=true where tenant_id=$1 and id=$2',[prof.tenantId,patient.usuarioId]);
        } else {
          await profissionais.arquivar(prof.tenantId,profId);
          await profissionais.restaurar(prof.tenantId,profId);
        }
        expect((await publicacoes.feed(prof,r.id,{})).itens.some(p=>p.id===post.id)).toBe(false);
        await expect(publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Sem renovacao'})).rejects.toThrow();
        const [m] = await owner!.query('select estado_piloto,revogado_em,eliminar_em from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3',[prof.tenantId,r.id,pacienteId]);
        expect(m.estado_piloto).toBe('revogado');
        expect(m.revogado_em).not.toBeNull();expect(m.eliminar_em).not.toBeNull();
        expect((await conquistas.listarPortal(patient,{})).itens.some(g=>g.id===grant.id)).toBe(false);
      } finally {
        await owner!.query("update pacientes set data_nascimento='1990-01-01',arquivado_em=null where id=$1",[pacienteId]);
        await owner!.query('update profissionais set arquivado_em=null where id=$1',[profId]);
        await owner!.query('update usuarios set ativo=true where id in ($1,$2)',[patient.usuarioId,prof.usuarioId]);
      }
    });
  it('arquivar autor historico nao revoga conquista compartilhada pelo responsavel atual',async()=>{
    const cripto=new CriptografiaDadosSensiveis();
    const servico=new ServicoPacientes(executor,cripto,{} as ServicoPortalCliente);
    const profissionais=new ServicoProfissionais(executor,cripto,{} as never);
    const grant=await criar();
    const [u]=await owner!.query(`insert into usuarios(tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,'sintetica','Professional') returning id`,[prof.tenantId,randomUUID(),Buffer.from('sintetica')]);
    const [pr]=await owner!.query('insert into profissionais(tenant_id,usuario_id,nome_criptografado) values($1,$2,$3) returning id',[prof.tenantId,u.id,cripto.criptografar('Profissional atual sintetico')]);
    const atual={...prof,usuarioId:u.id};
    try {
      await servico.atualizar(prof.tenantId,pacienteId,{profissionalResponsavelId:pr.id},gestor);
      const share=await conquistas.compartilhar(atual,pacienteId,grant.id,{chave:randomUUID(),versaoEsperada:1,compartilhado:true});
      await conquistas.consentir(patient,grant.id,{chave:randomUUID(),versaoEsperada:0,aceitar:true,geracao:share.geracao,termoVersao:TERMO_CONQUISTAS});
      await profissionais.arquivar(prof.tenantId,profId);
      expect((await conquistas.listarPortal(patient,{})).itens.some(g=>g.id===grant.id)).toBe(true);
    } finally {
      await owner!.query('update profissionais set arquivado_em=null where id=$1',[profId]);
      await owner!.query('update usuarios set ativo=true where id=$1',[prof.usuarioId]);
      await servico.atualizar(prof.tenantId,pacienteId,{profissionalResponsavelId:profId},gestor);
    }
  });
  it('mudanca de cadastro concorrente com publicacao conserva revogacao apos retorno',async()=>{
    const cripto=new CriptografiaDadosSensiveis();
    const servico=new ServicoPacientes(executor,cripto,{} as ServicoPortalCliente);
    const r=(await circulos.listar(prof,{})).itens.find(item=>item.estado==='ativo')!;
    const anterior=await circulos.obterConvite(prof,r.id,pacienteId);
    const invite=await circulos.convidar(prof,r.id,pacienteId,{chave:randomUUID(),versaoEsperada:anterior.versao});
    await circulos.aceitar(patient,r.id,{chave:randomUUID(),versaoEsperada:invite.versao,geracao:invite.geracao,termoVersao:TERMO_COMUNIDADE,nomeExibicao:'Pessoa sintetica'});
    const results=await Promise.allSettled([
      publicacoes.publicar(patient,r.id,{chave:randomUUID(),versaoEsperada:0,texto:'Corrida sintetica de cadastro'}),
      servico.atualizar(prof.tenantId,pacienteId,{dataNascimento:'1991-01-01'},gestor),
    ]);
    expect(results[1].status).toBe('fulfilled');
    await servico.atualizar(prof.tenantId,pacienteId,{dataNascimento:'1990-01-01'},gestor);
    expect((await publicacoes.feed(prof,r.id,{})).itens).toEqual([]);
    const [m]=await owner!.query('select estado_piloto from membros_circulo where tenant_id=$1 and circulo_id=$2 and paciente_id=$3',[prof.tenantId,r.id,pacienteId]);
    expect(m.estado_piloto).toBe('revogado');
  });
});
