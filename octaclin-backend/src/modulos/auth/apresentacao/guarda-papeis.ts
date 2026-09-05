import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { registrarAutorizacaoNegada } from './auditoria-autorizacao';
import { CHAVE_PAPEIS } from './decorators';
import { PapelUsuario } from '../dominio/usuario-autenticado';

@Injectable()
export class GuardaPapeis implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: ServicoAuditoria
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<PapelUsuario[]>(CHAVE_PAPEIS, [
      contexto.getHandler(),
      contexto.getClass()
    ]);

    if (!papeis?.length) {
      return true;
    }

    const requisicao = contexto.switchToHttp().getRequest<{ usuarioAutenticado?: { papel: PapelUsuario } }>();
    const papelAtual = requisicao.usuarioAutenticado?.papel;

    if (!papelAtual || !papeis.includes(papelAtual)) {
      // Grava a exigencia da rota, nao o portador: `papeis` e o que o handler
      // pede, e ja e publico no codigo. Ver `auditoria-autorizacao.ts` para a
      // janela de deduplicacao e para o motivo de isto nao poder lancar.
      registrarAutorizacaoNegada(this.auditoria, contexto, { tipo: 'papel', exigido: papeis });
      throw new ForbiddenException('Usuario sem permissao para esta acao.');
    }

    return true;
  }
}
