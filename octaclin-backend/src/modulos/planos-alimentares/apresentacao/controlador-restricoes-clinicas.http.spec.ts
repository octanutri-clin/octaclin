import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { inspect } from 'node:util';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { middlewareErroRestricoesClinicas, middlewareRestricoesClinicas } from '../../../infraestrutura/http/middleware-restricoes-clinicas';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ServicoLeituraRestricao } from '../aplicacao/servico-leitura-restricao';
import { ControladorRestricoesClinicas } from './controlador-restricoes-clinicas';

const tenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuario = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } };
const consultar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo, chaveCriacao: 'CANARIO_INTERNO' }));

describe('contrato HTTP clínico isolado de restrições', () => {
  let app: NestExpressApplication, url: string;
  const logs: unknown[][] = [];
  const chamar = (body: unknown, papel = 'Professional', p = paciente) => fetch(`${url}/pacientes/${p}/restricoes/consultar`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(papel ? { 'x-papel-sintetico': papel } : {}) }, body: JSON.stringify(body)
  });
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorRestricoesClinicas], providers: [
      { provide: ServicoLeituraRestricao, useValue: { consultar } }, { provide: ServicoAuditoria, useValue: { registrar: async () => undefined } }
    ] }).overrideGuard(GuardaJwt).useValue({ canActivate(c: ExecutionContext) {
      const r = c.switchToHttp().getRequest(); if (!r.headers['x-papel-sintetico']) throw new UnauthorizedException();
      r.usuarioAutenticado = { tenantId: tenant, usuarioId: usuario, papel: r.headers['x-papel-sintetico'],
        permissoes: r.headers['x-sem-permissao'] ? [] : ['pacientes.ler'], emailHash: '' }; return true;
    } }).compile();
    const logger = { log: (...x: unknown[]) => logs.push(x), error: (...x: unknown[]) => logs.push(x), warn: (...x: unknown[]) => logs.push(x),
      debug: (...x: unknown[]) => logs.push(x), verbose: (...x: unknown[]) => logs.push(x) };
    app = modulo.createNestApplication<NestExpressApplication>({ rawBody: true, logger });
    app.use(middlewareRestricoesClinicas); app.useBodyParser('json', { limit: '100kb' }); app.use(middlewareErroRestricoesClinicas);
    app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1'); url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { consultar.mockClear(); logs.length = 0; });
  afterEach(() => { expect(inspect(logs, { depth: 10 })).not.toMatch(/CANARIO_/); });
  it('usa identidade autenticada e retorna apenas a projeção clínica, sem cache', async () => {
    const resposta = await chamar({ restricaoId: restricao });
    expect(resposta.status).toBe(200); expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    const corpo = await resposta.json(); expect(corpo).toEqual({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo });
    expect(JSON.stringify(corpo)).not.toContain('CANARIO_INTERNO');
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario }), paciente, restricao);
  });
  it.each(['', 'Patient', 'Collaborator', 'Client', 'SuperAdmin'])('nega papel %s antes do serviço', async papel => {
    const resposta = await chamar({ restricaoId: restricao }, papel); expect(resposta.status).toBe(papel ? 403 : 401);
    expect(resposta.headers.get('cache-control')).toBe('private, no-store'); expect(consultar).not.toHaveBeenCalled();
  });
  it('nega profissional sem permissão genérica antes do serviço', async () => {
    const resposta = await fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional', 'x-sem-permissao': '1' }, body: JSON.stringify({ restricaoId: restricao }) });
    expect(resposta.status).toBe(403); expect(resposta.headers.get('cache-control')).toBe('private, no-store'); expect(consultar).not.toHaveBeenCalled();
  });
  it('recusa seletores inválidos ou tenant no corpo antes de executar o serviço', async () => {
    for (const corpo of [{}, { restricaoId: 'invalido' }, { restricaoId: restricao, tenantId: tenant }, { restricaoId: restricao, outro: 'CANARIO' }]) {
      expect((await chamar(corpo)).status).toBe(400);
    }
    expect((await chamar({ restricaoId: restricao }, 'Professional', 'invalido')).status).toBe(400); expect(consultar).not.toHaveBeenCalled();
  });
  it('falha fechado se o conteúdo retornado contiver campo imprevisto', async () => {
    consultar.mockResolvedValueOnce({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo: { ...conteudo, segredo: 'CANARIO_SIGILOSO' } });
    const resposta = await chamar({ restricaoId: restricao }); expect(resposta.status).toBe(500); expect(await resposta.text()).not.toContain('CANARIO_SIGILOSO');
  });
  it('não devolve identificador inválido vindo da dependência', async () => {
    consultar.mockResolvedValueOnce({ id: 'CANARIO_ID', revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo });
    const resposta = await chamar({ restricaoId: restricao }); expect(resposta.status).toBe(500);
    expect(resposta.headers.get('cache-control')).toBe('private, no-store'); expect(await resposta.text()).not.toContain('CANARIO_ID');
  });
  it('não expõe a causa de autorização e impede cache também em erros', async () => {
    consultar.mockRejectedValueOnce(new ForbiddenException({ detalhe: 'CANARIO_CORPO' }));
    const resposta = await chamar({ restricaoId: restricao }); expect(resposta.status).toBe(403);
    expect(resposta.headers.get('cache-control')).toBe('private, no-store'); expect(await resposta.text()).not.toContain('CANARIO_CORPO');
  });
  it('não ecoa conteúdo nem permite cache ao receber JSON malformado', async () => {
    const resposta = await fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' }, body: '{"valor":"CANARIO_JSON' });
    expect(resposta.status).toBe(400); expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(await resposta.text()).not.toContain('CANARIO_JSON'); expect(consultar).not.toHaveBeenCalled();
  });
  it('recusa corpo acima do limite sem refletir o conteúdo', async () => {
    const resposta = await fetch(`${url}/pacientes/${paciente}/restricoes/consultar`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' },
      body: JSON.stringify({ restricaoId: restricao, texto: `CANARIO_GRANDE${'a'.repeat(110_000)}` }) });
    expect(resposta.status).toBe(413); expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(await resposta.text()).not.toContain('CANARIO_GRANDE'); expect(consultar).not.toHaveBeenCalled();
  });
  it.each(['/outra-rota', `/pacientes/${paciente}/restricoes-extra`])('não intercepta erro do parser em %s', async caminho => {
    const resposta = await fetch(`${url}${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(resposta.status).toBe(400); expect(resposta.headers.get('cache-control')).toBeNull();
  });
});
