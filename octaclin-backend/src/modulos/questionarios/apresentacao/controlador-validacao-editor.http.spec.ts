import { Test } from '@nestjs/testing';
import { ExecutionContext, INestApplication, UnauthorizedException, ConflictException } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';
import { ServicoRevisaoFormularios } from '../aplicacao/servico-revisao-formularios';
import { ControladorQuestionarios } from './controlador-questionarios';

/** Guards/pipe/HTTP reais; identidade e serviço simulados, não comprova banco/RLS. */
describe('QST10-06 validação do editor HTTP', () => {
  let app: INestApplication, url: string;
  const id = '00000000-0000-4000-8000-000000000001';
  const validarPreviaEditor = jest.fn(), obterVersaoEditor = jest.fn(), registrar = jest.fn();
  const headers = (papel = 'Professional', permissao = 'questionarios.gerenciar') => ({
    'content-type': 'application/json', 'x-papel': papel, 'x-permissao': permissao
  });
  const caminho = `/questionarios/${id}/validacao`;
  const body = { versaoEsperada: 1, titulo: 'Sintético', perguntas: [] };
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorQuestionarios], providers: [
      { provide: ServicoQuestionarios, useValue: { validarPreviaEditor, obterVersaoEditor } },
      { provide: ServicoAuditoria, useValue: { registrar } },
      { provide: ServicoRevisaoFormularios, useValue: {} }
    ] }).overrideGuard(GuardaJwt).useValue({ canActivate(c: ExecutionContext) {
      const r = c.switchToHttp().getRequest();
      if (!r.headers['x-papel']) throw new UnauthorizedException();
      r.usuarioAutenticado = { tenantId: id, usuarioId: id, papel: r.headers['x-papel'], permissoes: [r.headers['x-permissao']] };
      return true;
    } }).compile();
    app = modulo.createNestApplication({ logger: false }); app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1'); url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.resetAllMocks(); validarPreviaEditor.mockResolvedValue({ versao: 1, problemas: [] }); obterVersaoEditor.mockResolvedValue({ versao: 2 }); });
  it('retorna prévia privada sem auditoria de escrita', async () => {
    const r = await fetch(url + caminho, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toContain('no-store');
    expect(await r.json()).toEqual({ versao: 1, problemas: [] }); expect(registrar).not.toHaveBeenCalled();
    expect(validarPreviaEditor).toHaveBeenCalledWith(id, id, body, expect.objectContaining({ tenantId: id }));
  });
  it('consulta somente revisão autorizada para reconferência explícita', async () => {
    const r = await fetch(url + caminho, { headers: headers() });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ versao: 2 }); expect(r.headers.get('cache-control')).toContain('no-store');
  });
  it('exige sessão papel e permissão nos dois métodos', async () => {
    for (const method of ['GET', 'POST']) for (const [h, status] of [[{}, 401], [headers('Patient'), 403], [headers('Professional', 'questionarios.ler'), 403]] as const) {
      expect((await fetch(url + caminho, { method, headers: h, body: method === 'POST' ? JSON.stringify(body) : undefined })).status).toBe(status);
    }
    expect(validarPreviaEditor).not.toHaveBeenCalled(); expect(obterVersaoEditor).not.toHaveBeenCalled();
  });
  it.each([{}, { ...body, versaoEsperada: 0 }, { ...body, tenantId: id }, { ...body, perguntas: null },
    { ...body, perguntas: [{ id, dados: { tipo: 'inventado' } }] }, { ...body, perguntas: [{ id, dados: { peso: -1 } }] },
    { ...body, perguntas: [{ id, dados: { opcoes: [{ rotulo: 1, valor: 'x' }] } }] }, { ...body, perguntas: [{ id, dados: { oculto: true } }] }])('rejeita payload adulterado %#', async entrada => {
    expect((await fetch(url + caminho, { method: 'POST', headers: headers(), body: JSON.stringify(entrada) })).status).toBe(400);
    expect(validarPreviaEditor).not.toHaveBeenCalled();
  });
  it('preserva conflito sem registrar sucesso', async () => {
    validarPreviaEditor.mockRejectedValue(new ConflictException('Confira novamente.'));
    expect((await fetch(url + caminho, { method: 'POST', headers: headers(), body: JSON.stringify(body) })).status).toBe(409); expect(registrar).not.toHaveBeenCalled();
  });
});
