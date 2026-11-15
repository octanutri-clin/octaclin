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
import { ServicoConfirmacaoRestricao } from '../aplicacao/servico-confirmacao-restricao';
import { ServicoRegistroPendenciaRestricao } from '../aplicacao/servico-registro-pendencia-restricao';
import { ServicoReconfirmacaoRestricao } from '../aplicacao/servico-reconfirmacao-restricao';
import { ControladorRestricoesClinicas } from './controlador-restricoes-clinicas';

const tenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuario = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', restricao = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } };
const consultar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo, chaveCriacao: 'CANARIO_INTERNO' }));
const confirmar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 2, confirmacao: 'confirmada', privado: 'CANARIO_INTERNO' }));
const rejeitar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 2, confirmacao: 'rejeitada', privado: 'CANARIO_INTERNO' }));
const inativar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 2, estado: 'inativa', privado: 'CANARIO_INTERNO' }));
const alterarReavaliacao = jest.fn(async (_u: unknown, _p: unknown, _r: unknown, _v: unknown, destino: unknown): Promise<unknown> =>
  ({ id: restricao, revisao: 2, estado: destino, privado: 'CANARIO_INTERNO' }));
const registrar = jest.fn(async (): Promise<unknown> => ({ id: restricao, revisao: 1, estado: 'ativa', confirmacao: 'pendente', privado: 'CANARIO_INTERNO' }));
const avaliacao = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const garantirAvaliacaoInicial = jest.fn(async (): Promise<unknown> => ({ id: avaliacao, revisao: 1, situacao: 'nao_informado', privado: 'CANARIO_INTERNO' }));
const resultadoGlobal = (resultado: string) => jest.fn(async (): Promise<unknown> => ({ id: restricao, resultado, privado: 'CANARIO_INTERNO' }));
const resultadoIndividual = (resultado: string) => jest.fn(async (): Promise<unknown> => ({ id: restricao, resultado, escopo: 'restricao_individual', revisaoAvaliacao: 1, revisaoRestricao: 2, privado: 'CANARIO_INTERNO' }));
const registrarPendenciaGlobal = resultadoGlobal('pendencia_mantida'), registrarAlteracaoGlobal = resultadoGlobal('alteracao_informada');
const registrarSemAlteracao = resultadoGlobal('sem_alteracao'), registrarAusenciaDeclarada = resultadoGlobal('sem_restricoes_declaradas');
const registrarPendenciaIndividual = resultadoIndividual('pendencia_mantida'), registrarAlteracaoIndividual = resultadoIndividual('alteracao_informada');
const registrarSemAlteracaoIndividual = resultadoIndividual('sem_alteracao');

