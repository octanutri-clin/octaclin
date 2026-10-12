import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirAutorProfissional } from '../dominio/piloto-gamificacao';
import { ComandoPiloto, ContextoGamificacaoPiloto, ContextoPiloto } from './contexto-piloto';
import { PaginaPiloto } from './servico-conquistas-piloto';
import { ServicoPublicacoesPiloto } from './servico-publicacoes-piloto';

export interface EvidenciaDenuncia { motivo:string;texto:string;autor:string;versaoConteudo:number }
interface Denuncia {id:string;post_id:string;comentario_id:string|null;versao:number;estado:string;evidencia_criptografada:Buffer|null;criado_em:Date;criado_texto:string;eliminar_em:Date}
@Injectable()
export class ServicoModeracaoPiloto {
  constructor(private readonly base:ContextoGamificacaoPiloto,private readonly publicacoes:ServicoPublicacoesPiloto) {}
  private texto(v:string,max:number) {
    if(!v?.trim() || [...v].length>max) throw new BadRequestException('Confira a justificativa e seu limite.');return v.trim();
  }
  async denunciar(u:UsuarioAutenticado,id:string,postId:string,comentarioId:string|undefined,d:ComandoPiloto & {motivo:string}) {
    if(u.papel!=='Patient') throw new ForbiddenException('Acao exclusiva do paciente.');
    const motivo=this.texto(d.motivo,1000);
    return this.base.executar(u,'comunidade',async c=>{
      const a=await this.publicacoes.ambiente(c,id),alvo=comentarioId ? await this.publicacoes.comentario(a,postId,comentarioId) : await this.publicacoes.post(a,postId);
      return this.base.comando(c,'denuncia.criar',`${id}:${alvo.id}`,d,{motivo},async()=>{
        const versao='versao' in alvo ? alvo.versao : alvo.versao_piloto;this.base.versao(versao,d.versaoEsperada);
        const denunciaId=randomUUID();
        const evidencia:EvidenciaDenuncia={motivo,autor:a.perfis.get(alvo.paciente_id)!.nome,versaoConteudo:versao,texto:this.base.conteudo.ler<string>(`${u.tenantId}:${comentarioId ? 'comentario' : 'post'}:${alvo.id}:${versao}`,alvo.conteudo_criptografado)};
        await c.m.query(`insert into denuncias_comunidade(id,tenant_id,circulo_id,post_id,comentario_id,paciente_id,evidencia_criptografada) values($1,$2,$3,$4,$5,$6,$7)`,[denunciaId,u.tenantId,id,postId,comentarioId ?? null,c.paciente!.id,this.base.conteudo.cifrar(`${u.tenantId}:denuncia:${denunciaId}:evidencia`,evidencia)]);
        return {id:denunciaId,versao:1,estado:'aberta'};
      },'denuncia');
    });
  }
  /** Restricted evidence never grants access to patients transferred out of the current wallet. */
  private async linhas(c:ContextoPiloto,id:string,denunciaId?:string,pagina?:PaginaPiloto) {
    const escopo=`${c.u.tenantId}:${c.u.usuarioId}:denuncias:${id}`;
    const cursor=pagina?.cursor ? this.base.conteudo.abrirCursor<{data:string;id:string}>(escopo,pagina.cursor) : undefined;
    const rows:Denuncia[]=await c.m.query(`select d.*,d.criado_em::text as criado_texto from denuncias_comunidade d
      join posts_comunidade p on p.tenant_id=d.tenant_id and p.circulo_id=d.circulo_id and p.id=d.post_id
      left join comentarios_comunidade cm on cm.tenant_id=d.tenant_id and cm.id=d.comentario_id
      join pacientes denunciante on denunciante.tenant_id=d.tenant_id and denunciante.id=d.paciente_id
      join pacientes autor on autor.tenant_id=d.tenant_id and autor.id=coalesce(cm.paciente_id,p.paciente_id)
      where d.tenant_id=$1 and d.circulo_id=$2 and denunciante.profissional_responsavel_id=$3 and autor.profissional_responsavel_id=$3
        and denunciante.arquivado_em is null and autor.arquivado_em is null and denunciante.status_ciclo_vida='ACTIVE' and autor.status_ciclo_vida='ACTIVE'
        and d.evidencia_criptografada is not null and (d.eliminar_em>now() or d.hold_ate>now())
        and ($4::uuid is null or d.id=$4) and ($5::timestamptz is null or (d.criado_em,d.id)<($5::timestamptz,$6::uuid))
        order by d.criado_em desc,d.id desc limit 21`,[c.u.tenantId,id,c.profissionalId,denunciaId ?? null,cursor?.data ?? null,cursor?.id ?? null]);
    return {rows,escopo};
  }
  async listar(u:UsuarioAutenticado,id:string,pagina:PaginaPiloto) {
    exigirAutorProfissional(u);
    return this.base.executar(u,'comunidade',async c=>{
      await this.publicacoes.circulos.circulo(c,id,true);
      const {rows,escopo}=await this.linhas(c,id,undefined,pagina),slice=rows.slice(0,20),last=slice.at(-1);
      return {itens:slice.map(r=>({id:r.id,postId:r.post_id,...(r.comentario_id ? {comentarioId:r.comentario_id} : {}),versao:r.versao,estado:r.estado,criadoEm:r.criado_em,eliminarEm:r.eliminar_em,evidencia:this.base.conteudo.ler<EvidenciaDenuncia>(`${u.tenantId}:denuncia:${r.id}:evidencia`,r.evidencia_criptografada!)})),temMais:rows.length>20,...(rows.length>20 && last ? {proximoCursor:this.base.conteudo.cursor(escopo,{data:last.criado_texto,id:last.id})} : {})};
    });
  }
  async decidir(u:UsuarioAutenticado,id:string,denunciaId:string,d:ComandoPiloto & {retirar:boolean;justificativa:string}) {
    exigirAutorProfissional(u);const justificativa=this.texto(d.justificativa,1000);
    return this.base.executar(u,'comunidade',async c=>{
      await this.publicacoes.circulos.circulo(c,id,true);const {rows}=await this.linhas(c,id,denunciaId),row=rows[0];
      if(!row) throw new NotFoundException('Denuncia nao encontrada no escopo.');
      return this.base.comando(c,'moderacao.decidir',`${id}:${denunciaId}`,d,{retirar:d.retirar,justificativa},async()=>{
        this.base.versao(row.versao,d.versaoEsperada);
        if(row.estado!=='aberta') throw new ForbiddenException('Denuncia ja revisada.');
        if(d.retirar) await this.publicacoes.ocultarAlvo(c,id,row.post_id,row.comentario_id ?? undefined);
        await c.m.query(`update denuncias_comunidade set estado=$4,versao=versao+1,revisado_por_usuario_id=$5,decisao_criptografada=$6 where tenant_id=$1 and circulo_id=$2 and id=$3`,[u.tenantId,id,denunciaId,d.retirar ? 'retirada' : 'mantida',u.usuarioId,this.base.conteudo.cifrar(`${u.tenantId}:denuncia:${denunciaId}:decisao`,{justificativa,retirar:d.retirar})]);
        return {id:denunciaId,versao:row.versao+1,estado:d.retirar ? 'retirada' : 'mantida'};
      });
    });
  }
}
