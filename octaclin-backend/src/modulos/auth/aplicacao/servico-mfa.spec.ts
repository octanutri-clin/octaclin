import { UnauthorizedException } from '@nestjs/common';
import { MfaCodigoRecuperacaoOrm } from '../infraestrutura/mfa-codigo-recuperacao.orm';
import { MfaDesafioOrm } from '../infraestrutura/mfa-desafio.orm';
import { MfaFatorUsuarioOrm } from '../infraestrutura/mfa-fator-usuario.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ServicoMfa } from './servico-mfa';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USUARIO = '22222222-2222-4222-8222-222222222222';
const DESAFIO = '33333333-3333-4333-8333-333333333333';
const SEGREDO = 'JBSWY3DPEHPK3PXP';
const CONTA = {
  id: USUARIO,
  tenantId: TENANT,
  role: 'SuperAdmin',
  ativo: true,
  emailHash: 'hash',
  emailCriptografado: Buffer.from('email'),
  senhaHash: 'hash-senha'
} as UsuarioOrm;

function criarCenario(opcoes: {
  fator?: Partial<MfaFatorUsuarioOrm> | null;
  desafio?: Partial<MfaDesafioOrm> | null;
  totpValido?: boolean;
  atualizacaoFatorAfetada?: number;
  atualizacaoDesafioAfetada?: number;
  codigoRecuperacaoAfetado?: number;
} = {}) {
  let fator = opcoes.fator === undefined ? null : opcoes.fator;
  const desafio = opcoes.desafio === undefined ? null : opcoes.desafio;
  const codigosSalvos: Array<Partial<MfaCodigoRecuperacaoOrm>> = [];

  const repositorioFator = {
    findOne: jest.fn(async () => fator),
    create: jest.fn((dados) => dados),
    save: jest.fn(async (dados) => {
      fator = dados;
      return dados;
    }),
    update: jest.fn(async () => ({ affected: opcoes.atualizacaoFatorAfetada ?? 1 })),
    delete: jest.fn(async () => ({ affected: 1 }))
  };
  const repositorioDesafio = {
    findOne: jest.fn(async () => desafio),
    create: jest.fn((dados) => dados),
    save: jest.fn(async (dados) => dados),
    update: jest.fn(async () => ({ affected: opcoes.atualizacaoDesafioAfetada ?? 1 }))
  };
  const repositorioCodigos = {
    create: jest.fn((dados) => dados),
    save: jest.fn(async (dados) => {
      codigosSalvos.push(...dados);
      return dados;
    }),
    delete: jest.fn(async () => ({ affected: 1 })),
    update: jest.fn(async () => ({ affected: opcoes.codigoRecuperacaoAfetado ?? 0 })),
    count: jest.fn(async () => 8)
  };
  const repositorioUsuario = { findOne: jest.fn(async () => CONTA) };
  const gerenciador = {
    getRepository: jest.fn((entidade) => {
      if (entidade === MfaFatorUsuarioOrm) return repositorioFator;
      if (entidade === MfaDesafioOrm) return repositorioDesafio;
      if (entidade === MfaCodigoRecuperacaoOrm) return repositorioCodigos;
      if (entidade === UsuarioOrm) return repositorioUsuario;
      throw new Error(`Repositorio inesperado: ${entidade?.name}`);
    })
  };
  const executor = { executar: jest.fn(async (_tenantId, operacao) => operacao(gerenciador)) };
  const jwt = {
    signAsync: jest.fn(async () => 'desafio-assinado'),
    verifyAsync: jest.fn(async () => ({
      tipo: 'desafio_mfa',
      sub: USUARIO,
      tenantId: TENANT,
      jti: DESAFIO,
      finalidade: desafio?.tipo ?? 'login_configurar'
    }))
  };
  const criptografia = {
    criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)),
    descriptografar: jest.fn(() => SEGREDO)
  };
  const totp = {
    gerarSegredo: jest.fn(() => SEGREDO),
    criarUri: jest.fn(() => 'otpauth://totp/OctaClin:conta-sintetica'),
    validar: jest.fn(() => opcoes.totpValido === false ? { valido: false } : { valido: true, contador: 123 })
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const sessoes = { revogarTodas: jest.fn(async () => 1) };
  const protecaoAbuso = {
    verificarDisponibilidade: jest.fn(async () => undefined),
    registrarFalha: jest.fn(async () => undefined),
    registrarSucesso: jest.fn(async () => undefined)
  };

  return {
    servico: new ServicoMfa(
      executor as never,
      jwt as never,
      criptografia as never,
      totp as never,
      auditoria as never,
      sessoes as never,
      protecaoAbuso as never
    ),
    repositorioFator,
    repositorioDesafio,
    repositorioCodigos,
    codigosSalvos,
    totp,
    auditoria,
    sessoes,
    protecaoAbuso
  };
}

