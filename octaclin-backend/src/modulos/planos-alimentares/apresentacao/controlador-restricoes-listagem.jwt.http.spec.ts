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
import { ControladorRestricoesClinicas } from './controlador-restricoes-clinicas';
import { ControladorRestricoesColaborador } from './controlador-restricoes-colaborador';

import { ControladorDisponibilidadeRestricoes } from './controlador-disponibilidade-restricoes';

/** FOOD06 P3-0a: listagem, avaliação e disponibilidade com as guardas REAIS. Serviços simulados; dados sintéticos. */
const tenant = '22222222-2222-4222-8222-222222222222';
const usuario = '11111111-1111-4111-8111-111111111111';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const avaliacaoId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Amendoim', observacao: 'Anotação sintética' };
const CHAVES = ['APP_AMBIENTE', 'JWT_SEGREDO', 'JWT_REFRESH_SEGREDO', 'JWT_EMISSOR', 'JWT_AUDIENCIA'] as const;
const item = { id: restricao, revisao: 2, origem: 'declaracao_paciente', estado: 'ativa', confirmacao: 'pendente', conteudo, criadoEm: new Date('2026-11-18T10:00:00Z'), autorUsuarioId: 'CANARIO_INTERNO' };
const listar = jest.fn(async (): Promise<unknown> => ({ escopo: 'completo', itens: [item] }));
const consultarAvaliacao = jest.fn(async (): Promise<unknown> => ({ avaliacao: { id: avaliacaoId, revisao: 3, situacao: 'restricoes_registradas',
  confirmadoEm: '2026-09-12T10:00:00.000Z', venceEm: '2027-03-11T10:00:00.000Z', confirmadoPorUsuarioId: 'CANARIO_INTERNO' } }));
const sessoes = { estaAtiva: jest.fn(async () => true) };
let flagLigada = true;
const flags = { habilitada: jest.fn(async (_t: string, chave: string) => chave === 'restricoes.clinicas' && flagLigada) };

