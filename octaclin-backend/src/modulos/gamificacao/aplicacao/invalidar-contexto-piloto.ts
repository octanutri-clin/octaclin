import { EntityManager } from 'typeorm';

/** Same serialization point as commands/privacy/retention; acquire BEFORE row locks. */
export async function bloquearContextoPiloto317(m: EntityManager, tenantId: string): Promise<void> {
  await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`gamificacao317:${tenantId}`]);
}

export async function ocultarAutorPiloto317(m: EntityManager, tenantId: string, id: string, pacienteId?: string): Promise<void> {
    const filtro=pacienteId ?? null;
    await m.query(`update posts_comunidade set status='oculto',retirado_em=coalesce(retirado_em,now()),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao_piloto=versao_piloto+1
      where tenant_id=$1 and circulo_id=$2 and modelo_versao=317 and ($3::uuid is null or paciente_id=$3) and status='publicado'`,[tenantId,id,filtro]);
    await m.query(`update comentarios_comunidade cm set estado='oculto',retirado_em=coalesce(cm.retirado_em,now()),eliminar_em=least(coalesce(cm.eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao=versao+1
      where cm.tenant_id=$1 and cm.circulo_id=$2 and estado='publicado' and ($3::uuid is null or cm.paciente_id=$3 or exists(select 1 from posts_comunidade p where p.tenant_id=cm.tenant_id and p.circulo_id=cm.circulo_id and p.id=cm.post_id and p.paciente_id=$3 and p.status<>'publicado'))`,[tenantId,id,filtro]);
    await m.query(`update revisoes_publicacao rv set eliminar_em=least(coalesce(rv.eliminar_em,now()+interval '90 days'),now()+interval '90 days') where rv.tenant_id=$1 and rv.circulo_id=$2 and exists(select 1 from posts_comunidade p where p.tenant_id=rv.tenant_id and p.id=rv.post_id and ($3::uuid is null or p.paciente_id=$3 or exists(select 1 from comentarios_comunidade cm where cm.tenant_id=rv.tenant_id and cm.id=rv.comentario_id and cm.paciente_id=$3)))`,[tenantId,id,filtro]);
    await m.query(`delete from curtidas_comunidade where tenant_id=$1 and circulo_id=$2 and ($3::uuid is null or paciente_id=$3)`,[tenantId,id,filtro]);
}

/** Internal only: caller authorizes the mutation and holds the tenant lock in this transaction. */
export async function invalidarContextoPiloto317(m: EntityManager, tenantId: string,
  alvo: { pacienteId: string } | { profissionalId: string }): Promise<void> {
  const pacienteId = 'pacienteId' in alvo ? alvo.pacienteId : null;
  const profissionalId = 'profissionalId' in alvo ? alvo.profissionalId : null;
  if (!pacienteId && !profissionalId) throw new Error('Escopo da invalidacao indisponivel.');
  const membros: {circulo_id:string;paciente_id:string}[] = await m.query(`select mb.circulo_id,mb.paciente_id
    from membros_circulo mb join circulos_pacientes r on r.tenant_id=mb.tenant_id and r.id=mb.circulo_id
    where mb.tenant_id=$1 and r.modelo_versao=317 and mb.estado_piloto in ('ativo','convidado')
      and ($2::uuid is null or mb.paciente_id=$2) and ($3::uuid is null or r.profissional_id=$3)
    order by mb.circulo_id,mb.paciente_id`,[tenantId,pacienteId,profissionalId]);
  for (const mb of membros) {
    await ocultarAutorPiloto317(m,tenantId,mb.circulo_id,mb.paciente_id);
    await m.query(`update membros_circulo set estado_piloto='revogado',revogado_em=coalesce(revogado_em,now()),
      eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days'),versao_piloto=versao_piloto+1
      where tenant_id=$1 and circulo_id=$2 and paciente_id=$3 and estado_piloto in ('ativo','convidado')`,[tenantId,mb.circulo_id,mb.paciente_id]);
  }
  await m.query(`update consentimentos_conquistas cc set revogado_em=now(),versao=cc.versao+1
    from paciente_badges b where cc.tenant_id=$1 and b.tenant_id=cc.tenant_id and b.id=cc.conquista_id and b.modelo_versao=317
    and cc.revogado_em is null and ($2::uuid is null or b.paciente_id=$2)
    and ($3::uuid is null or b.profissional_compartilhamento_id=$3)`,[tenantId,pacienteId,profissionalId]);
  await m.query(`update paciente_badges set compartilhado=false,geracao_compartilhamento=geracao_compartilhamento+1,
    profissional_compartilhamento_id=null,versao_piloto=versao_piloto+1 where tenant_id=$1 and modelo_versao=317 and compartilhado=true
    and ($2::uuid is null or paciente_id=$2) and ($3::uuid is null or profissional_compartilhamento_id=$3)`,[tenantId,pacienteId,profissionalId]);
}