describe('contrato HTTP clínico isolado de restrições', () => {
  let app: NestExpressApplication, url: string;
  const logs: unknown[][] = [];
  const chamar = (body: unknown, papel = 'Professional', p = paciente) => fetch(`${url}/pacientes/${p}/restricoes/consultar`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(papel ? { 'x-papel-sintetico': papel } : {}) }, body: JSON.stringify(body)
  });
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorRestricoesClinicas], providers: [
      { provide: ServicoLeituraRestricao, useValue: { consultar } },
      { provide: ServicoConfirmacaoRestricao, useValue: { confirmar, rejeitar, inativar, alterarReavaliacao } },
      { provide: ServicoRegistroPendenciaRestricao, useValue: { registrar } },
      { provide: ServicoReconfirmacaoRestricao, useValue: { garantirAvaliacaoInicial, registrarPendencia: registrarPendenciaGlobal,
        registrarAlteracaoInformada: registrarAlteracaoGlobal, registrarSemAlteracao, registrarAusenciaDeclarada,
        registrarPendenciaIndividual, registrarAlteracaoInformadaIndividual: registrarAlteracaoIndividual, registrarSemAlteracaoIndividual } },
      { provide: ServicoAuditoria, useValue: { registrar: async () => undefined } }
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
  beforeEach(() => { consultar.mockClear(); confirmar.mockClear(); rejeitar.mockClear(); inativar.mockClear(); alterarReavaliacao.mockClear(); registrar.mockClear();
    garantirAvaliacaoInicial.mockClear(); registrarPendenciaGlobal.mockClear(); registrarAlteracaoGlobal.mockClear(); registrarSemAlteracao.mockClear(); registrarAusenciaDeclarada.mockClear();
    registrarPendenciaIndividual.mockClear(); registrarAlteracaoIndividual.mockClear(); registrarSemAlteracaoIndividual.mockClear(); logs.length = 0; });
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
  const acao = (nome: string, body: unknown, papel = 'Professional') => fetch(`${url}/pacientes/${paciente}/restricoes/${restricao}/${nome}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(papel ? { 'x-papel-sintetico': papel } : {}) }, body: JSON.stringify(body)
  });
  it('confirma revisão explícita e não retorna campos internos', async () => {
    const r = await acao('confirmar', { revisao: 1 }); expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({ id: restricao, revisao: 2, confirmacao: 'confirmada' });
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario }), paciente, restricao, 1);
  });
  it('encaminha motivo de rejeição somente ao serviço', async () => {
    const r = await acao('rejeitar', { revisao: 1, justificativa: 'Justificativa sintética' }); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: restricao, revisao: 2, confirmacao: 'rejeitada' });
    expect(rejeitar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, restricao, 1, { justificativa: 'Justificativa sintética' });
  });
  it('exige confirmação de dois passos para inativar e preserva a justificativa no pedido', async () => {
    const pedido = { revisao: 1, motivo: 'outro', justificativa: 'Justificativa sintética', confirmacaoEmDoisPassos: true };
    const r = await acao('inativar', pedido); expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: restricao, revisao: 2, estado: 'inativa' });
    expect(inativar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, restricao, 1,
      { motivo: 'outro', justificativa: 'Justificativa sintética', confirmacaoEmDoisPassos: true });
    inativar.mockClear(); expect((await acao('inativar', { ...pedido, confirmacaoEmDoisPassos: false })).status).toBe(400); expect(inativar).not.toHaveBeenCalled();
  });
  it.each(['em_reavaliacao', 'ativa'])('encaminha reavaliação para %s', async destino => {
    const r = await acao('reavaliar', { revisao: 1, destino }); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: restricao, revisao: 2, estado: destino });
    expect(alterarReavaliacao).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, restricao, 1, destino);
  });
  it('nega entradas extras, revisões inválidas e papéis não clínicos antes da chamada', async () => {
    for (const corpo of [{}, { revisao: 0 }, { revisao: '1' }, { revisao: 1, tenantId: tenant }]) expect((await acao('confirmar', corpo)).status).toBe(400);
    for (const papel of ['Patient', 'Collaborator', 'Client', 'SuperAdmin']) expect((await acao('confirmar', { revisao: 1 }, papel)).status).toBe(403);
    expect((await acao('confirmar', { revisao: 1 }, '')).status).toBe(401);
    const idInvalido = await fetch(`${url}/pacientes/${paciente}/restricoes/invalido/confirmar`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' }, body: JSON.stringify({ revisao: 1 }) });
    expect(idInvalido.status).toBe(400);
    expect((await acao('reavaliar', { revisao: 1, destino: 'inativa' })).status).toBe(400); expect(confirmar).not.toHaveBeenCalled(); expect(alterarReavaliacao).not.toHaveBeenCalled();
  });
  it('recusa motivo e justificativa inválidos ou campos adicionais sem executar mutação', async () => {
    for (const corpo of [{ revisao: 1 }, { revisao: 1, justificativa: '' }, { revisao: 1, justificativa: 'a'.repeat(4001) },
      { revisao: 1, justificativa: 'Motivo sintético', tenantId: tenant }]) expect((await acao('rejeitar', corpo)).status).toBe(400);
    const base = { revisao: 1, justificativa: 'Justificativa sintética', confirmacaoEmDoisPassos: true };
    expect((await acao('inativar', base)).status).toBe(400);
    expect((await acao('inativar', { ...base, motivo: 'invalido' })).status).toBe(400);
    expect((await acao('inativar', { ...base, motivo: 'outro', confirmacaoEmDoisPassos: 'true' })).status).toBe(400);
    expect(rejeitar).not.toHaveBeenCalled(); expect(inativar).not.toHaveBeenCalled();
  });
  it('não divulga resultado inesperado da ação', async () => {
    confirmar.mockResolvedValueOnce({ id: restricao, revisao: 2, confirmacao: 'CANARIO_RESULTADO' });
    const r = await acao('confirmar', { revisao: 1 }); expect(r.status).toBe(500);
    expect(r.headers.get('cache-control')).toBe('private, no-store'); expect(await r.text()).not.toContain('CANARIO_RESULTADO');
  });
  const registrarPendencia = (body: unknown, papel = 'Professional') => fetch(`${url}/pacientes/${paciente}/restricoes/registrar`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(papel ? { 'x-papel-sintetico': papel } : {}) }, body: JSON.stringify(body)
  });
  it('registra pendência profissional com conteúdo validado e resposta mínima', async () => {
    const r = await registrarPendencia({ chaveCriacao: restricao, conteudo }); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: restricao, revisao: 1, estado: 'ativa', confirmacao: 'pendente' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, usuarioId: usuario }), paciente, { chaveCriacao: restricao, conteudo });
  });
  it('mantém a resposta idempotente com estado atual ao repetir uma criação', async () => {
    registrar.mockResolvedValueOnce({ id: restricao, revisao: 2, estado: 'ativa', confirmacao: 'confirmada', privado: 'CANARIO_INTERNO' });
    const r = await registrarPendencia({ chaveCriacao: restricao, conteudo }); expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: restricao, revisao: 2, estado: 'ativa', confirmacao: 'confirmada' });
  });
  it('recusa conteúdo ou identidade extra e papéis ainda não implementados', async () => {
    for (const body of [{ chaveCriacao: restricao, conteudo: { ...conteudo, segredo: 'CANARIO_CORPO' } },
      { chaveCriacao: restricao, conteudo, tenantId: tenant }, { chaveCriacao: 'invalida', conteudo }]) expect((await registrarPendencia(body)).status).toBe(400);
    for (const papel of ['Patient', 'Collaborator', 'Client', 'SuperAdmin']) expect((await registrarPendencia({ chaveCriacao: restricao, conteudo }, papel)).status).toBe(403);
    expect(registrar).not.toHaveBeenCalled();
  });
  const reconfirmar = (body: unknown) => fetch(`${url}/pacientes/${paciente}/restricoes/reconfirmar`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' }, body: JSON.stringify(body)
  });
  const atestacao = { avaliacaoId: avaliacao, revisaoAvaliacao: 1, chaveIdempotencia: restricao, meio: 'teleconsulta', atestacao: true };
  it('obtém a avaliação inicial sem aceitar parâmetros arbitrários', async () => {
    const r = await fetch(`${url}/pacientes/${paciente}/restricoes/avaliacao/inicial`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' }, body: '{}' });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: avaliacao, revisao: 1, situacao: 'nao_informado' });
    expect(garantirAvaliacaoInicial).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente);
    const extra = await fetch(`${url}/pacientes/${paciente}/restricoes/avaliacao/inicial`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-papel-sintetico': 'Professional' }, body: JSON.stringify({ tenantId: tenant }) });
    expect(extra.status).toBe(400); expect(garantirAvaliacaoInicial).toHaveBeenCalledTimes(1);
  });
  it.each([['pendencia_mantida', registrarPendenciaGlobal], ['alteracao_informada', registrarAlteracaoGlobal], ['sem_alteracao', registrarSemAlteracao]] as const)(
    'encaminha reconfirmação global %s e devolve ACK mínimo', async (resultado, servico) => {
      const r = await reconfirmar({ ...atestacao, resultado }); expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: restricao, resultado });
      expect(servico).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, atestacao);
    });
  it('exige confirmação explícita para ausência global', async () => {
    expect((await reconfirmar({ ...atestacao, resultado: 'sem_restricoes_declaradas' })).status).toBe(400);
    const r = await reconfirmar({ ...atestacao, resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: true });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: restricao, resultado: 'sem_restricoes_declaradas' });
    expect(registrarAusenciaDeclarada).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, { ...atestacao, confirmacaoExplicitaAusencia: true });
  });
  it.each([['pendencia_mantida', registrarPendenciaIndividual], ['alteracao_informada', registrarAlteracaoIndividual], ['sem_alteracao', registrarSemAlteracaoIndividual]] as const)(
    'retorna ACK histórico individual %s com revisões', async (resultado, servico) => {
      const r = await reconfirmar({ ...atestacao, resultado, restricaoId: restricao, revisaoRestricao: 2 });
      expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: restricao, resultado, escopo: 'restricao_individual', revisaoAvaliacao: 1, revisaoRestricao: 2 });
      expect(servico).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), paciente, { ...atestacao, restricaoId: restricao, revisaoRestricao: 2 });
    });
  it('recusa atestação incompleta, escopo inconsistente e identidade fornecida pelo cliente', async () => {
    for (const pedido of [{ ...atestacao, resultado: 'sem_alteracao', atestacao: false }, { ...atestacao, resultado: 'sem_alteracao', restricaoId: restricao },
      { ...atestacao, resultado: 'sem_alteracao', confirmacaoExplicitaAusencia: true }, { ...atestacao, resultado: 'sem_restricoes_declaradas', restricaoId: restricao, revisaoRestricao: 2, confirmacaoExplicitaAusencia: true },
      { ...atestacao, resultado: 'sem_alteracao', tenantId: tenant }]) expect((await reconfirmar(pedido)).status).toBe(400);
    expect(registrarSemAlteracao).not.toHaveBeenCalled(); expect(registrarAusenciaDeclarada).not.toHaveBeenCalled();
  });
  it('recusa nulos, revisões parciais, meios e resultados inválidos', async () => {
    for (const pedido of [
      { ...atestacao, resultado: 'sem_alteracao', restricaoId: null, revisaoRestricao: null },
      { ...atestacao, resultado: 'sem_alteracao', revisaoRestricao: 2 },
      { ...atestacao, resultado: 'sem_restricoes_declaradas', confirmacaoExplicitaAusencia: null },
      { ...atestacao, resultado: 'sem_alteracao', confirmacaoExplicitaAusencia: null },
      { ...atestacao, resultado: 'sem_alteracao', meio: 'invalido' },
      { ...atestacao, resultado: 'invalido' }, { ...atestacao, resultado: 'sem_alteracao', revisaoAvaliacao: '1' }
    ]) expect((await reconfirmar(pedido)).status).toBe(400);
    expect(registrarSemAlteracao).not.toHaveBeenCalled(); expect(registrarAusenciaDeclarada).not.toHaveBeenCalled();
  });
  it.each(['Patient', 'Collaborator', 'Client', 'SuperAdmin'])('nega reconfirmação ao papel %s antes do serviço', async papel => {
    const r = await fetch(`${url}/pacientes/${paciente}/restricoes/reconfirmar`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-papel-sintetico': papel }, body: JSON.stringify({ ...atestacao, resultado: 'sem_alteracao' }) });
    expect(r.status).toBe(403); expect(registrarSemAlteracao).not.toHaveBeenCalled();
  });
});
