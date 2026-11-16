import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { middlewareErroRestricoesClinicas, middlewareRestricoesClinicas } from '../../../infraestrutura/http/middleware-restricoes-clinicas';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoFeatureFlags } from '../../../infraestrutura/feature-flags/servico-feature-flags';
import { GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { ServicoSessoes } from '../../auth/aplicacao/servico-sessoes';
import { TIPO_TOKEN_ACESSO } from '../../auth/dominio/claims-token';
import { contextoAcessoPorPapel } from '../../auth/dominio/permissoes';
import { opcoesAssinatura } from '../../auth/infraestrutura/configuracao-jwt';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ServicoConfirmacaoRestricao } from '../aplicacao/servico-confirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ServicoReconfirmacaoRestricao } from '../aplicacao/servico-reconfirmacao-restricao';
import { ControladorRestricoesClinicas } from './controlador-restricoes-clinicas';

/**
 * FOOD06 P2b: o contrato HTTP clínico com as guardas REAIS (JWT assinado, sessão, papel, permissão e flag).
 * Só a sessão, a flag e os serviços são simulados; credenciais e dados são sintéticos.
 */
const tenant = '22222222-2222-4222-8222-222222222222';
const usuario = '11111111-1111-4111-8111-111111111111';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'alvo-sintetico' } };
const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;

const consultar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo, privado: 'CANARIO_INTERNO' }));
const sessoes = { estaAtiva: jest.fn(async () => true) };
let flagLigada = true;
const flags = { habilitada: jest.fn(async (_t: string, chave: string) => chave === 'restricoes.clinicas' && flagLigada) };
const auditoria = { registrar: jest.fn(async () => undefined) };

describe('contrato HTTP clínico com guardas reais (P2b)', () => {
  let app: NestExpressApplication, url: string;
  const jwt = new JwtService({});
  const logs: unknown[][] = [];
  const snapshot = new Map(CHAVES.map(nome => [nome, process.env[nome]]));
  const token = (extra: Record<string, unknown> = {}, opcoes: Record<string, unknown> = {}) => jwt.signAsync(
    { sub: usuario, tenantId: tenant, sid: randomUUID(), tipo: TIPO_TOKEN_ACESSO, papel: 'Professional', emailHash: 'hash-sintetico',
      permissoes: contextoAcessoPorPapel('Professional').permissoes, mfa: true, ...extra },
    { ...opcoesAssinatura(TIPO_TOKEN_ACESSO, randomUUID()), ...opcoes });
  const consultarComo = (autorizacao?: string, body: unknown = { restricaoId: restricao }) =>
    fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', ...(autorizacao ? { authorization: autorizacao } : {}) }, body: JSON.stringify(body) });

  beforeAll(async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.JWT_SEGREDO = 'a'.repeat(48);
    process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR; delete process.env.JWT_AUDIENCIA;
    const modulo = await Test.createTestingModule({ controllers: [ControladorRestricoesClinicas], providers: [
      GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag,
      { provide: JwtService, useValue: jwt }, { provide: ServicoSessoes, useValue: sessoes },
      { provide: ServicoFeatureFlags, useValue: flags }, { provide: ServicoAuditoria, useValue: auditoria },
      { provide: ServicoLeituraRestricao, useValue: { consultar } },
      { provide: ServicoConfirmacaoRestricao, useValue: {} }, { provide: ServicoRegistroPendenciaRestricao, useValue: {} },
      { provide: ServicoReconfirmacaoRestricao, useValue: {} }
    ] }).compile();
    const logger = { log: (...x: unknown[]) => logs.push(x), error: (...x: unknown[]) => logs.push(x), warn: (...x: unknown[]) => logs.push(x),
      debug: (...x: unknown[]) => logs.push(x), verbose: (...x: unknown[]) => logs.push(x) };
    app = modulo.createNestApplication<NestExpressApplication>({ rawBody: true, logger });
    // Mesma ordem do main.ts.
    app.use(middlewareRestricoesClinicas); app.useBodyParser('json', { limit: '100kb' }); app.use(middlewareErroRestricoesClinicas);
    app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1'); url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await app.close();
    for (const [nome, valor] of snapshot) { if (valor === undefined) delete process.env[nome]; else process.env[nome] = valor; }
  });
  beforeEach(() => { consultar.mockClear(); sessoes.estaAtiva.mockClear(); flags.habilitada.mockClear(); logs.length = 0; flagLigada = true; sessoes.estaAtiva.mockResolvedValue(true); });
  afterEach(() => { expect(inspect(logs, { depth: 10 })).not.toMatch(/CANARIO_|alvo-sintetico/); });

  it('Professional autenticado com sessão ativa, MFA e flag ligada chega ao serviço com a identidade do token', async () => {
    const resposta = await consultarComo(`Bearer ${await token()}`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    const corpo = await resposta.json();
    expect(corpo).toEqual({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo });
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel: 'Professional' }), paciente, restricao);
    expect(flags.habilitada).toHaveBeenCalledWith(tenant, 'restricoes.clinicas');
  });

  it.each([
    ['sem token', async () => undefined],
    ['token malformado', async () => 'Bearer nao-e-um-jwt'],
    ['token assinado com outro segredo', async () => `Bearer ${await token({}, { secret: 'c'.repeat(48) })}`],
    ['token de outro tipo', async () => `Bearer ${await token({ tipo: 'refresh' })}`],
    ['token expirado', async () => `Bearer ${await token({}, { expiresIn: -10 })}`],
    ['Professional sem MFA', async () => `Bearer ${await token({ mfa: false })}`]
  ])('%s responde 401 genérico sem chamar flag nem serviço', async (_caso, autorizacao) => {
    const resposta = await consultarComo(await autorizacao());
    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual({ statusCode: 401, message: 'Autenticação necessária.' });
    expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(flags.habilitada).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled();
  });

  it('sessão revogada responde 401 mesmo com token válido', async () => {
    sessoes.estaAtiva.mockResolvedValue(false);
    const resposta = await consultarComo(`Bearer ${await token()}`);
    expect(resposta.status).toBe(401); expect(consultar).not.toHaveBeenCalled();
  });

  it.each(['Collaborator', 'Client', 'SuperAdmin'] as const)('papel %s autenticado responde 403 antes da flag e do serviço', async papel => {
    const resposta = await consultarComo(`Bearer ${await token({ papel, permissoes: contextoAcessoPorPapel(papel).permissoes })}`);
    expect(resposta.status).toBe(403);
    expect(flags.habilitada).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled();
  });

  it('flag desligada responde 403 genérico depois de autenticar e sem chamar o serviço', async () => {
    flagLigada = false;
    const resposta = await consultarComo(`Bearer ${await token()}`);
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ statusCode: 403, message: 'Operação não autorizada.' });
    expect(flags.habilitada).toHaveBeenCalledWith(tenant, 'restricoes.clinicas');
    expect(consultar).not.toHaveBeenCalled();
  });

  it('JSON malformado e corpo acima do limite não ecoam conteúdo clínico', async () => {
    const malformado = await fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` }, body: '{"restricaoId":"CANARIO_JSON' });
    expect(malformado.status).toBe(400);
    expect(await malformado.text()).not.toMatch(/CANARIO_/);
    const grande = await fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ restricaoId: restricao, x: `CANARIO_${'x'.repeat(120 * 1024)}` }) });
    expect(grande.status).toBe(413);
    expect(await grande.text()).not.toMatch(/CANARIO_/);
    expect(consultar).not.toHaveBeenCalled();
  });
});
