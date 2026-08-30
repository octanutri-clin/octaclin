import { UnauthorizedException } from '@nestjs/common';
import { ServicoReautenticacao } from './servico-reautenticacao';

const USUARIO = {
  usuarioId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  sessaoId: '33333333-3333-4333-8333-333333333333',
  papel: 'SuperAdmin' as const,
  emailHash: 'hash-sintetico',
  permissoes: [],
  mfaVerificado: true
};

function criarServico(senhaValida = true) {
  const conta = { id: USUARIO.usuarioId, tenantId: USUARIO.tenantId, ativo: true, senhaHash: 'hash' };
  const repositorio = { findOne: jest.fn(async () => conta) };
  const executor = {
    executar: jest.fn(async (_tenantId, operacao) => operacao({ getRepository: () => repositorio }))
  };
  const jwt = {
    signAsync: jest.fn(async () => 'prova-sintetica'),
    verifyAsync: jest.fn(async () => ({
      tipo: 'reautenticacao',
      sub: USUARIO.usuarioId,
      tenantId: USUARIO.tenantId,
      sid: USUARIO.sessaoId
    }))
  };
  const senhas = { verificar: jest.fn(() => senhaValida) };
  const protecaoAbuso = {
    verificarDisponibilidade: jest.fn(async () => undefined),
    registrarFalha: jest.fn(async () => undefined),
    registrarSucesso: jest.fn(async () => undefined)
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  return {
    servico: new ServicoReautenticacao(
      executor as never,
      jwt as never,
      senhas as never,
      protecaoAbuso as never,
      auditoria as never
    ),
    executor,
    jwt,
    protecaoAbuso,
    auditoria
  };
}

describe('ServicoReautenticacao', () => {
  it('recusa reautenticacao privilegiada quando a sessao nao passou por MFA', async () => {
    const { servico, executor } = criarServico();

    await expect(servico.reautenticar({ ...USUARIO, mfaVerificado: false }, 'SenhaValida123'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(executor.executar).not.toHaveBeenCalled();
  });

  it('emite prova curta vinculada ao tenant, usuario e sessao apos validar a senha', async () => {
    const { servico, jwt } = criarServico();

    await expect(servico.reautenticar(USUARIO, 'SenhaValida123')).resolves.toEqual({
      prova: 'prova-sintetica',
      expiraEmSegundos: 300
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: USUARIO.usuarioId, tenantId: USUARIO.tenantId, sid: USUARIO.sessaoId }),
      expect.objectContaining({ expiresIn: '5m' })
    );
  });

  it('recusa senha incorreta sem emitir prova', async () => {
    const { servico, jwt } = criarServico(false);

    await expect(servico.reautenticar(USUARIO, 'SenhaIncorreta123')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('recusa prova vinculada a outra sessao', async () => {
    const { servico, jwt } = criarServico();
    jwt.verifyAsync.mockResolvedValueOnce({
      tipo: 'reautenticacao',
      sub: USUARIO.usuarioId,
      tenantId: USUARIO.tenantId,
      sid: 'sessao-intrusa'
    });

    await expect(servico.validarProva('prova', {
      tenantId: USUARIO.tenantId,
      usuarioId: USUARIO.usuarioId,
      sessaoId: USUARIO.sessaoId
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
