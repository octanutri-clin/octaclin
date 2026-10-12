import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { exigirGestorPiloto } from '../dominio/piloto-gamificacao';
import { ComandoPiloto, ContextoGamificacaoPiloto } from './contexto-piloto';
import { ServicoConfiguracaoPiloto } from './servico-configuracao-piloto';

export interface ExcecaoRetencao extends ComandoPiloto { holdAte:string;justificativa:string;confirmacaoLegal:boolean }
@Injectable()
export class ServicoExcecaoRetencaoPiloto {
  constructor(private readonly config:ServicoConfiguracaoPiloto,private readonly base:ContextoGamificacaoPiloto) {}
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
