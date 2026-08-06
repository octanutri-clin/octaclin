import { IsNull } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { NotificacaoOrm } from '../infraestrutura/notificacao.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ServicoNotificacoes } from './servico-notificacoes';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-ana',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['console.acessar']
};

function criarServico(notificacoes: Partial<NotificacaoOrm>[] = []) {
  const repositorioNotificacoes = {
    find: jest.fn(async () => notificacoes),
    count: jest.fn(async () => notificacoes.filter((notificacao) => !notificacao.lidoEm).length),
    update: jest.fn(async (_criterio: Record<string, unknown>, _valores: Record<string, unknown>) => ({ affected: 2 }))
  };
  const repositorioPacientes = {
    find: jest.fn(async () => [{ id: 'paciente-1', nomeCriptografado: Buffer.from('Maria Souza', 'utf8') }])
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === NotificacaoOrm) return repositorioNotificacoes;
      if (entidade === PacienteOrm) return repositorioPacientes;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
  };

  return {
    servico: new ServicoNotificacoes(executorTenant as never, criptografia as never),
    repositorioNotificacoes,
    repositorioPacientes,
    executorTenant
  };
}

describe('ServicoNotificacoes', () => {
  it('le apenas a caixa do usuario do JWT', async () => {
    const { servico, repositorioNotificacoes, executorTenant } = criarServico();

    await servico.listar(usuario);

    // O isolamento entre usuarios e entre profissionais e esta clausula.
    expect(repositorioNotificacoes.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', usuarioId: 'usuario-ana' } })
    );
    expect(repositorioNotificacoes.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', usuarioId: 'usuario-ana', lidoEm: IsNull() }
    });
    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
  });

  it('resolve o nome do paciente na leitura, nao no armazenamento', async () => {
    const { servico, repositorioPacientes } = criarServico([
      {
        id: 'notificacao-1',
        tipo: 'mensagem_recebida',
        pacienteId: 'paciente-1',
        recursoTipo: 'mensagem_notificacao',
        recursoId: 'mensagem-1',
        lidoEm: null,
        criadoEm: new Date('2026-08-06T10:00:00.000Z')
      }
    ]);

    const central = await servico.listar(usuario);

    expect(repositorioPacientes.find).toHaveBeenCalled();
    expect(central.naoLidas).toBe(1);
    expect(central.itens[0]).toMatchObject({ id: 'notificacao-1', pacienteNome: 'Maria Souza' });
  });

  it('nao consulta pacientes quando nenhuma notificacao aponta para um', async () => {
    const { servico, repositorioPacientes } = criarServico([
      {
        id: 'notificacao-2',
        tipo: 'solicitacao_agendamento',
        pacienteId: null,
        recursoTipo: 'agenda_solicitacao',
        recursoId: 'solicitacao-1',
        criadoEm: new Date('2026-08-06T10:00:00.000Z')
      }
    ]);

    const central = await servico.listar(usuario);

    expect(repositorioPacientes.find).not.toHaveBeenCalled();
    expect(central.itens[0].pacienteNome).toBeUndefined();
  });

  it('respeita o limite pedido', async () => {
    const { servico, repositorioNotificacoes } = criarServico();

    await servico.listar(usuario, 5);

    expect(repositorioNotificacoes.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it('marca todas as nao lidas do proprio usuario quando nao recebe ids', async () => {
    const { servico, repositorioNotificacoes } = criarServico();

    await expect(servico.marcarLidas(usuario)).resolves.toEqual({ marcadas: 2 });

    expect(repositorioNotificacoes.update).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', usuarioId: 'usuario-ana', lidoEm: IsNull() },
      expect.objectContaining({ lidoEm: expect.any(Date) })
    );
  });

  it('nao deixa marcar como lida a notificacao de outro usuario', async () => {
    const { servico, repositorioNotificacoes } = criarServico();

    await servico.marcarLidas(usuario, ['notificacao-de-outro']);

    // O id vem do cliente, mas o `usuarioId` vem do JWT: o update nao alcanca
    // linha de outra pessoa mesmo com o id certo em maos.
    const [criterio] = repositorioNotificacoes.update.mock.calls[0];
    expect(criterio).toMatchObject({ tenantId: 'tenant-1', usuarioId: 'usuario-ana' });
  });
});