describe('ServicoMfa', () => {
  it('inicia configuracao obrigatoria sem devolver o segredo no desafio de login', async () => {
    const { servico, repositorioFator, repositorioDesafio } = criarCenario();

    const resposta = await servico.iniciarLogin(CONTA);

    expect(resposta).toEqual({ mfaObrigatorio: true, modo: 'configurar', desafioMfa: 'desafio-assinado' });
    expect(repositorioFator.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT,
      usuarioId: USUARIO,
      segredoPendenteCriptografado: expect.any(Buffer),
      pendenteExpiraEm: expect.any(Date)
    }));
    expect(repositorioDesafio.save).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'login_configurar' }));
    expect(JSON.stringify(resposta)).not.toContain(SEGREDO);
  });

  it('nao consome o desafio quando o TOTP de configuracao e invalido', async () => {
    const { servico, repositorioDesafio, protecaoAbuso } = criarCenario({
      fator: { tenantId: TENANT, usuarioId: USUARIO, segredoPendenteCriptografado: Buffer.from('cifrado'), pendenteExpiraEm: new Date(Date.now() + 60_000) },
      desafio: { id: DESAFIO, tenantId: TENANT, usuarioId: USUARIO, tipo: 'login_configurar', expiraEm: new Date(Date.now() + 60_000), consumidoEm: null },
      totpValido: false
    });

    await expect(servico.concluirLogin('desafio-assinado', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repositorioDesafio.update).not.toHaveBeenCalled();
    expect(protecaoAbuso.registrarFalha).toHaveBeenCalledWith(
      expect.not.stringContaining('desafio-assinado'),
      expect.anything()
    );
  });

  it('ativa o fator, consome o desafio e persiste somente hashes dos recovery codes', async () => {
    const { servico, repositorioFator, repositorioDesafio, codigosSalvos } = criarCenario({
      fator: { tenantId: TENANT, usuarioId: USUARIO, segredoPendenteCriptografado: Buffer.from('cifrado'), pendenteExpiraEm: new Date(Date.now() + 60_000) },
      desafio: { id: DESAFIO, tenantId: TENANT, usuarioId: USUARIO, tipo: 'login_configurar', expiraEm: new Date(Date.now() + 60_000), consumidoEm: null }
    });

    const resposta = await servico.concluirLogin('desafio-assinado', '123456');

    expect(resposta.usuario).toBe(CONTA);
    expect(resposta.codigosRecuperacao).toHaveLength(10);
    expect(repositorioFator.update).toHaveBeenCalled();
    expect(repositorioDesafio.update).toHaveBeenCalled();
    expect(codigosSalvos).toHaveLength(10);
    expect(codigosSalvos.every((item) => /^[0-9a-f]{64}$/.test(String(item.codigoHash)))).toBe(true);
    for (const codigo of resposta.codigosRecuperacao) {
      expect(JSON.stringify(codigosSalvos)).not.toContain(codigo);
    }
  });

  it('impede reutilizacao do mesmo contador TOTP', async () => {
    const { servico } = criarCenario({
      fator: { tenantId: TENANT, usuarioId: USUARIO, segredoCriptografado: Buffer.from('cifrado'), habilitadoEm: new Date(), ultimoContadorTotp: '122' },
      desafio: { id: DESAFIO, tenantId: TENANT, usuarioId: USUARIO, tipo: 'login_verificar', expiraEm: new Date(Date.now() + 60_000), consumidoEm: null },
      atualizacaoFatorAfetada: 0
    });

    await expect(servico.concluirLogin('desafio-assinado', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('aceita recovery code uma unica vez por update condicional', async () => {
    const { servico, repositorioCodigos, auditoria } = criarCenario({
      fator: { tenantId: TENANT, usuarioId: USUARIO, segredoCriptografado: Buffer.from('cifrado'), habilitadoEm: new Date() },
      desafio: { id: DESAFIO, tenantId: TENANT, usuarioId: USUARIO, tipo: 'login_verificar', expiraEm: new Date(Date.now() + 60_000), consumidoEm: null },
      codigoRecuperacaoAfetado: 1
    });

    await expect(servico.concluirLogin('desafio-assinado', 'ABCD-EFGH-IJKL')).resolves.toMatchObject({
      usuario: CONTA,
      codigosRecuperacao: []
    });
    expect(repositorioCodigos.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, usuarioId: USUARIO, codigoHash: expect.stringMatching(/^[0-9a-f]{64}$/) }),
      expect.objectContaining({ usadoEm: expect.any(Date) })
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT,
      usuarioId: USUARIO,
      acao: 'auth.mfa.codigo_recuperacao_usado',
      recursoTipo: 'mfa'
    }));
    expect(JSON.stringify(auditoria.registrar.mock.calls)).not.toContain('ABCD-EFGH-IJKL');
  });
});
