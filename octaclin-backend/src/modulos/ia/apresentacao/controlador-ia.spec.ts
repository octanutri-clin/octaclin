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
      'ia:sentimento:tenant:tenant-1',
      expect.objectContaining({ maxTentativas: 120, janelaMs: 15 * 60 * 1000 })
    );
    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledWith(
      'ia:sentimento:tenant-1:usuario-1',
      expect.objectContaining({ maxTentativas: 30, janelaMs: 15 * 60 * 1000 })
    );
    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalledTimes(2);
    expect(protecaoAbuso.consumirTentativa.mock.invocationCallOrder[0])
      .toBeLessThan(servicoIa.analisarSentimento.mock.invocationCallOrder[0]);
  });

  it('nao executa IA quando o limite agregado do tenant e recusado', async () => {
    const protecaoAbuso = {
      consumirTentativa: jest.fn(async (chave: string) => {
        if (chave === 'ia:sentimento:tenant:tenant-1') throw new Error('limite do tenant');
      })
    };
    const servicoIa = { analisarSentimento: jest.fn() };
    const controlador = new ControladorIa(servicoIa as never, { registrar: jest.fn() } as never, protecaoAbuso as never);

    await expect(controlador.analisarSentimento(
      usuario,
      { ip: '127.0.0.1', headers: {} } as never,
      { pacienteId: '11111111-1111-4111-8111-111111111111', texto: 'Relato sintetico.' }
    )).rejects.toThrow('limite do tenant');

    expect(servicoIa.analisarSentimento).not.toHaveBeenCalled();
  });
});
