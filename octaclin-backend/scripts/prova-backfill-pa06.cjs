// Somente chamada pelo harness local descartável; nunca aceita URL/banco externo.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { AtivacaoPlanos1720000001074 } = require('../src/infraestrutura/banco-dados/migracoes/1720000001074-AtivacaoPlanos');
module.exports = async function provarBackfill(admin) {
  const casos = [];
  for (let clinica = 0; clinica < 2; clinica++) {
    const tenant = randomUUID(), usuario = randomUUID(), profissional = randomUUID();
    await admin.query("insert into tenants(id,nome,slug) values($1,'Clínica sintética',$2)", [tenant, `pa06-${tenant}`]);
    await admin.query("insert into usuarios(id,tenant_id,email_hash,email_criptografado,senha_hash,role) values($1,$2,$3,decode('01','hex'),'sintetica','Professional')", [usuario,tenant,`hash-sintetico-${usuario}`]);
    await admin.query("insert into profissionais(id,tenant_id,usuario_id,nome_criptografado) values($1,$2,$3,decode('01','hex'))", [profissional,tenant,usuario]);
    for (const empate of [false,true]) {
      const paciente = randomUUID(), planos=[];
      await admin.query("insert into pacientes(id,tenant_id,profissional_responsavel_id,nome_criptografado) values($1,$2,$3,decode('01','hex'))", [paciente,tenant,profissional]);
      for (let indice = 0; indice < 2; indice++) {
        const plano=randomUUID(), versao=randomUUID(), refeicao=randomUUID();
        await admin.query("insert into planos_alimentares(id,tenant_id,paciente_id,profissional_id,criado_por_usuario_id,titulo_criptografado) values($1,$2,$3,$4,$5,decode('01','hex'))", [plano,tenant,paciente,profissional,usuario]);
        await admin.query('insert into plano_alimentar_versoes(id,tenant_id,plano_id,numero,criado_por_usuario_id) values($1,$2,$3,1,$4)', [versao,tenant,plano,usuario]);
        await admin.query("insert into plano_alimentar_refeicoes(id,tenant_id,versao_id,ordem,nome_criptografado) values($1,$2,$3,0,decode('01','hex'))", [refeicao,tenant,versao]);
        await admin.query("insert into plano_alimentar_itens(tenant_id,refeicao_id,ordem,descricao_criptografada,quantidade,unidade,porcao_gramas,composicao_snapshot_criptografada,motor_calculo_versao) values($1,$2,0,decode('01','hex'),1,'porção',100,decode('01','hex'),'1')",[tenant,refeicao]);
        const data = empate || indice === 1 ? '2026-10-15T12:00:00Z' : '2026-10-14T12:00:00Z';
        await admin.query(`update plano_alimentar_versoes set revisada_em=$1,revisada_por_usuario_id=$2,
          objetivos_criptografados=decode('01','hex'),formula_codigo='sintetica',formula_versao='1',motor_calculo_versao='1',
          calculo_snapshot_criptografado=decode('01','hex'),totais_snapshot_criptografado=decode('01','hex'),hash_conteudo=repeat('a',64),publicada_em=$1 where id=$3`,[data,usuario,versao]);
        await admin.query('update planos_alimentares set versao_publicada_atual_id=$1 where id=$2',[versao,plano]);
        planos.push(plano);
      }
      casos.push({tenant,paciente,planos,empate});
    }
  }
  // Troca o dono das tabelas da aplicação para provar FORCE RLS também no owner.
  await admin.query('create role pa06_migration_owner nosuperuser nobypassrls; grant usage,create on schema public to pa06_migration_owner');
  const tabelas = await admin.query("select tablename from pg_tables where schemaname='public'");
  for (const {tablename} of tabelas) await admin.query(`alter table "${tablename.replaceAll('"','""')}" owner to pa06_migration_owner`);
  const q = admin.createQueryRunner();
  await q.connect(); await q.startTransaction();
  try {
    await q.query('set local role pa06_migration_owner');
    const role = await q.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user');
    assert.equal(role[0].rolsuper,false); assert.equal(role[0].rolbypassrls,false);
    await q.query("select set_config('app.tenant_id','',true)");
    await new AtivacaoPlanos1720000001074().up(q);
    assert.equal((await q.query("select current_setting('app.tenant_id',true) as contexto"))[0].contexto,'');
    assert.equal((await q.query('select count(*)::integer as total from plano_alimentar_refeicao_estados'))[0].total,0);
    for (const c of casos) {
      await q.query("select set_config('app.tenant_id',$1,true)",[c.tenant]);
      const resultado=await q.query('select id,ativo_para_paciente,ativacao_definida,ativacao_revisao from planos_alimentares where tenant_id=$1 and paciente_id=$2 order by id',[c.tenant,c.paciente]);
      assert.equal(resultado.length,2);
      for (const p of resultado) {
        assert.equal(p.ativo_para_paciente,!c.empate && p.id===c.planos[1]);
        assert.equal(p.ativacao_definida,true); assert.equal(p.ativacao_revisao,0);
      }
      const vinculos=await q.query('select * from plano_alimentar_refeicao_vinculos where tenant_id=$1',[c.tenant]);
      assert.equal(vinculos.length,4); assert(vinculos.every(v=>v.identidade_id===v.refeicao_id));
      assert.equal((await q.query('select count(*)::integer as total from plano_alimentar_refeicao_estados'))[0].total,4);
      await q.query("select set_config('app.tenant_id','',true)");
    }
    await q.commitTransaction();
    console.log('PASS PA06b backfill: 2 tenants, 4 pacientes, 8 planos; owner NOBYPASSRLS, sem contexto, restauração do contexto e empates fail-closed.');
  } catch (e) { await q.rollbackTransaction(); throw e; }
  finally { await q.release(); }
};
