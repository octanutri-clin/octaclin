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
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ServicoConfirmacaoRestricao } from '../aplicacao/servico-confirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ServicoReconfirmacaoRestricao } from '../aplicacao/servico-reconfirmacao-restricao';
import { ServicoSolicitacoesRestricao } from '../aplicacao/servico-solicitacoes-restricao';
import { ServicoDelegacoesCarteira } from '../../profissionais/aplicacao/servico-delegacoes-carteira';
import { ControladorDelegacoesCarteira } from '../../profissionais/apresentacao/controlador-delegacoes-carteira';
import { ControladorRestricoesClinicas } from './controlador-restricoes-clinicas';
import { ControladorRestricoesColaborador } from './controlador-restricoes-colaborador';

/**
 * FOOD06 P2d-2: rotas do colaborador delegado e da delegação de carteira com as guardas REAIS (JWT assinado, sessão,
 * papel, permissão e flag). Serviços simulados; credenciais e dados sintéticos.
 */
const tenant = '22222222-2222-4222-8222-222222222222';
const usuario = '11111111-1111-4111-8111-111111111111';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const colaborador = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const delegacao = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'alvo-sintetico' } };
const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;

const registrar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, estado: 'ativa', confirmacao: 'pendente', chaveCriacao: 'CANARIO_INTERNO' }));
const consultarAutoria = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, origem: 'colaborador', estado: 'ativa', confirmacao: 'pendente', conteudo, autor: 'CANARIO_INTERNO' }));
const confirmar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 2, confirmacao: 'confirmada' }));
const delegacoes = {
  listar: jest.fn(async (): Promise<unknown> => [{ id: delegacao, colaboradorUsuarioId: colaborador, colaboradorEmail: 'carla@example.test', concedidaEm: new Date(0), interno: 'CANARIO_INTERNO' }]),
  conceder: jest.fn(async (): Promise<unknown> => ({ id: delegacao, colaboradorUsuarioId: colaborador, colaboradorEmail: 'carla@example.test', concedidaEm: new Date(0) })),
  candidatos: jest.fn(async (): Promise<unknown> => ({ itens: [{ usuarioId: colaborador, email: 'carla@example.test', role: 'CANARIO_INTERNO' }], noLimite: false, total: 'CANARIO_INTERNO' })),
  revogar: jest.fn(async (): Promise<unknown> => ({ id: delegacao, revogada: true }))
};
const sessoes = { estaAtiva: jest.fn(async () => true) };
let flagLigada = true;
const flags = { habilitada: jest.fn(async (_t: string, chave: string) => chave === 'restricoes.clinicas' && flagLigada) };

