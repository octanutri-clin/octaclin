import { Test } from '@nestjs/testing';
import { ConflictException, ExecutionContext, ForbiddenException, INestApplication, UnauthorizedException } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
import { ServicoRevisaoFormularios } from '../aplicacao/servico-revisao-formularios';
import { ControladorQuestionarios } from './controlador-questionarios';

/** HTTP/guards/pipe reais, identidade e serviço simulados; banco/RLS na suíte T02. */
describe('P05 contrato HTTP da cópia', () => {
  let app: INestApplication, url: string;
  const id = '00000000-0000-4000-8000-000000000001';
  const origem = '00000000-0000-4000-8000-000000000002';
  const copia = '00000000-0000-4000-8000-000000000003';
  const revisao = 'a'.repeat(64);
  const definicao = { categoriaId: id, tipo: 'texto_longo', enunciado: 'Sintética', peso: '0.00',
    obrigatoria: false, configuracao: {}, visivelBiblioteca: false, opcoes: [] };
  const prepararCopiaPergunta = jest.fn(), duplicarPergunta = jest.fn(), registrar = jest.fn(), exportarRespostasCsv = jest.fn();
  const headers = (papel = 'Professional', permissao = 'questionarios.gerenciar') => ({
    'content-type': 'application/json', 'x-papel-sintetico': papel, 'x-permissao-sintetica': permissao
  });
  const caminho = `/questionarios/${id}/perguntas/${origem}`;
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorQuestionarios], providers: [
      { provide: ServicoQuestionarios, useValue: { prepararCopiaPergunta, duplicarPergunta, exportarRespostasCsv } },
      { provide: ServicoAuditoria, useValue: { registrar } },
      { provide: ServicoRevisaoFormularios, useValue: {} }
    ] }).overrideGuard(GuardaJwt).useValue({ canActivate(c: ExecutionContext) {
      const r = c.switchToHttp().getRequest();
      if (!r.headers['x-papel-sintetico']) throw new UnauthorizedException();
      r.usuarioAutenticado = { tenantId: id, usuarioId: id, sessaoId: id, emailHash: '',
        papel: r.headers['x-papel-sintetico'], permissoes: [r.headers['x-permissao-sintetica']] };
      return true;
    } }).compile();
    app = modulo.createNestApplication({ logger: false });
    app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    prepararCopiaPergunta.mockResolvedValue({ revisao, definicao, interno: 'não retornar' });
    duplicarPergunta.mockResolvedValue({ perguntaId: copia, versaoQuestionario: 3, interno: 'não retornar' });
    exportarRespostasCsv.mockResolvedValue('respostaId,valor\n"sintetica","texto\nmultilinha"\n');
  });
  it('exportação filtrada HTTP devolve CSV privado e audita uma linha sem conteúdo', async () => {
    const resposta = await fetch(url + `/questionarios/${id}/respostas/exportar.csv`, {
      method: 'POST', headers: headers('Professional', 'questionarios.ler'), body: JSON.stringify({ respostaIds: [origem] })
    });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toContain('text/csv');
    expect(resposta.headers.get('cache-control')).toContain('no-store');
    expect(await resposta.text()).toContain('multilinha');
    expect(exportarRespostasCsv).toHaveBeenCalledWith(id, id, expect.objectContaining({ tenantId: id }), [origem]);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ metadados: { tipo: 'csv_filtrado', linhas: 1 } }));
  });
  it.each([{ respostaIds: [] }, { respostaIds: ['incorreto'] }, { respostaIds: [origem, origem] }, { respostaIds: [origem], tenantId: id }])('exportação rejeita payload inválido %#', async body => {
    const resposta = await fetch(url + `/questionarios/${id}/respostas/exportar.csv`, {
      method: 'POST', headers: headers('Professional', 'questionarios.ler'), body: JSON.stringify(body)
    });
    expect(resposta.status).toBe(400);
    expect(exportarRespostasCsv).not.toHaveBeenCalled();
  });
  it('prepara sem gravação e confirma com identidade do servidor, resposta mínima e auditoria sem conteúdo', async () => {
    const previa = await fetch(url + caminho + '/copia', { headers: headers() });
    expect(previa.status).toBe(200);
    expect(previa.headers.get('cache-control')).toBe('private, no-store');
    expect(await previa.json()).toEqual({ revisao, definicao });
    expect(duplicarPergunta).not.toHaveBeenCalled();
    expect(registrar).not.toHaveBeenCalled();
    const r = await fetch(url + caminho + '/duplicar', { method: 'POST', headers: headers(), body: JSON.stringify({ revisaoEsperada: revisao }) });
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(await r.json()).toEqual({ perguntaId: copia, versaoQuestionario: 3 });
    expect(duplicarPergunta).toHaveBeenCalledWith(id, id, origem, revisao, expect.objectContaining({ tenantId: id, sessaoId: id }));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      acao: 'questionarios.pergunta.duplicar', recursoId: copia,
      metadados: { questionarioId: id, origemId: origem }
    }));
  });
  it('exige sessão, papel e permissão antes de chegar ao serviço', async () => {
    for (const [sufixo, method] of [['/copia', 'GET'], ['/duplicar', 'POST']]) {
      const body = method === 'POST' ? JSON.stringify({ revisaoEsperada: revisao }) : undefined;
      for (const [h, status] of [[{}, 401], [headers('Patient'), 403], [headers('Professional', 'questionarios.ler'), 403]] as const) {
        expect((await fetch(url + caminho + sufixo, { method, headers: h, body })).status).toBe(status);
      }
    }
    expect(prepararCopiaPergunta).not.toHaveBeenCalled();
    expect(duplicarPergunta).not.toHaveBeenCalled();
  });
  it.each(['SuperAdmin', 'Professional', 'Collaborator'])('permite %s com permissão, mantendo reautorização no serviço', async papel => {
    expect((await fetch(url + caminho + '/copia', { headers: headers(papel) })).status).toBe(200);
  });
  it('rejeita UUIDs inválidos nas duas posições', async () => {
    for (const path of [`/questionarios/invalido/perguntas/${origem}`, `/questionarios/${id}/perguntas/invalida`]) {
      expect((await fetch(url + path + '/copia', { headers: headers() })).status).toBe(400);
      expect((await fetch(url + path + '/duplicar', { method: 'POST', headers: headers(), body: JSON.stringify({ revisaoEsperada: revisao }) })).status).toBe(400);
    }
    expect(prepararCopiaPergunta).not.toHaveBeenCalled(); expect(duplicarPergunta).not.toHaveBeenCalled();
  });
  it.each([{}, { revisaoEsperada: null }, { revisaoEsperada: 1 }, { revisaoEsperada: [] },
    { revisaoEsperada: 'A'.repeat(64) }, { revisaoEsperada: revisao + '\n' }, { revisaoEsperada: 'a'.repeat(63) }, { revisaoEsperada: 'a'.repeat(65) },
    { revisaoEsperada: revisao, tenantId: id }, { revisaoEsperada: revisao, definicao: {} },
    { revisaoEsperada: revisao, visivelBiblioteca: true }])('rejeita payload adulterado %j', async body => {
    expect((await fetch(url + caminho + '/duplicar', { method: 'POST', headers: headers(), body: JSON.stringify(body) })).status).toBe(400);
    expect(duplicarPergunta).not.toHaveBeenCalled(); expect(registrar).not.toHaveBeenCalled();
  });
  it('rejeita corpo nulo, array, texto e JSON malformado sem persistência', async () => {
    for (const body of ['null', '[]', '"texto"', '{']) {
      expect((await fetch(url + caminho + '/duplicar', { method: 'POST', headers: headers(), body })).status).toBe(400);
    }
    expect(duplicarPergunta).not.toHaveBeenCalled(); expect(registrar).not.toHaveBeenCalled();
  });
  it('preserva conflitos/revogação do serviço sem auditoria de sucesso', async () => {
    for (const erro of [new ConflictException('Confira novamente.'), new ForbiddenException()]) {
      duplicarPergunta.mockRejectedValueOnce(erro);
      expect((await fetch(url + caminho + '/duplicar', { method: 'POST', headers: headers(), body: JSON.stringify({ revisaoEsperada: revisao }) })).status).toBe(erro.getStatus());
    }
    expect(registrar).not.toHaveBeenCalled();
  });
});
