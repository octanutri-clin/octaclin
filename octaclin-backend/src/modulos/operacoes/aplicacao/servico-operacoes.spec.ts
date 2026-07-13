import { NotFoundException } from '@nestjs/common';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';
import { ServicoOperacoes } from './servico-operacoes';

function criarServico() {
  const eventoFalho = {
    id: 'evento-1',
    tenantId: 'tenant-1',
    tipo: 'notificacao.enviar',
    payload: { mensagemId: 'mensagem-1' },
    status: 'falhou',
    tentativas: 3,
    erro: 'Redis indisponivel',
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    processadoEm: new Date()
  };
  const repositorios = {
    outbox: {
      count: jest.fn(async ({ where }: { where: { status: string } }) => {
        const mapa: Record<string, number> = { pendente: 2, processando: 1, processado: 10, falhou: 3 };
        return mapa[where.status] ?? 0;
      }),
      find: jest.fn(async () => [eventoFalho]),
      findAndCount: jest.fn(async () => [[eventoFalho], 1]),
      findOne: jest.fn(async ({ where }: { where: { id: string; status: string } }) =>
        where.id === 'evento-1' && where.status === 'falhou' ? eventoFalho : null
      ),
      save: jest.fn(async (evento: Record<string, unknown>) => evento)
    },
    mobile: {
      count: jest.fn(async ({ where }: { where: { status: string } }) => (where.status === 'sincronizado' ? 8 : 1)),
      find: jest.fn(async () => [{ idLocal: 'local-1', status: 'sincronizado' }])
    },
    auditoria: {
      find: jest.fn(async () => [{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }]),
      findAndCount: jest.fn(async () => [[{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }], 1])
    }
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      if (entidade === SincronizacaoMobileOrm) return repositorios.mobile;
      if (entidade === UserActionLogOrm) return repositorios.auditoria;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  return { servico: new ServicoOperacoes(executorTenant as never), repositorios };
}

describe('ServicoOperacoes', () => {
  it('deve consolidar resumo operacional por tenant', async () => {
    const { servico } = criarServico();

    await expect(servico.obterResumo('tenant-1')).resolves.toEqual({
      outbox: { pendente: 2, processando: 1, processado: 10, falhou: 3 },
      mobile: { sincronizado: 8, erro: 1 }
    });
  });

  it('deve recolocar evento falho de outbox como pendente', async () => {
    const { servico, repositorios } = criarServico();

    const evento = await servico.reprocessarOutbox('tenant-1', 'evento-1');

    expect(evento).toEqual(expect.objectContaining({ status: 'pendente', erro: undefined, processadoEm: undefined }));
    expect(repositorios.outbox.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'evento-1', status: 'pendente' }));
  });

  it('deve rejeitar reprocessamento de evento inexistente', async () => {
    const { servico } = criarServico();

    await expect(servico.reprocessarOutbox('tenant-1', 'evento-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve listar auditoria operacional filtrada por tenant', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.listarAuditoria('tenant-1', {
        acao: 'pacientes.listar_dados_sensiveis',
        recursoTipo: 'paciente',
        usuarioId: 'usuario-1',
        inicio: '2026-01-01T00:00:00.000Z',
        limite: 500
      })
    ).resolves.toEqual([{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }]);

    expect(repositorios.auditoria.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          acao: 'pacientes.listar_dados_sensiveis',
          recursoTipo: 'paciente',
          usuarioId: 'usuario-1'
        }),
        order: { criadoEm: 'DESC' },
        take: 100
      })
    );
  });

  it('deve listar auditoria operacional paginada', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.listarAuditoriaPaginada('tenant-1', {
        acao: 'pacientes.criar',
        pagina: 2,
        limite: 10
      })
    ).resolves.toEqual({
      itens: [{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }],
      total: 1,
      pagina: 2,
      limite: 10
    });

    expect(repositorios.auditoria.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { criadoEm: 'DESC' },
        take: 10,
        skip: 10
      })
    );
  });

  it('deve exportar falhas de outbox em CSV sem payload bruto', async () => {
    const { servico } = criarServico();

    await expect(servico.exportarFalhasOutboxCsv('tenant-1')).resolves.toContain('"criadoEm","tipo","status","tentativas","erro","mensagemId"');
  });
});
