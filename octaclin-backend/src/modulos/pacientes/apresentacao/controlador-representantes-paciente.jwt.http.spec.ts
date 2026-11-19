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
import type { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import { opcoesAssinatura } from '../../auth/infraestrutura/configuracao-jwt';
import { ServicoPortalRestricoes } from '../../planos-alimentares/aplicacao/servico-portal-restricoes';
import { ControladorPortalRestricoes } from '../../planos-alimentares/apresentacao/controlador-portal-restricoes';
import { ServicoVinculosRepresentacao } from '../aplicacao/servico-vinculos-representacao';
import { ControladorRepresentantesPaciente } from './controlador-representantes-paciente';

/** FOOD06 P2d-3a: rotas de representantes (equipe) e do seletor do portal com as guardas REAIS; serviços simulados. */
const tenant = '22222222-2222-4222-8222-222222222222';
const usuario = '11111111-1111-4111-8111-111111111111';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const representante = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const vinculo = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;

const IDENT = { tipo: 'nome_ficha', nome: 'Helena Sintética' };
const vinculos = {
  listar: jest.fn(async (): Promise<unknown> => [{ id: vinculo, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0),
    identificacao: { ...IDENT, interno: 'CANARIO_INTERNO' }, revogadoPor: 'CANARIO_INTERNO' }]),
  registrar: jest.fn(async (): Promise<unknown> => ({ id: vinculo, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0), identificacao: IDENT })),
  buscarCandidato: jest.fn(async (): Promise<unknown> => ({ candidato: { usuarioId: representante, identificacao: { tipo: 'email_mascarado', email: 'h***@e***.test' }, role: 'CANARIO_INTERNO' } })),
  revogar: jest.fn(async (): Promise<unknown> => ({ id: vinculo, revogado: true }))
};
const portal = { listarPacientes: jest.fn(async (): Promise<unknown> => [{ pacienteId: paciente, via: 'representante', nome: 'Nome sintético', interno: 'CANARIO_INTERNO' }]) };
let flagLigada = true;
const flags = { habilitada: jest.fn(async (_t: string, chave: string) => chave === 'restricoes.clinicas' && flagLigada) };

