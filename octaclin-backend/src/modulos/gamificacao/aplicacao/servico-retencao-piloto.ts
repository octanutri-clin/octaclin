import { Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ContextoPiloto } from './contexto-piloto';
import { ServicoCirculosPiloto, CirculoPiloto } from './servico-circulos-piloto';

/** No clinical activation dependency: privacy deadlines keep running after disablement. */
@Injectable()
export class ServicoRetencaoPiloto {
  constructor(private readonly executor:ExecutorTenant,private readonly circulos:ServicoCirculosPiloto) {}
  async limparTenant(tenantId:string):Promise<void> {
    await this.executor.executar(tenantId,async m=>{
      await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`gamificacao317:${tenantId}`]);
      const rows:CirculoPiloto[]=await m.query("select * from circulos_pacientes where tenant_id=$1 and modelo_versao=317 and estado_piloto='ativo' order by id",[tenantId]);
      for(const r of rows) {
        // No user impersonation: internal tenant transaction only, never exposed as HTTP capability.
        const c:ContextoPiloto={m,u:{tenantId,usuarioId:'',papel:'Professional',emailHash:'',permissoes:[]},profissionalId:r.profissional_id};
        const perfis=await this.circulos.perfis(c,r);
        const ativos:{paciente_id:string}[]=await m.query("select paciente_id from membros_circulo where tenant_id=$1 and circulo_id=$2 and estado_piloto='ativo'",[tenantId,r.id]);
        for(const row of ativos) if(!perfis.has(row.paciente_id)) {
          await this.circulos.ocultarAutor(c,r.id,row.paciente_id);
          await m.query("update membros_circulo set estado_piloto='revogado',revogado_em=now(),eliminar_em=now()+interval '90 days',versao_piloto=versao_piloto+1 where tenant_id=$1 and circulo_id=$2 and paciente_id=$3",[tenantId,r.id,row.paciente_id]);
        }
      }
      await m.query(`update membros_circulo set estado_piloto='revogado',revogado_em=convite_expira_em,eliminar_em=convite_expira_em+interval '90 days',versao_piloto=versao_piloto+1 where tenant_id=$1 and estado_piloto='convidado' and convite_expira_em<=now()`,[tenantId]);
      await m.query(`update comentarios_comunidade set conteudo_criptografado=null,estado='excluido' where tenant_id=$1 and eliminar_em<=now() and conteudo_criptografado is not null`,[tenantId]);
      await m.query(`update posts_comunidade set conteudo_criptografado=null,status='excluido' where tenant_id=$1 and modelo_versao=317 and eliminar_em<=now() and conteudo_criptografado is not null`,[tenantId]);
      await m.query(`update revisoes_publicacao set conteudo_criptografado=null where tenant_id=$1 and eliminar_em<=now() and conteudo_criptografado is not null`,[tenantId]);
      // An explicit legal exception retains only the separately encrypted report evidence.
      await m.query(`update denuncias_comunidade set evidencia_criptografada=null,decisao_criptografada=null,hold_justificativa_criptografada=null,hold_autor_usuario_id=null,hold_ate=null where tenant_id=$1 and eliminar_em<=now() and (hold_ate is null or hold_ate<=now())`,[tenantId]);
      await m.query(`update membros_circulo set nome_criptografado=null where tenant_id=$1 and eliminar_em<=now() and estado_piloto in ('saiu','revogado')`,[tenantId]);
      await m.query(`delete from curtidas_comunidade rc where rc.tenant_id=$1 and (exists(select 1 from membros_circulo mb where mb.tenant_id=rc.tenant_id and mb.circulo_id=rc.circulo_id and mb.paciente_id=rc.paciente_id and (mb.estado_piloto<>'ativo' or mb.geracao<>rc.geracao_membro)) or exists(select 1 from posts_comunidade p where p.tenant_id=rc.tenant_id and p.id=rc.post_id and p.status<>'publicado') or exists(select 1 from comentarios_comunidade cm where cm.tenant_id=rc.tenant_id and cm.id=rc.comentario_id and cm.estado<>'publicado'))`,[tenantId]);
      await m.query(`update circulos_pacientes set snapshot_criptografado=null where tenant_id=$1 and modelo_versao=317 and estado_piloto='encerrado' and eliminar_em<=now()`,[tenantId]);

      // Remove identity-bearing community rows too; live legal evidence keeps only FK skeletons.
      await m.query(`delete from denuncias_comunidade where tenant_id=$1 and eliminar_em<=now() and (hold_ate is null or hold_ate<=now())`,[tenantId]);
      await m.query(`delete from revisoes_publicacao where tenant_id=$1 and eliminar_em<=now()`,[tenantId]);
      await m.query(`delete from comentarios_comunidade cm where cm.tenant_id=$1 and cm.eliminar_em<=now() and not exists(select 1 from denuncias_comunidade d where d.tenant_id=cm.tenant_id and d.comentario_id=cm.id) and not exists(select 1 from curtidas_comunidade rc where rc.tenant_id=cm.tenant_id and rc.comentario_id=cm.id)`,[tenantId]);
      await m.query(`delete from posts_comunidade p where p.tenant_id=$1 and p.modelo_versao=317 and p.eliminar_em<=now() and not exists(select 1 from denuncias_comunidade d where d.tenant_id=p.tenant_id and d.post_id=p.id) and not exists(select 1 from comentarios_comunidade cm where cm.tenant_id=p.tenant_id and cm.post_id=p.id) and not exists(select 1 from curtidas_comunidade rc where rc.tenant_id=p.tenant_id and rc.post_id=p.id)`,[tenantId]);
      await m.query(`delete from membros_circulo mb where mb.tenant_id=$1 and mb.estado_piloto in ('saiu','revogado') and mb.eliminar_em<=now() and not exists(select 1 from comentarios_comunidade cm where cm.tenant_id=mb.tenant_id and cm.circulo_id=mb.circulo_id and cm.paciente_id=mb.paciente_id) and not exists(select 1 from denuncias_comunidade d where d.tenant_id=mb.tenant_id and d.circulo_id=mb.circulo_id and d.paciente_id=mb.paciente_id) and not exists(select 1 from curtidas_comunidade rc where rc.tenant_id=mb.tenant_id and rc.circulo_id=mb.circulo_id and rc.paciente_id=mb.paciente_id)`,[tenantId]);
      await m.query(`delete from circulos_pacientes r where r.tenant_id=$1 and r.modelo_versao=317 and r.estado_piloto='encerrado' and r.eliminar_em<=now() and not exists(select 1 from posts_comunidade p where p.tenant_id=r.tenant_id and p.circulo_id=r.id) and not exists(select 1 from membros_circulo mb where mb.tenant_id=r.tenant_id and mb.circulo_id=r.id)`,[tenantId]);
      // Keep nonce tombstones: removing the ledger would permit a late retry to recreate content.
      await m.query(`update comandos_gamificacao set fingerprint_criptografado=null,resultado_criptografado=null,expirado_em=now() where tenant_id=$1 and criado_em<=now()-interval '90 days' and expirado_em is null`,[tenantId]);
    });
  }
}
