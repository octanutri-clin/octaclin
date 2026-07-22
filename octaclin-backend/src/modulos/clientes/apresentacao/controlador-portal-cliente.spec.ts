import { ControladorPortalCliente } from './controlador-portal-cliente';

describe('ControladorPortalCliente', () => {
  it('deve auditar atualizacao do perfil fiscal da empresa sem registrar documento em metadados', async () => {
    const perfil = {
      tenantId: 'tenant-1',
      tipoPessoa: 'pj',
      documento: '12.345.678/0001-90',
      nomeLegal: 'OctaClin Consultoria LTDA',
      nomeFantasia: 'OctaClin Prime',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      responsavel: { nome: 'Carla Octa', email: 'carla@octaclin.com.br', telefone: '', cargo: 'Diretora' },
      endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: 'Sao Paulo', uf: 'SP', pais: 'BR' },
      contatos: { emailFinanceiro: '', telefoneFinanceiro: '', whatsappAtendimento: '', emailAtendimento: '' },
      fiscal: { prepararRecibos: true, observacoes: '' },
      atualizadoEm: new Date('2026-07-22T10:00:00.000Z')
    };
    const servicoPortalCliente = {
      atualizarPerfilEmpresa: jest.fn(async () => perfil)
    };
    const servicoAuditoria = {
      registrar: jest.fn(async () => undefined)
    };
    const controlador = new ControladorPortalCliente(servicoPortalCliente as never, {} as never, servicoAuditoria as never);

    const resultado = await controlador.atualizarPerfilEmpresa(
      { tenantId: 'tenant-1', usuarioId: 'cliente-1' } as never,
      { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as never,
      {
        tipoPessoa: 'pj',
        documento: '12.345.678/0001-90',
        nomeLegal: 'OctaClin Consultoria LTDA',
        nomeFantasia: 'OctaClin Prime',
        responsavel: { nome: 'Carla Octa', email: 'carla@octaclin.com.br' },
        endereco: { cidade: 'Sao Paulo', uf: 'SP' },
        contatos: {},
        fiscal: { prepararRecibos: true }
      } as never
    );

    expect(resultado).toBe(perfil);
    expect(servicoAuditoria.registrar).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      usuarioId: 'cliente-1',
      acao: 'cliente.perfil_empresa.atualizar',
      recursoTipo: 'tenant',
      recursoId: 'tenant-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      metadados: {
        tipoPessoa: 'pj',
        campos: ['tipoPessoa', 'documento', 'nomeLegal', 'nomeFantasia', 'responsavel', 'endereco', 'contatos', 'fiscal']
      }
    });
    expect(JSON.stringify(servicoAuditoria.registrar.mock.calls)).not.toContain('12.345.678/0001-90');
  });
});
