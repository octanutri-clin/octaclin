import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ComandoPiloto, ContextoGamificacaoPiloto, ContextoPiloto } from './contexto-piloto';
import { CirculoPiloto, PerfilMembro, ServicoCirculosPiloto } from './servico-circulos-piloto';
import { PaginaPiloto } from './servico-conquistas-piloto';

interface PostPiloto { id:string;paciente_id:string;autor_usuario_id:string;geracao_membro:number;versao_piloto:number;status:string;conteudo_criptografado:Buffer;criado_em:Date;criado_texto:string }
interface ComentarioPiloto { id:string;paciente_id:string;autor_usuario_id:string;geracao_membro:number;versao:number;estado:string;conteudo_criptografado:Buffer;criado_em:Date;criado_texto:string }
export interface AmbientePublicacao { c:ContextoPiloto;r:CirculoPiloto;perfis:Map<string,PerfilMembro> }

@Injectable()
export class ServicoPublicacoesPiloto {
  constructor(readonly base:ContextoGamificacaoPiloto,readonly circulos:ServicoCirculosPiloto) {}
  private paciente(u:UsuarioAutenticado) { if(u.papel!=='Patient') throw new ForbiddenException('Acesso exclusivo do paciente.'); }
  private texto(texto:string,max:number) { if(!texto?.trim() || [...texto].length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(texto)) throw new BadRequestException('Confira o texto e seu limite.');return texto.trim(); }
  async ambiente(c:ContextoPiloto,id:string):Promise<AmbientePublicacao> {
    const r=await this.circulos.circulo(c,id);
    const perfis=c.paciente ? (await this.circulos.participante(c,r)).perfis : await this.circulos.perfis(c,r);
    return {c,r,perfis};
  }
  private autorValido(a:AmbientePublicacao,r:{paciente_id:string;geracao_membro:number;autor_usuario_id:string}) {
    const actor=a.perfis.get(r.paciente_id);
    return actor?.geracao===r.geracao_membro && actor.usuario_aceite_id===r.autor_usuario_id ? actor : undefined;
  }
  async post(a:AmbientePublicacao,id:string,retirado=false):Promise<PostPiloto> {
    const [row]=await a.c.m.query(`select *,criado_em::text as criado_texto from posts_comunidade where tenant_id=$1 and circulo_id=$2 and id=$3 and modelo_versao=317 for update`,[a.c.u.tenantId,a.r.id,id]);
    if(!row || !this.autorValido(a,row) || (!retirado && row.status!=='publicado')) throw new NotFoundException('Publicacao nao encontrada no escopo.');
    return row;
  }
  async comentario(a:AmbientePublicacao,postId:string,id:string,retirado=false):Promise<ComentarioPiloto> {
    await this.post(a,postId);
    const [row]=await a.c.m.query(`select *,criado_em::text as criado_texto from comentarios_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and id=$4 for update`,[a.c.u.tenantId,a.r.id,postId,id]);
    if(!row || !this.autorValido(a,row) || (!retirado && row.estado!=='publicado')) throw new NotFoundException('Comentario nao encontrado no escopo.');
    return row;
  }
  async publicar(u:UsuarioAutenticado,id:string,d:ComandoPiloto & {texto:string}) {
    this.paciente(u);const texto=this.texto(d.texto,2000);
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id),m=a.perfis.get(c.paciente!.id)!;
      return this.base.comando(c,'conteudo.post.publicar',id,d,{texto},async()=>{
        if(d.versaoEsperada!==0) throw new BadRequestException('Versao inicial invalida.');
        const postId=randomUUID(),bytes=this.base.conteudo.cifrar(`${u.tenantId}:post:${postId}:1`,texto);
        await c.m.query(`insert into posts_comunidade(id,tenant_id,circulo_id,paciente_id,conteudo,status,modelo_versao,autor_usuario_id,geracao_membro,conteudo_criptografado)
          values($1,$2,$3,$4,'Conteudo privado','publicado',317,$5,$6,$7)`,[postId,u.tenantId,id,c.paciente!.id,u.usuarioId,m.geracao,bytes]);
        await c.m.query(`insert into revisoes_publicacao(tenant_id,circulo_id,post_id,versao,conteudo_criptografado) values($1,$2,$3,1,$4)`,[u.tenantId,id,postId,bytes]);
        return {id:postId,versao:1,estado:'publicado'};
      },'conteudo');
    });
  }
  async comentar(u:UsuarioAutenticado,id:string,postId:string,d:ComandoPiloto & {texto:string}) {
    this.paciente(u);const texto=this.texto(d.texto,500);
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id);await this.post(a,postId);const m=a.perfis.get(c.paciente!.id)!;
      return this.base.comando(c,'conteudo.comentario.publicar',`${id}:${postId}`,d,{texto},async()=>{
        if(d.versaoEsperada!==0) throw new BadRequestException('Versao inicial invalida.');
        const commentId=randomUUID(),bytes=this.base.conteudo.cifrar(`${u.tenantId}:comentario:${commentId}:1`,texto);
        await c.m.query(`insert into comentarios_comunidade(id,tenant_id,circulo_id,post_id,paciente_id,autor_usuario_id,geracao_membro,conteudo_criptografado)
          values($1,$2,$3,$4,$5,$6,$7,$8)`,[commentId,u.tenantId,id,postId,c.paciente!.id,u.usuarioId,m.geracao,bytes]);
        await c.m.query(`insert into revisoes_publicacao(tenant_id,circulo_id,post_id,comentario_id,versao,conteudo_criptografado) values($1,$2,$3,$4,1,$5)`,[u.tenantId,id,postId,commentId,bytes]);
        return {id:commentId,versao:1,estado:'publicado'};
      },'conteudo');
    });
  }
  async curtir(u:UsuarioAutenticado,id:string,postId:string,comentarioId:string|undefined,d:ComandoPiloto & {curti:boolean}) {
    this.paciente(u);
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id),post=await this.post(a,postId),comment=comentarioId ? await this.comentario(a,postId,comentarioId) : undefined;
      const alvo=comentarioId ?? postId,m=a.perfis.get(c.paciente!.id)!;
      return this.base.comando(c,'reacao.definir',`${id}:${alvo}`,d,{curti:d.curti},async()=>{
        this.base.versao(comment?.versao ?? post.versao_piloto,d.versaoEsperada);
        if(d.curti) await c.m.query(`insert into curtidas_comunidade(tenant_id,circulo_id,post_id,comentario_id,paciente_id,geracao_membro)
          values($1,$2,$3,$4,$5,$6) on conflict(tenant_id,circulo_id,post_id,comentario_id,paciente_id) do update set geracao_membro=$6`,[u.tenantId,id,postId,comentarioId ?? null,c.paciente!.id,m.geracao]);
        else await c.m.query(`delete from curtidas_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and comentario_id is not distinct from $4::uuid and paciente_id=$5`,[u.tenantId,id,postId,comentarioId ?? null,c.paciente!.id]);
        return {id:alvo,curti:d.curti,versao:comment?.versao ?? post.versao_piloto};
      },'reacao');
    });
  }
  private chavesAutores(a:AmbientePublicacao) {
    return [...a.perfis.values()].map(m=>`${m.paciente_id}:${m.geracao}:${m.usuario_aceite_id}`);
  }
  private async reacoes(a:AmbientePublicacao,postId:string,comentarioId?:string) {
    const rows: {paciente_id:string;geracao_membro:number}[]=await a.c.m.query(`select paciente_id,geracao_membro from curtidas_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and comentario_id is not distinct from $4::uuid`,[a.c.u.tenantId,a.r.id,postId,comentarioId ?? null]);
    const validas=rows.filter(r=>a.perfis.get(r.paciente_id)?.geracao===r.geracao_membro);
    return {total:validas.length,curti:validas.some(r=>r.paciente_id===a.c.paciente?.id)};
  }
  async feed(u:UsuarioAutenticado,id:string,pagina:PaginaPiloto) {
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id),escopo=`${u.tenantId}:${u.usuarioId}:feed:${id}`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{data:string;id:string}>(escopo,pagina.cursor) : undefined;
      const rows:PostPiloto[]=await c.m.query(`select *,criado_em::text as criado_texto from posts_comunidade where tenant_id=$1 and circulo_id=$2 and modelo_versao=317 and status='publicado'
        and concat(paciente_id,':',geracao_membro,':',autor_usuario_id)=any($3::text[])
        and ($4::timestamptz is null or (criado_em,id)<($4::timestamptz,$5::uuid)) order by criado_em desc,id desc limit 21`,[u.tenantId,id,this.chavesAutores(a),cursor?.data ?? null,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      const itens=await Promise.all(slice.map(async row=>({id:row.id,texto:this.base.conteudo.ler<string>(`${u.tenantId}:post:${row.id}:${row.versao_piloto}`,row.conteudo_criptografado),autor:this.autorValido(a,row)!.nome,criadoEm:row.criado_em,versao:row.versao_piloto,proprio:row.paciente_id===c.paciente?.id,reacoes:await this.reacoes(a,row.id)})));
      return {itens,temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{data:last.criado_texto,id:last.id})} : {})};
    });
  }
  async comentarios(u:UsuarioAutenticado,id:string,postId:string,pagina:PaginaPiloto) {
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id);await this.post(a,postId);
      const escopo=`${u.tenantId}:${u.usuarioId}:comentarios:${id}:${postId}`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{data:string;id:string}>(escopo,pagina.cursor) : undefined;
      const rows:ComentarioPiloto[]=await c.m.query(`select *,criado_em::text as criado_texto from comentarios_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and estado='publicado'
        and concat(paciente_id,':',geracao_membro,':',autor_usuario_id)=any($4::text[])
        and ($5::timestamptz is null or (criado_em,id)<($5::timestamptz,$6::uuid)) order by criado_em desc,id desc limit 21`,[u.tenantId,id,postId,this.chavesAutores(a),cursor?.data ?? null,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      const itens=await Promise.all(slice.map(async row=>({id:row.id,texto:this.base.conteudo.ler<string>(`${u.tenantId}:comentario:${row.id}:${row.versao}`,row.conteudo_criptografado),autor:this.autorValido(a,row)!.nome,criadoEm:row.criado_em,versao:row.versao,proprio:row.paciente_id===c.paciente?.id,reacoes:await this.reacoes(a,postId,row.id)})));
      return {itens,temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{data:last.criado_texto,id:last.id})} : {})};
    });
  }
  async quemCurtiu(u:UsuarioAutenticado,id:string,postId:string,comentarioId:string|undefined,pagina:PaginaPiloto) {
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id);await this.post(a,postId);if(comentarioId) await this.comentario(a,postId,comentarioId);
      const escopo=`${u.tenantId}:${u.usuarioId}:curtidas:${id}:${postId}:${comentarioId ?? 'post'}`;
      const cursor=pagina.cursor ? this.base.conteudo.abrirCursor<{data:string;id:string}>(escopo,pagina.cursor) : undefined;
      const validos=[...a.perfis.values()].map(m=>`${m.paciente_id}:${m.geracao}`);
      const rows:{id:string;paciente_id:string;criado_texto:string}[]=await c.m.query(`select id,paciente_id,criado_em::text as criado_texto from curtidas_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and comentario_id is not distinct from $4::uuid
        and concat(paciente_id,':',geracao_membro)=any($5::text[])
        and ($6::timestamptz is null or (criado_em,id)<($6::timestamptz,$7::uuid)) order by criado_em desc,id desc limit 21`,[u.tenantId,id,postId,comentarioId ?? null,validos,cursor?.data ?? null,cursor?.id ?? null]);
      const slice=rows.slice(0,20),last=slice.at(-1);
      return {itens:slice.map(row=>({nome:a.perfis.get(row.paciente_id)!.nome})),temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{data:last.criado_texto,id:last.id})} : {})};
    });
  }

  async editar(u:UsuarioAutenticado,id:string,postId:string,comentarioId:string|undefined,d:ComandoPiloto & {texto:string}) {
    this.paciente(u);const texto=this.texto(d.texto,comentarioId ? 500 : 2000);
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id),row=comentarioId ? await this.comentario(a,postId,comentarioId) : await this.post(a,postId);
      if(row.paciente_id!==c.paciente!.id || row.autor_usuario_id!==u.usuarioId) throw new ForbiddenException('Somente o autor pode editar.');
      return this.base.comando(c,'conteudo.editar',`${id}:${row.id}`,d,{texto},async()=>{
        const versao=('versao' in row ? row.versao : row.versao_piloto)+1;
        this.base.versao(versao-1,d.versaoEsperada);
        const bytes=this.base.conteudo.cifrar(`${u.tenantId}:${comentarioId ? 'comentario' : 'post'}:${row.id}:${versao}`,texto);
        if(comentarioId) await c.m.query('update comentarios_comunidade set versao=$4,conteudo_criptografado=$5 where tenant_id=$1 and circulo_id=$2 and id=$3',[u.tenantId,id,row.id,versao,bytes]);
        else await c.m.query('update posts_comunidade set versao_piloto=$4,conteudo_criptografado=$5 where tenant_id=$1 and circulo_id=$2 and id=$3',[u.tenantId,id,row.id,versao,bytes]);
        await c.m.query('insert into revisoes_publicacao(tenant_id,circulo_id,post_id,comentario_id,versao,conteudo_criptografado) values($1,$2,$3,$4,$5,$6)',[u.tenantId,id,postId,comentarioId ?? null,versao,bytes]);
        return {id:row.id,versao,estado:'publicado'};
      },'conteudo');
    });
  }
  async ocultarAlvo(c:ContextoPiloto,id:string,postId:string,comentarioId?:string) {
    if(comentarioId) await c.m.query(`update comentarios_comunidade set estado='retirado',versao=versao+1,retirado_em=coalesce(retirado_em,now()),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days') where tenant_id=$1 and circulo_id=$2 and post_id=$3 and id=$4 and estado='publicado'`,[c.u.tenantId,id,postId,comentarioId]);
    else {
      await c.m.query(`update posts_comunidade set status='retirado',versao_piloto=versao_piloto+1,retirado_em=coalesce(retirado_em,now()),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days') where tenant_id=$1 and circulo_id=$2 and id=$3 and modelo_versao=317 and status='publicado'`,[c.u.tenantId,id,postId]);
      await c.m.query(`update comentarios_comunidade set estado='oculto',versao=versao+1,retirado_em=coalesce(retirado_em,now()),eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days') where tenant_id=$1 and circulo_id=$2 and post_id=$3 and estado='publicado'`,[c.u.tenantId,id,postId]);
    }
    await c.m.query(`update revisoes_publicacao set eliminar_em=least(coalesce(eliminar_em,now()+interval '90 days'),now()+interval '90 days') where tenant_id=$1 and circulo_id=$2 and post_id=$3 and ($4::uuid is null or comentario_id=$4)`,[c.u.tenantId,id,postId,comentarioId ?? null]);
    await c.m.query('delete from curtidas_comunidade where tenant_id=$1 and circulo_id=$2 and post_id=$3 and ($4::uuid is null or comentario_id=$4)',[c.u.tenantId,id,postId,comentarioId ?? null]);
  }
  async retirar(u:UsuarioAutenticado,id:string,postId:string,comentarioId:string|undefined,d:ComandoPiloto) {
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.ambiente(c,id),row=comentarioId ? await this.comentario(a,postId,comentarioId,true) : await this.post(a,postId,true);
      if(c.paciente && (row.paciente_id!==c.paciente.id || row.autor_usuario_id!==u.usuarioId)) throw new ForbiddenException('Somente o autor pode retirar.');
      return this.base.comando(c,'conteudo.retirar',`${id}:${row.id}`,d,{},async()=>{
        const versao='versao' in row ? row.versao : row.versao_piloto;
        this.base.versao(versao,d.versaoEsperada);await this.ocultarAlvo(c,id,postId,comentarioId);
        return {id:row.id,estado:'retirado',versao:versao+1};
      });
    });
  }

}
