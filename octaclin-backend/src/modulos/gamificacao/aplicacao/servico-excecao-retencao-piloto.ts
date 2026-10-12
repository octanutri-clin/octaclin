import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirGestorPiloto } from '../dominio/piloto-gamificacao';
import { ComandoPiloto, ContextoGamificacaoPiloto } from './contexto-piloto';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';

export interface ExcecaoRetencao extends ComandoPiloto { holdAte:string;justificativa:string;confirmacaoLegal:boolean }
export interface LinhaRetencaoPiloto { id:string; versao:number; eliminarEm:string; holdAte:string|null }
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Injectable()
export class ServicoExcecaoRetencaoPiloto {
  constructor(private readonly config:ServicoConfiguracaoPiloto,private readonly base:ContextoGamificacaoPiloto) {}
  async listar(u:UsuarioAutenticado,cursor?:string) {
    exigirGestorPiloto(u);
    if(u.papel!=='Client') throw new ForbiddenException('Excecao legal exclusiva do gestor da propria clinica.');
    let depois:{eliminarEm:string;id:string}|undefined;
    if(cursor) {
      try {
        const valor=this.base.conteudo.abrirCursor<Record<string,unknown>>(`retencao:${u.tenantId}`,cursor);
        if(Object.keys(valor).sort().join(',')!=='eliminarEm,id'||typeof valor.eliminarEm!=='string'||!Number.isFinite(Date.parse(valor.eliminarEm))||typeof valor.id!=='string'||!UUID.test(valor.id)) throw new Error();
        depois={eliminarEm:valor.eliminarEm,id:valor.id};
      } catch { throw new BadRequestException('Cursor de retencao invalido.'); }
    }
    return this.config.executarAdministrativo(u.tenantId,u,async m=>{
      const rows:LinhaRetencaoPiloto[]=await m.query(`select id,versao,eliminar_em::text as "eliminarEm",hold_ate::text as "holdAte"
        from denuncias_comunidade where tenant_id=$1 and evidencia_criptografada is not null
        and (eliminar_em>now() or hold_ate>now())
        and ($2::timestamptz is null or (eliminar_em,id)>($2::timestamptz,$3::uuid))
        order by eliminar_em,id limit 101`,[u.tenantId,depois?.eliminarEm??null,depois?.id??null]);
      const temMais=rows.length>100,itens=rows.slice(0,100).map(row=>({id:row.id,versao:Number(row.versao),eliminarEm:row.eliminarEm,holdAte:row.holdAte}));
      const ultimo=itens.at(-1);
      const proximoCursor=temMais&&ultimo?this.base.conteudo.cursor(`retencao:${u.tenantId}`,{eliminarEm:ultimo.eliminarEm,id:ultimo.id}):undefined;
      return {itens,temMais,...(proximoCursor?{proximoCursor}:{})};
    });
  }
  async registrar(tenantId:string,u:UsuarioAutenticado,denunciaId:string,d:ExcecaoRetencao) {
    exigirGestorPiloto(u);
    if(u.papel!=='Client' || tenantId!==u.tenantId) throw new ForbiddenException('Excecao legal exclusiva do gestor da propria clinica.');
    const prazo=new Date(d.holdAte),agora=Date.now();
    if(d.confirmacaoLegal!==true || !Number.isFinite(prazo.getTime()) || prazo.getTime()<=agora || prazo.getTime()>agora+90*86400000 || !d.justificativa?.trim() || d.justificativa.length>1000) throw new BadRequestException('Informe necessidade legal confirmada, justificativa e prazo de revisao de ate 90 dias.');
    return this.config.executarAdministrativo(tenantId,u,async m=>{
      await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`gamificacao317:${tenantId}`]);
      const [row]=await m.query('select versao,eliminar_em from denuncias_comunidade where tenant_id=$1 and id=$2 and evidencia_criptografada is not null and (eliminar_em>now() or hold_ate>now()) for update',[tenantId,denunciaId]);
      if(!row) throw new NotFoundException('Registro de retencao nao encontrado.');
      if(prazo.getTime()<=new Date(row.eliminar_em).getTime()) throw new BadRequestException('A excecao deve superar o prazo ordinario.');
      const contexto={m,u:{...u,tenantId}};
      return this.base.comando(contexto,'retencao.excecao',denunciaId,d,{holdAte:d.holdAte,justificativa:d.justificativa,confirmacaoLegal:true},async()=>{
        this.base.versao(row.versao,d.versaoEsperada);
        await m.query('update denuncias_comunidade set hold_ate=$3,hold_justificativa_criptografada=$4,hold_autor_usuario_id=$5,versao=versao+1 where tenant_id=$1 and id=$2',[tenantId,denunciaId,prazo,this.base.conteudo.cifrar(`${tenantId}:denuncia:${denunciaId}:excecao`,{justificativa:d.justificativa.trim()}),u.usuarioId]);
        return {id:denunciaId,versao:row.versao+1,holdAte:prazo.toISOString()};
      });
    });
  }
}