describe('listagem, avaliação e disponibilidade com guardas reais (P3-0a)', () => {
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

  beforeAll(async () => {
    process.env.APP_AMBIENTE = 'producao';
    process.env.JWT_SEGREDO = 'a'.repeat(48);
    process.env.JWT_REFRESH_SEGREDO = 'b'.repeat(48);
    delete process.env.JWT_EMISSOR; delete process.env.JWT_AUDIENCIA;
    const modulo = await Test.createTestingModule({ controllers: [ControladorRestricoesClinicas, ControladorRestricoesColaborador, ControladorDisponibilidadeRestricoes], providers: [
      GuardaJwt, GuardaPapeis, GuardaPermissoes, GuardaFeatureFlag,
      { provide: JwtService, useValue: jwt }, { provide: ServicoSessoes, useValue: sessoes },
      { provide: ServicoFeatureFlags, useValue: flags }, { provide: ServicoAuditoria, useValue: { registrar: jest.fn() } },
      { provide: ServicoLeituraRestricao, useValue: { consultar: jest.fn(), consultarAutoria: jest.fn(), listar, consultarAvaliacao } },
      { provide: ServicoConfirmacaoRestricao, useValue: {} }, { provide: ServicoRegistroPendenciaRestricao, useValue: {} },
      { provide: ServicoReconfirmacaoRestricao, useValue: {} }, { provide: ServicoSolicitacoesRestricao, useValue: {} }
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
  beforeEach(() => { listar.mockClear(); consultarAvaliacao.mockClear(); flags.habilitada.mockClear(); logs.length = 0; flagLigada = true; });
  afterEach(() => { expect(inspect(logs, { depth: 10 })).not.toMatch(/CANARIO_|Amendoim|Anotação/); });

  it('Professional lista com a identidade do token; projeção sem campos internos e criadoEm em ISO', async () => {
    const r = await post(`pacientes/${paciente}/restricoes/listar`, 'Professional');
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    const corpo = await r.json();
    expect(corpo).toEqual({ escopo: 'completo', itens: [{ id: restricao, revisao: 2, origem: 'declaracao_paciente', estado: 'ativa', confirmacao: 'pendente', conteudo, criadoEm: '2026-11-18T10:00:00.000Z' }] });
    expect(JSON.stringify(corpo)).not.toContain('CANARIO');
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario, papel: 'Professional' }), paciente);
  });

  it('Collaborator lista pela rota própria; papéis trocados e Patient/Client/SuperAdmin recebem 403', async () => {
    const c = await post(`colaborador/pacientes/${paciente}/restricoes/listar`, 'Collaborator');
    expect(c.status).toBe(200);
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ papel: 'Collaborator' }), paciente);
    listar.mockClear();
    expect((await post(`pacientes/${paciente}/restricoes/listar`, 'Collaborator')).status).toBe(403);
    expect((await post(`colaborador/pacientes/${paciente}/restricoes/listar`, 'Professional')).status).toBe(403);
    for (const papel of ['Patient', 'Client', 'SuperAdmin'] as const) {
      expect((await post(`pacientes/${paciente}/restricoes/listar`, papel)).status).toBe(403);
      expect((await post(`pacientes/${paciente}/restricoes/avaliacao/consultar`, papel)).status).toBe(403);
    }
    expect(listar).not.toHaveBeenCalled(); expect(consultarAvaliacao).not.toHaveBeenCalled();
  });

  it('corpo diferente de {} e paciente inválido respondem 400 sem chamar o serviço', async () => {
    for (const [caminho, body] of [[`pacientes/${paciente}/restricoes/listar`, { tenantId: tenant }],
      [`pacientes/${paciente}/restricoes/avaliacao/consultar`, { pacienteId: paciente }],
      [`colaborador/pacientes/${paciente}/restricoes/listar`, { x: 1 }],
      ['pacientes/CANARIO_ID/restricoes/listar', {}]] as const) {
      const r = await post(caminho, caminho.startsWith('colaborador') ? 'Collaborator' : 'Professional', body);
      expect(r.status).toBe(400); expect(await r.text()).not.toMatch(/CANARIO_/);
    }
    expect(listar).not.toHaveBeenCalled(); expect(consultarAvaliacao).not.toHaveBeenCalled();
  });

  it('avaliação: situação, revisão e vencimento, nunca quem confirmou; null quando não existe', async () => {
    const r = await post(`pacientes/${paciente}/restricoes/avaliacao/consultar`, 'Professional');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ avaliacao: { id: avaliacaoId, revisao: 3, situacao: 'restricoes_registradas', confirmadoEm: '2026-09-12T10:00:00.000Z', venceEm: '2027-03-11T10:00:00.000Z' } });
    consultarAvaliacao.mockResolvedValueOnce({ avaliacao: null });
    expect(await (await post(`pacientes/${paciente}/restricoes/avaliacao/consultar`, 'Professional')).json()).toEqual({ avaliacao: null });
  });

  it('resposta malformada do serviço vira 500 genérico, sem eco', async () => {
    listar.mockResolvedValueOnce({ escopo: 'completo', itens: [{ ...item, conteudo: { natureza: 'CANARIO_RUIM' } }] });
    const r = await post(`pacientes/${paciente}/restricoes/listar`, 'Professional');
    expect(r.status).toBe(500); expect(await r.text()).not.toMatch(/CANARIO_/);
    consultarAvaliacao.mockResolvedValueOnce({ avaliacao: { id: avaliacaoId, revisao: 1, situacao: 'nao_informado', confirmadoEm: null, venceEm: '2027-01-01T00:00:00.000Z' } });
    expect((await post(`pacientes/${paciente}/restricoes/avaliacao/consultar`, 'Professional')).status).toBe(500);
  });

  it('flag desligada fecha listagem e avaliação; disponibilidade responde false sem a guarda da flag', async () => {
    flagLigada = false;
    expect((await post(`pacientes/${paciente}/restricoes/listar`, 'Professional')).status).toBe(403);
    expect((await post(`colaborador/pacientes/${paciente}/restricoes/listar`, 'Collaborator')).status).toBe(403);
    expect(listar).not.toHaveBeenCalled();
    for (const papel of ['Professional', 'Collaborator', 'Patient'] as const) {
      const d = await post('restricoes/disponibilidade', papel);
      expect(d.status).toBe(200); expect(d.headers.get('cache-control')).toBe('private, no-store');
      expect(await d.json()).toEqual({ habilitada: false });
    }
    flagLigada = true;
    expect(await (await post('restricoes/disponibilidade', 'Patient')).json()).toEqual({ habilitada: true });
    expect(flags.habilitada).toHaveBeenCalledWith(tenant, 'restricoes.clinicas');
  });

  it('disponibilidade: sem token 401, Client e SuperAdmin 403, corpo não vazio 400', async () => {
    expect((await post('restricoes/disponibilidade', undefined)).status).toBe(401);
    expect((await post('restricoes/disponibilidade', 'Client')).status).toBe(403);
    expect((await post('restricoes/disponibilidade', 'SuperAdmin')).status).toBe(403);
    expect((await post('restricoes/disponibilidade', 'Patient', { tenantId: tenant })).status).toBe(400);
  });
});
