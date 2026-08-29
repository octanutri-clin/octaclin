import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TIPO_TOKEN_ACESSO, TIPO_TOKEN_RENOVACAO } from '../dominio/claims-token';
import {
  obterSegredoAcesso,
  obterSegredoRenovacao,
  opcoesAssinatura
} from '../infraestrutura/configuracao-jwt';
import { GuardaJwt } from './guarda-jwt';

const TENANT = '22222222-2222-4222-8222-222222222222';
const USUARIO = '11111111-1111-4111-8111-111111111111';
const SESSAO = '33333333-3333-4333-8333-333333333333';

const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;

const jwt = new JwtService({});

const CLAIMS_ACESSO = {
  sub: USUARIO,
  tenantId: TENANT,
  sid: SESSAO,
  tipo: TIPO_TOKEN_ACESSO,
  papel: 'Professional',
  emailHash: 'hash-sintetico',
  permissoes: ['pacientes.listar']
};

function contexto(token?: string) {
  const requisicao: Record<string, unknown> = {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  };
  return {
    requisicao,
    execucao: { switchToHttp: () => ({ getRequest: () => requisicao }) } as never
  };
}

function criarGuarda(sessaoAtiva = true) {
  const sessoes = { estaAtiva: jest.fn(async () => sessaoAtiva) };
  return { guarda: new GuardaJwt(jwt, sessoes as never), sessoes };
}

describe('GuardaJwt', () => {
  let snapshot: Map<string, string | undefined>;

  beforeEach(() => {
    snapshot = new Map(CHAVES.map((nome) => [nome, process.env[nome]]));
    process.env.APP_AMBIENTE = 'producao';
    process.env.JWT_SEGREDO = 'a'.repeat(48);
    process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR;
    delete process.env.JWT_AUDIENCIA;
  });

  afterEach(() => {
    for (const [nome, valor] of snapshot) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  async function assinarAcesso(claims: Record<string, unknown> = {}, sobrescreverOpcoes: Record<string, unknown> = {}) {
    return jwt.signAsync(
      { ...CLAIMS_ACESSO, ...claims },
      { ...opcoesAssinatura(TIPO_TOKEN_ACESSO, 'jti-teste'), ...sobrescreverOpcoes }
    );
  }

  it('aceita access token valido com sessao ativa', async () => {
    const { guarda, sessoes } = criarGuarda();
    const { execucao, requisicao } = contexto(await assinarAcesso());

    await expect(guarda.canActivate(execucao)).resolves.toBe(true);
    expect(requisicao.usuarioAutenticado).toMatchObject({
      usuarioId: USUARIO,
      tenantId: TENANT,
      papel: 'Professional',
      sessaoId: SESSAO
    });
    expect(sessoes.estaAtiva).toHaveBeenCalledWith(TENANT, USUARIO, SESSAO);
  });

  it('recusa requisicao sem cabecalho Bearer', async () => {
    const { guarda } = criarGuarda();
    await expect(guarda.canActivate(contexto().execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa refresh token apresentado como access token', async () => {
    const { guarda } = criarGuarda();
    const token = await jwt.signAsync(
      { sub: USUARIO, tenantId: TENANT, sid: SESSAO, tipo: TIPO_TOKEN_RENOVACAO },
      opcoesAssinatura(TIPO_TOKEN_RENOVACAO, 'jti-refresh')
    );

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token assinado com o segredo de renovacao', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso({}, { secret: obterSegredoRenovacao() });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token com algoritmo none', async () => {
    const { guarda } = criarGuarda();
    const cabecalho = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const corpo = Buffer.from(
      JSON.stringify({
        ...CLAIMS_ACESSO,
        jti: 'jti-none',
        iss: 'octaclin',
        aud: 'octaclin-api',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      })
    ).toString('base64url');

    await expect(
      guarda.canActivate(contexto(`${cabecalho}.${corpo}.`).execucao)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token assinado com algoritmo diferente do autorizado', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso({}, { algorithm: 'HS512' });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token de outro emissor', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso({}, { issuer: 'emissor-intruso' });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token de outra audiencia', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso({}, { audience: 'outra-api' });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token expirado', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso({}, { expiresIn: '-1s' });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token adulterado no corpo', async () => {
    const { guarda } = criarGuarda();
    const token = await assinarAcesso();
    const [cabecalho, corpo, assinatura] = token.split('.');
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    payload.papel = 'SuperAdmin';
    const corpoAdulterado = Buffer.from(JSON.stringify(payload)).toString('base64url');

    await expect(
      guarda.canActivate(contexto(`${cabecalho}.${corpoAdulterado}.${assinatura}`).execucao)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token sem identificador de sessao', async () => {
    const { guarda } = criarGuarda();
    const token = await jwt.signAsync(
      { sub: USUARIO, tenantId: TENANT, tipo: TIPO_TOKEN_ACESSO, papel: 'Professional', emailHash: 'hash' },
      opcoesAssinatura(TIPO_TOKEN_ACESSO, 'jti-sem-sid')
    );

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token sem tenant e token com papel fora do catalogo', async () => {
    const { guarda } = criarGuarda();

    const semTenant = await jwt.signAsync(
      { sub: USUARIO, sid: SESSAO, tipo: TIPO_TOKEN_ACESSO, papel: 'Professional', emailHash: 'hash' },
      opcoesAssinatura(TIPO_TOKEN_ACESSO, 'jti-sem-tenant')
    );
    await expect(guarda.canActivate(contexto(semTenant).execucao)).rejects.toBeInstanceOf(UnauthorizedException);

    const papelInvalido = await assinarAcesso({ papel: 'RootDaClinica' });
    await expect(guarda.canActivate(contexto(papelInvalido).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa access token valido quando a sessao foi revogada em outra instancia', async () => {
    const { guarda, sessoes } = criarGuarda(false);
    const token = await assinarAcesso();

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessoes.estaAtiva).toHaveBeenCalled();
  });

  it('nao propaga claim desconhecida para o contexto autenticado', async () => {
    const { guarda } = criarGuarda();
    const { execucao, requisicao } = contexto(await assinarAcesso({ admin: true }));

    await guarda.canActivate(execucao);

    expect(requisicao.usuarioAutenticado).not.toHaveProperty('admin');
  });

  it('nao aceita token de tenant diferente do declarado na sessao', async () => {
    const sessoes = {
      estaAtiva: jest.fn(async (tenantId: string) => tenantId === TENANT)
    };
    const guarda = new GuardaJwt(jwt, sessoes as never);
    const token = await assinarAcesso({ tenantId: '99999999-9999-4999-8999-999999999999' });

    await expect(guarda.canActivate(contexto(token).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('usa segredos distintos para access e renovacao', () => {
    expect(obterSegredoAcesso()).not.toBe(obterSegredoRenovacao());
  });
});
