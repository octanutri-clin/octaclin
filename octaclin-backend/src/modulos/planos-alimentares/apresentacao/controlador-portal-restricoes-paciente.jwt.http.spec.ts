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
import { ServicoPortalRestricoes } from '../aplicacao/servico-portal-restricoes';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ControladorPortalRestricoesPaciente } from './controlador-portal-restricoes-paciente';

/** FOOD06 P2d-3b: rotas do portal por paciente com as guardas REAIS; serviços simulados; dados sintéticos. */
const tenant = '22222222-2222-4222-8222-222222222222';
const usuario = '11111111-1111-4111-8111-111111111111';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const pedido = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'alvo-sintetico' } };
const pedidoPortal = { id: pedido, tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: new Date(0).toISOString(), podeCancelar: true, autor: 'CANARIO_INTERNO' };
const portal = {
  resumo: jest.fn(async (): Promise<unknown> => ({ restricoes: [{ id: restricao, selo: 'restricoes.portal.registrada', natureza: 'clinica', alvo: { tipo: 'alergeno', id: 'alvo-sintetico' },
    observacao: 'CANARIO_OBSERVACAO' }], ultimaConfirmacaoEm: new Date(0).toISOString() })),
  listarPedidos: jest.fn(async (): Promise<unknown> => ({ itens: [pedidoPortal], maisAntigos: false })),
  criarPedido: jest.fn(async (): Promise<unknown> => pedidoPortal),
  cancelarPedido: jest.fn(async (): Promise<unknown> => ({ ...pedidoPortal, chaveTexto: 'restricoes.solicitacao.cancelada', podeCancelar: false }))
};
const registro = { registrar: jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 3, estado: 'ativa', confirmacao: 'rejeitada', origem: 'CANARIO_INTERNO' })) };
let flagLigada = true;
const flags = { habilitada: jest.fn(async (_t: string, chave: string) => chave === 'restricoes.clinicas' && flagLigada) };

describe('portal de restrições por paciente com guardas reais (P2d-3b)', () => {
  let app: NestExpressApplication, url: string;
  const jwt = new JwtService({});
  const logs: unknown[][] = [];
  const snapshot = new Map(CHAVES.map(nome => [nome, process.env[nome]]));
  const token = (papel: PapelUsuario, extra: Record<string, unknown> = {}) => jwt.signAsync(
    { sub: usuario, tenantId: tenant, sid: randomUUID(), tipo: TIPO_TOKEN_ACESSO, papel, emailHash: 'hash-sintetico',
      permissoes: contextoAcessoPorPapel(papel).permissoes, mfa: true, ...extra }, opcoesAssinatura(TIPO_TOKEN_ACESSO, randomUUID()));
  const post = async (caminho: string, papel: PapelUsuario | undefined, body: unknown = {}, extra: Record<string, unknown> = {}) =>
    fetch(`${url}/portal/pacientes/${paciente}/restricoes/${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json',
      ...(papel ? { authorization: `Bearer ${await token(papel, extra)}` } : {}) }, body: JSON.stringify(body) });
  const servicos = () => [...Object.values(portal), registro.registrar];

  beforeAll(async () => {
    process.env.APP_AMBIENTE = 'producao'; process.env.JWT_SEGREDO = 'a'.repeat(48); process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR; delete process.env.JWT_AUDIENCIA;
    const modulo = await Test.createTestingModule({ controllers: [ControladorPortalRestricoesPaciente], providers: [
      GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag,
      { provide: JwtService, useValue: jwt }, { provide: ServicoSessoes, useValue: { estaAtiva: jest.fn(async () => true) } },
      { provide: ServicoFeatureFlags, useValue: flags }, { provide: ServicoAuditoria, useValue: { registrar: jest.fn() } },
      { provide: ServicoPortalRestricoes, useValue: portal }, { provide: ServicoRegistroPendenciaRestricao, useValue: registro }
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

  it('Patient usa as cinco rotas com a identidade do token; respostas só com a allowlist', async () => {
    const resumo = await post('resumo', 'Patient', {});
    expect(resumo.status).toBe(200); expect(resumo.headers.get('cache-control')).toBe('private, no-store');
    expect(await resumo.json()).toEqual({ restricoes: [{ id: restricao, selo: 'restricoes.portal.registrada', natureza: 'clinica', alvo: { tipo: 'alergeno', id: 'alvo-sintetico' } }],
      ultimaConfirmacaoEm: new Date(0).toISOString() });
    expect(portal.resumo).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel: 'Patient' }), paciente);
    const dec = await post('declarar', 'Patient', { chaveCriacao: randomUUID(), conteudo });
    // Mesmo se a repetição da chave cair numa declaração já rejeitada, o portal não revela revisão nem desfecho.
    expect(dec.status).toBe(200); expect(await dec.json()).toEqual({ id: restricao, selo: 'restricoes.portal.informada_por_voce' });
    const lista = await post('pedidos/listar', 'Patient', {});
    const esperado = { id: pedido, tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: new Date(0).toISOString(), podeCancelar: true };
    expect(await lista.json()).toEqual({ itens: [esperado], maisAntigos: false });
    const criado = await post('pedidos/criar', 'Patient', { chaveCriacao: randomUUID(), tipo: 'correcao', restricaoId: restricao, itens: [{ item: 'i1', texto: 'Texto sintético' }] });
    expect(criado.status).toBe(200); expect(await criado.json()).toEqual(esperado);
    const cancelado = await post(`pedidos/${pedido}/cancelar`, 'Patient', {});
    expect(await cancelado.json()).toEqual({ ...esperado, chaveTexto: 'restricoes.solicitacao.cancelada', podeCancelar: false });
    expect(portal.cancelarPedido).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: usuario }), paciente, pedido);
  });

  it.each(['Professional', 'Collaborator', 'Client', 'SuperAdmin'] as const)('%s não usa o portal do paciente (403), nem com permissão forjada', async papel => {
    for (const extra of [{}, { permissoes: [...contextoAcessoPorPapel(papel).permissoes, 'portal.acessar'] }]) {
      expect((await post('resumo', papel, {}, extra)).status).toBe(403);
    }
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });

  it('Patient sem portal.acessar, flag desligada e sem token fecham antes do serviço', async () => {
    expect((await post('resumo', 'Patient', {}, { permissoes: [] })).status).toBe(403);
    flagLigada = false; expect((await post('pedidos/listar', 'Patient', {})).status).toBe(403);
    flagLigada = true; expect((await post('resumo', undefined, {})).status).toBe(401);
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });

  it('entrada inválida: 400 sem eco nem chamada ao serviço', async () => {
    for (const [caminho, body] of [['resumo', { pacienteId: paciente }], ['pedidos/listar', { CANARIO_X: 1 }],
      ['pedidos/criar', { chaveCriacao: randomUUID(), tipo: 'inclusao', restricaoId: restricao, itens: [] }],
      ['pedidos/criar', { chaveCriacao: 'CANARIO_ID', tipo: 'correcao', restricaoId: restricao, itens: [] }],
      ['pedidos/criar', { chaveCriacao: randomUUID(), tipo: 'correcao', restricaoId: restricao, itens: [], tenantId: tenant }],
      ['declarar', { chaveCriacao: randomUUID(), conteudo: { natureza: 'CANARIO_NAT' } }],
      [`pedidos/${pedido}/cancelar`, { revisao: 1 }]] as const) {
      const r = await post(caminho, 'Patient', body);
      expect(r.status).toBe(400); expect(await r.text()).not.toMatch(/CANARIO_/);
    }
    for (const s of servicos()) expect(s).not.toHaveBeenCalled();
  });
});
