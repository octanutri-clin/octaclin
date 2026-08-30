import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { PapelUsuario, UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ControladorMobile } from './controlador-mobile';

function contexto(papel: PapelUsuario): ExecutionContext {
  return {
    getClass: () => ControladorMobile,
    getHandler: () => ControladorMobile.prototype.listarDiarioRapido,
    switchToHttp: () => ({
      getRequest: () => ({ usuarioAutenticado: { papel } })
    })
  } as unknown as ExecutionContext;
}

describe('ControladorMobile', () => {
  const guarda = new GuardaPapeis(new Reflector());

  it('deve bloquear Collaborator', () => {
    expect(() => guarda.canActivate(contexto('Collaborator'))).toThrow(ForbiddenException);
  });

  it.each(['Patient', 'Professional', 'SuperAdmin'] as const)('deve permitir %s', (papel) => {
    expect(guarda.canActivate(contexto(papel))).toBe(true);
  });

  describe('confirmarUploadMidia - auditoria de rejeicao', () => {
    const usuario: UsuarioAutenticado = {
      usuarioId: 'usuario-1',
      tenantId: 'tenant-1',
      papel: 'Professional',
      emailHash: 'hash',
      permissoes: []
    };
    const requisicao = { ip: '203.0.113.9', headers: {} } as never;

    it('registra evento de rejeicao e propaga o erro quando a confirmacao falha (malware/dimensao/tamper)', async () => {
      const erroRejeicao = new Error('Conteudo rejeitado pela inspecao antimalware.');
      const servicoMobile = { confirmarUploadMidia: jest.fn().mockRejectedValue(erroRejeicao) };
      const servicoAuditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      const protecaoAbuso = { consumirTentativa: jest.fn().mockResolvedValue(undefined) };
      const controlador = new ControladorMobile(servicoMobile as never, servicoAuditoria as never, protecaoAbuso as never);

      await expect(controlador.confirmarUploadMidia(usuario, requisicao, 'arquivo-1')).rejects.toThrow(erroRejeicao);

      expect(servicoAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          acao: 'mobile.midia.upload_rejeitado',
          recursoTipo: 'arquivo_midia',
          recursoId: 'arquivo-1'
        })
      );
      // O evento de rejeicao nao carrega o texto do erro nem qualquer campo de conteudo/scanner.
      const eventoRegistrado = servicoAuditoria.registrar.mock.calls[0][0];
      expect(JSON.stringify(eventoRegistrado)).not.toContain('antimalware');
    });

    it('nao registra evento de rejeicao quando a confirmacao e bem-sucedida', async () => {
      const servicoMobile = {
        confirmarUploadMidia: jest.fn().mockResolvedValue({ pacienteId: 'paciente-1', mimeType: 'image/jpeg', tamanhoBytes: '10' })
      };
      const servicoAuditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      const protecaoAbuso = { consumirTentativa: jest.fn().mockResolvedValue(undefined) };
      const controlador = new ControladorMobile(servicoMobile as never, servicoAuditoria as never, protecaoAbuso as never);

      await controlador.confirmarUploadMidia(usuario, requisicao, 'arquivo-1');

      expect(servicoAuditoria.registrar).toHaveBeenCalledTimes(1);
      expect(servicoAuditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'mobile.midia.upload_confirmar' })
      );
    });
  });
});