describe('rotas de representantes e do seletor do portal com guardas reais (P2d-3a)', () => {
  let app: NestExpressApplication, url: string;
  const jwt = new JwtService({});
  const logs: unknown[][] = [];
  const snapshot = new Map(CHAVES.map(nome => [nome, process.env[nome]]));
  const token = (papel: PapelUsuario, extra: Record<string, unknown> = {}) => jwt.signAsync(
    { sub: usuario, tenantId: tenant, sid: randomUUID(), tipo: TIPO_TOKEN_ACESSO, papel, emailHash: 'hash-sintetico',
      permissoes: contextoAcessoPorPapel(papel).permissoes, mfa: true, ...extra }, opcoesAssinatura(TIPO_TOKEN_ACESSO, randomUUID()));
  const post = async (caminho: string, papel: PapelUsuario | undefined, body: unknown = {}, extra: Record<string, unknown> = {}) =>
    fetch(`${url}/${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json',
      ...(papel ? { authorization: `Bearer ${await token(papel, extra)}` } : {}) }, body: JSON.stringify(body) });
  const servicos = () => [vinculos.listar, vinculos.registrar, vinculos.revogar, vinculos.buscarCandidato, portal.listarPacientes];

  beforeAll(async () => {
    process.env.APP_AMBIENTE = 'producao'; process.env.JWT_SEGREDO = 'a'.repeat(48); process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR; delete process.env.JWT_AUDIENCIA;
    const modulo = await Test.createTestingModule({ controllers: [ControladorRepresentantesPaciente, ControladorPortalRestricoes], providers: [
      GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag,
      { provide: JwtService, useValue: jwt }, { provide: ServicoSessoes, useValue: { estaAtiva: jest.fn(async () => true) } },
      { provide: ServicoFeatureFlags, useValue: flags }, { provide: ServicoAuditoria, useValue: { registrar: jest.fn() } },
      { provide: ServicoVinculosRepresentacao, useValue: vinculos }, { provide: ServicoPortalRestricoes, useValue: portal }
    ] }).compile();
    const logger = { log: (...x: unknown[]) => logs.push(x), error: (...x: unknown[]) => logs.push(x), warn: (...x: unknown[]) => logs.push(x),
      debug: (...x: unknown[]) => logs.push(x), verbose: (...x: unknown[]) => logs.push(x) };
    app = modulo.createNestApplication<NestExpressApplication>({ rawBody: true, logger });
    app.use(middlewareRestricoesClinicas); app.useBodyParser('json', { limit: '100kb' }); app.use(middlewareErroRestricoesClinicas);
    app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1'); url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await app.close();
    for (const [nome, valor] of snapshot) { if (valor === undefined) delete process.env[nome]; else process.env[nome] = valor; }
  });
  beforeEach(() => { for (const s of servicos()) s.mockClear(); flags.habilitada.mockClear(); logs.length = 0; flagLigada = true; });
  afterEach(() => { expect(inspect(logs, { depth: 10 })).not.toMatch(/CANARIO_/); });

  it.each(['Professional', 'Collaborator'] as const)('%s administra representantes; resposta só com a allowlist', async papel => {
    const l = await post(`pacientes/${paciente}/representantes/listar`, papel, {});
    expect(l.status).toBe(200); expect(l.headers.get('cache-control')).toBe('private, no-store');
    expect(await l.json()).toEqual({ itens: [{ id: vinculo, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0).toISOString(), identificacao: IDENT }] });
    const r = await post(`pacientes/${paciente}/representantes/registrar`, papel, { representanteUsuarioId: representante, tipoVerificacao: 'presencial' });
    expect(r.status).toBe(200);
    expect(vinculos.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel }), paciente, representante, 'presencial');
    const v = await post(`pacientes/${paciente}/representantes/${vinculo}/revogar`, papel, {});
    expect(v.status).toBe(200); expect(await v.json()).toEqual({ id: vinculo, revogado: true });
  });

  it.each(['Patient', 'Client', 'SuperAdmin'] as const)('%s não administra representantes (403)', async papel => {
    const r = await post(`pacientes/${paciente}/representantes/registrar`, papel, { representanteUsuarioId: representante, tipoVerificacao: 'presencial' });
    expect(r.status).toBe(403); expect(vinculos.registrar).not.toHaveBeenCalled();
    // Mesmo com a permissão de leitura forjada no token, o papel barra.
    const forjado = await post(`pacientes/${paciente}/representantes/registrar`, papel, { representanteUsuarioId: representante, tipoVerificacao: 'presencial' },
      { permissoes: [...contextoAcessoPorPapel(papel).permissoes, 'pacientes.ler'] });
    expect(forjado.status).toBe(403); expect(vinculos.registrar).not.toHaveBeenCalled();
  });

  it('payload extra, tipo fora da lista ou id inválido: 400 sem eco', async () => {
    for (const [caminho, body] of [[`pacientes/${paciente}/representantes/registrar`, { representanteUsuarioId: representante, tipoVerificacao: 'CANARIO_TIPO' }],
      [`pacientes/${paciente}/representantes/registrar`, { representanteUsuarioId: representante, tipoVerificacao: 'presencial', tenantId: tenant }],
      [`pacientes/${paciente}/representantes/registrar`, { representanteUsuarioId: 'CANARIO_ID', tipoVerificacao: 'presencial' }],
      [`pacientes/${paciente}/representantes/listar`, { pacienteId: paciente }]] as const) {
      const r = await post(caminho, 'Professional', body);
      expect(r.status).toBe(400); expect(await r.text()).not.toMatch(/CANARIO_/);
    }
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });

  it('Patient lista os pacientes que pode escolher; nenhum outro papel usa o seletor', async () => {
    const r = await post('portal/restricoes/pacientes/listar', 'Patient', {});
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ itens: [{ pacienteId: paciente, via: 'representante', nome: 'Nome sintético' }] });
    expect(portal.listarPacientes).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: usuario, papel: 'Patient' }));
    for (const papel of ['Professional', 'Collaborator', 'Client', 'SuperAdmin'] as const) expect((await post('portal/restricoes/pacientes/listar', papel, {})).status).toBe(403);
    expect((await post('portal/restricoes/pacientes/listar', 'Patient', {}, { permissoes: [] })).status).toBe(403);
    expect((await post('portal/restricoes/pacientes/listar', 'Patient', { usuarioId: usuario })).status).toBe(400);
  });

  it('flag desligada fecha as rotas novas depois de autenticar; sem token, 401', async () => {
    flagLigada = false;
    expect((await post(`pacientes/${paciente}/representantes/listar`, 'Professional', {})).status).toBe(403);
    expect((await post('portal/restricoes/pacientes/listar', 'Patient', {})).status).toBe(403);
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
    flagLigada = true;
    expect((await post('portal/restricoes/pacientes/listar', undefined, {})).status).toBe(401);
  });

  // E-mail sintético usado como canário: não pode aparecer em log, URL nem resposta.
  const EMAIL = 'canario.busca@example.test';
  it.each(['Professional', 'Collaborator'] as const)('P3-0b: %s busca por e-mail exato no corpo; resposta só com a allowlist', async papel => {
    const r = await post(`pacientes/${paciente}/representantes/candidato/buscar`, papel, { email: EMAIL });
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({ candidato: { usuarioId: representante, identificacao: { tipo: 'email_mascarado', email: 'h***@e***.test' } } });
    expect(vinculos.buscarCandidato).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel }), paciente, EMAIL);
    expect(inspect(logs, { depth: 10 })).not.toContain(EMAIL);
  });
  it('P3-0b: não encontrado/não elegível volta { candidato: null }', async () => {
    vinculos.buscarCandidato.mockResolvedValueOnce({ candidato: null });
    const r = await post(`pacientes/${paciente}/representantes/candidato/buscar`, 'Professional', { email: EMAIL });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ candidato: null });
  });
  it('P3-0b: cota esgotada responde 429 com mensagem fixa, sem eco', async () => {
    const { HttpException } = await import('@nestjs/common');
    vinculos.buscarCandidato.mockRejectedValueOnce(new HttpException(`CANARIO_COTA ${EMAIL}`, 429));
    const r = await post(`pacientes/${paciente}/representantes/candidato/buscar`, 'Professional', { email: EMAIL });
    expect(r.status).toBe(429); expect(r.headers.get('cache-control')).toBe('private, no-store');
    const texto = await r.text();
    expect(texto).not.toMatch(/CANARIO_|example/); expect(JSON.parse(texto)).toEqual({ statusCode: 429, message: 'Muitas tentativas. Tente novamente em alguns minutos.' });
    expect(inspect(logs, { depth: 10 })).not.toContain(EMAIL);
  });
  it('P3-0b: corpo fora do contrato, papel errado ou flag desligada não chegam ao serviço', async () => {
    for (const body of [{}, { email: EMAIL, tenantId: tenant }, { email: 42 }, { email: `${'a'.repeat(250)}@example.test` }]) {
      const r = await post(`pacientes/${paciente}/representantes/candidato/buscar`, 'Professional', body);
      expect(r.status).toBe(400); expect(await r.text()).not.toMatch(/example|CANARIO_/);
    }
    for (const papel of ['Patient', 'Client', 'SuperAdmin'] as const)
      expect((await post(`pacientes/${paciente}/representantes/candidato/buscar`, papel, { email: EMAIL })).status).toBe(403);
    flagLigada = false;
    expect((await post(`pacientes/${paciente}/representantes/candidato/buscar`, 'Professional', { email: EMAIL })).status).toBe(403);
    expect(vinculos.buscarCandidato).not.toHaveBeenCalled();
    expect(inspect(logs, { depth: 10 })).not.toContain(EMAIL);
  });
  it('P3-0b: identificação fora do formato falha fechado (500), sem eco', async () => {
    vinculos.buscarCandidato.mockResolvedValueOnce({ candidato: { usuarioId: representante, identificacao: { tipo: 'email', email: EMAIL } } });
    const r = await post(`pacientes/${paciente}/representantes/candidato/buscar`, 'Professional', { email: EMAIL });
    expect(r.status).toBe(500); expect(await r.text()).not.toContain(EMAIL);
    vinculos.listar.mockResolvedValueOnce([{ id: vinculo, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0) }]);
    expect((await post(`pacientes/${paciente}/representantes/listar`, 'Professional', {})).status).toBe(500);
  });
});
