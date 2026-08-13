import { CHAVE_PAPEIS } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ControladorIa } from './controlador-ia';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['ia.executar']
};

describe('ControladorIa', () => {
  it('restringe o modulo a SuperAdmin e Professional', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorIa)).toEqual(['SuperAdmin', 'Professional']);
  });

  it('consome o limite antes de enviar sentimento ao servico', async () => {
    const protecaoAbuso = { consumirTentativa: jest.fn(async () => undefined) };
    const servicoIa = {
      analisarSentimento: jest.fn(async () => ({ id: 'analise-1', alertaDisparado: false }))
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorIa(servicoIa as never, auditoria as never, protecaoAbuso as never);

    await controlador.analisarSentimento(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: '11111111-1111-4111-8111-111111111111', texto: 'Relato sintetico.' }
    );

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'ia:sentimento:tenant-1:usuario-1',
      expect.objectContaining({ maxTentativas: 30, janelaMs: 15 * 60 * 1000 })
    );
    expect(protecaoAbuso.consumirTentativa.mock.invocationCallOrder[0])
      .toBeLessThan(servicoIa.analisarSentimento.mock.invocationCallOrder[0]);
  });
});
