import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { registrarAutorizacaoNegada } from './auditoria-autorizacao';
import { CHAVE_PERMISSOES } from './decorators';
import type { PermissaoOctaClin } from '../dominio/permissoes';

@Injectable()
export class GuardaPermissoes implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: ServicoAuditoria
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permissoesExigidas = this.reflector.getAllAndOverride<PermissaoOctaClin[]>(CHAVE_PERMISSOES, [
      contexto.getHandler(),
      contexto.getClass()
    ]);

    if (!permissoesExigidas?.length) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<{ usuarioAutenticado?: { permissoes?: PermissaoOctaClin[] } }>();
    const permissoesUsuario = requisicao.usuarioAutenticado?.permissoes ?? [];
    const faltantes = permissoesExigidas.filter((permissao) => !permissoesUsuario.includes(permissao));

    if (faltantes.length) {
      // So o que faltou, nunca `permissoesUsuario`. A diferenca importa: a lista
      // do portador descreve tudo que aquela credencial abre, e a trilha e lida
      // por perfis que triam 403 sem precisar desse inventario. `faltantes` e
      // subconjunto da exigencia declarada no handler, que ja e publica.
      registrarAutorizacaoNegada(this.auditoria, contexto, { tipo: 'permissao', exigido: faltantes });
      throw new ForbiddenException('Usuario sem permissao para esta acao.');
    }

    return true;
  }
}
