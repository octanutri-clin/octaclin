import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { possuiPermissao, type PermissaoOctaClin } from '../../auth/dominio/permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { SessaoUsuarioOrm } from '../../auth/infraestrutura/sessao-usuario.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';

/** Política existente; consultar após lock do questionário e antes do profissional/paciente.
 * Worker recebe ator persistido, HTTP exige também a sessão atual. Não carregar segredos.
 */
export async function revalidarAtorQuestionarios(m:EntityManager,tenantId:string,atorId:string,
  permissao:PermissaoOctaClin,usuario?:UsuarioAutenticado){
  const identidade=await m.getRepository(UsuarioOrm).findOne({where:{id:atorId,tenantId,ativo:true},
    select:{id:true,role:true},lock:{mode:'pessimistic_read'}});
  if(!identidade||(usuario&&(usuario.tenantId!==tenantId||usuario.usuarioId!==atorId||identidade.role!==usuario.papel)))
    throw new UnauthorizedException('Acesso alterado. Confira sua autorização.');
  if(!['SuperAdmin','Professional','Collaborator','Patient','Client'].includes(identidade.role)||!possuiPermissao(identidade.role,permissao))
    throw new ForbiddenException('Sem permissão para esta consulta ou operação.');
  let sessaoExpiraEm:Date|undefined;
  if(usuario){
    if(!usuario.sessaoId)throw new UnauthorizedException('Sessão não disponível.');
    const sessao=await m.getRepository(SessaoUsuarioOrm).findOne({where:{id:usuario.sessaoId,tenantId,usuarioId:atorId,revogadoEm:IsNull()},
      select:{id:true,expiraEm:true},lock:{mode:'pessimistic_read'}});
    if(!sessao||sessao.expiraEm.getTime()<=Date.now())throw new UnauthorizedException('Sessão encerrada.');
    sessaoExpiraEm=sessao.expiraEm;
  }
  return {papel:identidade.role,sessaoExpiraEm};
}
