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

  it('deve auditar criacao, reenvio e revogacao de convites administrativos', async () => {
    const servicoPortalCliente = {};
    const servicoUsuariosCliente = {
      criar: jest.fn(async () => ({ id: 'usuario-1', email: 'novo@octaclin.local', role: 'Collaborator' })),
      reenviarConvite: jest.fn(async () => ({ id: 'usuario-1', email: 'novo@octaclin.local', role: 'Collaborator' })),
      revogarConvite: jest.fn(async () => undefined)
    };
    const servicoAuditoria = {
      registrar: jest.fn(async () => undefined)
    };
    const controlador = new ControladorPortalCliente(servicoPortalCliente as never, servicoUsuariosCliente as never, servicoAuditoria as never);
    const usuario = { tenantId: 'tenant-1', usuarioId: 'cliente-1' } as never;
    const requisicao = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as never;

    await controlador.criarUsuario(usuario, requisicao, { email: 'novo@octaclin.local', role: 'Collaborator' } as never);
    await controlador.reenviarConvite(usuario, requisicao, 'usuario-1');
    await controlador.revogarConvite(usuario, requisicao, 'usuario-1');

    expect(servicoAuditoria.registrar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'cliente-1',
        acao: 'cliente.convite.criar',
        recursoTipo: 'usuario',
        recursoId: 'usuario-1',
        metadados: { role: 'Collaborator', email: 'novo@octaclin.local' }
      })
    );
    expect(servicoAuditoria.registrar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'cliente-1',
        acao: 'cliente.convite.reenviar',
        recursoTipo: 'usuario',
        recursoId: 'usuario-1',
        metadados: { role: 'Collaborator', email: 'novo@octaclin.local' }
      })
    );
    expect(servicoAuditoria.registrar).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'cliente-1',
        acao: 'cliente.convite.revogar',
        recursoTipo: 'usuario',
        recursoId: 'usuario-1',
        metadados: { usuarioAlvoId: 'usuario-1' }
      })
    );
  });

  it('deve auditar solicitacao comercial de ajuste de assinatura', async () => {
    const solicitacao = {
      tenantId: 'tenant-1',
      acao: 'upgrade',
      status: 'pendente',
      planoAtualId: 'profissional',
      planoAtual: 'Profissional',
      planoDesejado: 'clinica',
      observacao: 'Mais capacidade administrativa',
      solicitadoEm: '2026-07-22T10:00:00.000Z'
    };
    const servicoPortalCliente = {
      solicitarAjusteAssinatura: jest.fn(async () => solicitacao)
    };
    const servicoAuditoria = {
      registrar: jest.fn(async () => undefined)
    };
    const controlador = new ControladorPortalCliente(servicoPortalCliente as never, {} as never, servicoAuditoria as never);

    const resultado = await controlador.solicitarAjusteAssinatura(
      { tenantId: 'tenant-1', usuarioId: 'cliente-1' } as never,
      { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as never,
      { acao: 'upgrade', planoDesejado: 'clinica', observacao: 'Mais capacidade administrativa' } as never
    );

    expect(resultado).toBe(solicitacao);
    expect(servicoPortalCliente.solicitarAjusteAssinatura).toHaveBeenCalledWith('tenant-1', 'cliente-1', {
      acao: 'upgrade',
      planoDesejado: 'clinica',
      observacao: 'Mais capacidade administrativa'
    });
    expect(servicoAuditoria.registrar).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      usuarioId: 'cliente-1',
      acao: 'cliente.assinatura.solicitar_ajuste',
      recursoTipo: 'tenant',
      recursoId: 'tenant-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      metadados: {
        acao: 'upgrade',
        planoAtualId: 'profissional',
        planoDesejado: 'clinica',
        status: 'pendente'
      }
    });
  });
});
