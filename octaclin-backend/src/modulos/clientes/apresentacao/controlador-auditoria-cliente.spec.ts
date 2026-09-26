import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ControladorAuditoriaCliente } from './controlador-auditoria-cliente';
import { ServicoAuditoriaCliente } from '../aplicacao/servico-auditoria-cliente';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { criarPipeValidacaoHttp } from '../../../infraestrutura/http/pipe-validacao-http';

describe('HTTP auditoria da clinica', () => {
  let app: INestApplication;
  let url: string;
  let identidade: Partial<UsuarioAutenticado> | undefined;
  const listar = jest.fn(async () => ({ itens: [], pagina: 1, limite: 25, temMais: false }));
  const registrar = jest.fn(async () => undefined);

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ControladorAuditoriaCliente],
      providers: [GuardaPapeis, GuardaPermissoes,
        { provide: ServicoAuditoriaCliente, useValue: { listar } },
        { provide: ServicoAuditoria, useValue: { registrar } }]
    }).overrideGuard(GuardaJwt).useValue({ canActivate: (contexto: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
      if (!identidade) throw new UnauthorizedException();
      contexto.switchToHttp().getRequest().usuarioAutenticado = identidade;
      return true;
    } }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(criarPipeValidacaoHttp());
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    identidade = { tenantId: 'tenant-a', usuarioId: 'gestor-a', papel: 'Client', permissoes: ['cliente.acessar'] };
  });

  it('usa identidade verificada, retorna no-store e audita consulta sem valores dos filtros', async () => {
    const resposta = await fetch(`${url}/cliente/auditoria?acao=pacientes.criar&pagina=2`);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(listar).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ pagina: 2, acao: 'pacientes.criar' }));
    expect(registrar).toHaveBeenCalledWith({ tenantId: 'tenant-a', usuarioId: 'gestor-a', acao: 'cliente.auditoria.consultar', recursoTipo: 'auditoria', garantirRetentativa: true });
  });
  it.each(['Professional', 'Collaborator', 'Patient', 'SuperAdmin'] as const)('nega %s mesmo portando permissao cliente.acessar', async (papel) => {
    identidade!.papel = papel;
    expect((await fetch(`${url}/cliente/auditoria`)).status).toBe(403);
    expect(listar).not.toHaveBeenCalled();
  });
  it('nega sessao ausente e Client sem permissao', async () => {
    identidade = undefined;
    expect((await fetch(`${url}/cliente/auditoria`)).status).toBe(401);
    identidade = { papel: 'Client', permissoes: [] };
    expect((await fetch(`${url}/cliente/auditoria`)).status).toBe(403);
    expect(listar).not.toHaveBeenCalled();
  });
  it.each(['tenantId=tenant-b', 'pagina=1&pagina=2', 'acao=a&acao=b', 'limite=101', 'inicio=2026-02-30'])('rejeita query %s', async (query) => {
    expect((await fetch(`${url}/cliente/auditoria?${query}`)).status).toBe(400);
    expect(listar).not.toHaveBeenCalled();
  });
});