describe('rotas do colaborador delegado e da delegação com guardas reais (P2d-2)', () => {
  let app: NestExpressApplication, url: string;
  const jwt = new JwtService({});
  const logs: unknown[][] = [];
  const snapshot = new Map(CHAVES.map(nome => [nome, process.env[nome]]));
  const token = (papel: PapelUsuario, extra: Record<string, unknown> = {}) => jwt.signAsync(
    { sub: usuario, tenantId: tenant, sid: randomUUID(), tipo: TIPO_TOKEN_ACESSO, papel, emailHash: 'hash-sintetico',
      permissoes: contextoAcessoPorPapel(papel).permissoes, mfa: true, ...extra },
    opcoesAssinatura(TIPO_TOKEN_ACESSO, randomUUID()));
  const post = async (caminho: string, papel: PapelUsuario | undefined, body: unknown = {}, extra: Record<string, unknown> = {}) =>
    fetch(`${url}/${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json',
      ...(papel ? { authorization: `Bearer ${await token(papel, extra)}` } : {}) }, body: JSON.stringify(body) });
  const servicos = () => [registrar, consultarAutoria, confirmar, delegacoes.listar, delegacoes.conceder, delegacoes.revogar, delegacoes.candidatos];

  beforeAll(async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.JWT_SEGREDO = 'a'.repeat(48);
    process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR; delete process.env.JWT_AUDIENCIA;
    const modulo = await Test.createTestingModule({ controllers: [ControladorRestricoesClinicas, ControladorRestricoesColaborador, ControladorDelegacoesCarteira], providers: [
      GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag,
      { provide: JwtService, useValue: jwt }, { provide: ServicoSessoes, useValue: sessoes },
      { provide: ServicoFeatureFlags, useValue: flags }, { provide: ServicoAuditoria, useValue: { registrar: jest.fn() } },
      { provide: ServicoLeituraRestricao, useValue: { consultar: jest.fn(), consultarAutoria } },
      { provide: ServicoConfirmacaoRestricao, useValue: { confirmar } }, { provide: ServicoRegistroPendenciaRestricao, useValue: { registrar } },
      { provide: ServicoReconfirmacaoRestricao, useValue: {} }, { provide: ServicoSolicitacoesRestricao, useValue: {} },
      { provide: ServicoDelegacoesCarteira, useValue: delegacoes }
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
  afterEach(() => { expect(inspect(logs, { depth: 10 })).not.toMatch(/CANARIO_|alvo-sintetico/); });

  it('Collaborator registra pendência e lê a de sua autoria com a identidade do token; resposta só com a allowlist', async () => {
    const r = await post(`colaborador/pacientes/${paciente}/restricoes/registrar`, 'Collaborator', { chaveCriacao: randomUUID(), conteudo });
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({ id: restricao, revisao: 1, estado: 'ativa', confirmacao: 'pendente' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel: 'Collaborator' }), paciente, expect.anything());
    const c = await post(`colaborador/pacientes/${paciente}/restricoes/consultar`, 'Collaborator', { restricaoId: restricao });
    expect(c.status).toBe(200);
    expect(await c.json()).toEqual({ id: restricao, revisao: 1, origem: 'colaborador', estado: 'ativa', confirmacao: 'pendente', conteudo });
    expect(consultarAutoria).toHaveBeenCalledWith(expect.objectContaining({ papel: 'Collaborator' }), paciente, restricao);
  });

  it.each(['Professional', 'Patient', 'Client', 'SuperAdmin'] as const)('%s não usa as rotas do colaborador (403)', async papel => {
    const r = await post(`colaborador/pacientes/${paciente}/restricoes/registrar`, papel, { chaveCriacao: randomUUID(), conteudo });
    expect(r.status).toBe(403); expect(registrar).not.toHaveBeenCalled();
  });

  it('Collaborator nunca alcança ações clínicas nem a administração da delegação', async () => {
    for (const [caminho, body] of [[`pacientes/${paciente}/restricoes/${restricao}/confirmar`, { revisao: 1 }],
      [`pacientes/${paciente}/restricoes/registrar`, { chaveCriacao: randomUUID(), conteudo }],
      ['profissional/delegacoes-carteira/listar', {}], ['profissional/delegacoes-carteira/conceder', { colaboradorUsuarioId: colaborador }],
      [`profissional/delegacoes-carteira/${delegacao}/revogar`, {}], ['profissional/delegacoes-carteira/candidatos/listar', {}]] as const) {
      const r = await post(caminho, 'Collaborator', body);
      expect(r.status).toBe(403);
    }
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });

  it('Collaborator sem pacientes.ler no token responde 403', async () => {
    const r = await post(`colaborador/pacientes/${paciente}/restricoes/registrar`, 'Collaborator', { chaveCriacao: randomUUID(), conteudo }, { permissoes: ['console.acessar'] });
    expect(r.status).toBe(403); expect(registrar).not.toHaveBeenCalled();
  });

  it('flag desligada fecha as rotas novas depois de autenticar', async () => {
    flagLigada = false;
    const a = await post(`colaborador/pacientes/${paciente}/restricoes/consultar`, 'Collaborator', { restricaoId: restricao });
    const b = await post('profissional/delegacoes-carteira/listar', 'Professional', {});
    expect([a.status, b.status]).toEqual([403, 403]);
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });

  it('sem token: 401 genérico', async () => {
    const r = await post('profissional/delegacoes-carteira/listar', undefined, {});
    expect(r.status).toBe(401); expect(await r.json()).toEqual({ statusCode: 401, message: 'Autenticação necessária.' });
  });

  it('Professional administra a delegação; projeção sem campos internos; payload extra recusado', async () => {
    const l = await post('profissional/delegacoes-carteira/listar', 'Professional', {});
    expect(l.status).toBe(200);
    expect(await l.json()).toEqual({ itens: [{ id: delegacao, colaboradorUsuarioId: colaborador, colaboradorEmail: 'carla@example.test', concedidaEm: new Date(0).toISOString() }] });
    const c = await post('profissional/delegacoes-carteira/conceder', 'Professional', { colaboradorUsuarioId: colaborador });
    expect(c.status).toBe(200); expect(delegacoes.conceder).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: usuario, papel: 'Professional' }), colaborador);
    const v = await post(`profissional/delegacoes-carteira/${delegacao}/revogar`, 'Professional', {});
    expect(v.status).toBe(200); expect(await v.json()).toEqual({ id: delegacao, revogada: true });
    for (const [caminho, body] of [['profissional/delegacoes-carteira/listar', { tenantId: tenant }],
      ['profissional/delegacoes-carteira/conceder', { colaboradorUsuarioId: colaborador, profissionalId: randomUUID() }],
      ['profissional/delegacoes-carteira/conceder', { colaboradorUsuarioId: 'CANARIO_ID' }],
      [`profissional/delegacoes-carteira/${delegacao}/revogar`, { motivo: 'x' }], ['profissional/delegacoes-carteira/candidatos/listar', { papel: 'Collaborator' }]] as const) {
      const r = await post(caminho, 'Professional', body);
      expect(r.status).toBe(400); expect(await r.text()).not.toMatch(/CANARIO_/);
    }
  });

  it.each(['Collaborator', 'Patient', 'Client', 'SuperAdmin'] as const)('%s não administra delegação (403)', async papel => {
    const r = await post('profissional/delegacoes-carteira/conceder', papel, { colaboradorUsuarioId: colaborador });
    expect(r.status).toBe(403); expect(delegacoes.conceder).not.toHaveBeenCalled();
  });

  it('P3-0b: candidatos só para o titular com pacientes.gerenciar; resposta só com usuarioId, e-mail e noLimite', async () => {
    const r = await post('profissional/delegacoes-carteira/candidatos/listar', 'Professional', {});
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({ itens: [{ usuarioId: colaborador, email: 'carla@example.test' }], noLimite: false });
    expect(delegacoes.candidatos).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: usuario, tenantId: tenant, papel: 'Professional' }));
    delegacoes.candidatos.mockClear();
    const semGerenciar = await post('profissional/delegacoes-carteira/candidatos/listar', 'Professional', {}, { permissoes: ['pacientes.ler'] });
    expect(semGerenciar.status).toBe(403); expect(delegacoes.candidatos).not.toHaveBeenCalled();
    for (const papel of ['Patient', 'Client', 'SuperAdmin'] as const) expect((await post('profissional/delegacoes-carteira/candidatos/listar', papel, {})).status).toBe(403);
    expect(delegacoes.candidatos).not.toHaveBeenCalled();
  });

  it('P3-0b: resposta de serviço fora do formato falha fechado (500 genérico)', async () => {
    delegacoes.candidatos.mockResolvedValueOnce({ itens: [{ usuarioId: 'CANARIO_ID', email: 'x' }], noLimite: false });
    const r = await post('profissional/delegacoes-carteira/candidatos/listar', 'Professional', {});
    expect(r.status).toBe(500); expect(await r.text()).not.toMatch(/CANARIO_/);
    delegacoes.listar.mockResolvedValueOnce([{ id: delegacao, colaboradorUsuarioId: colaborador, concedidaEm: new Date(0) }]);
    expect((await post('profissional/delegacoes-carteira/listar', 'Professional', {})).status).toBe(500);
  });
});
