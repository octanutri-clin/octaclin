import { BadRequestException } from '@nestjs/common';
import { ServicoComunicacoes } from './servico-comunicacoes';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'canal') return dados.canal ?? null;
      if (nome === 'template') return dados.template ?? null;
      return consulta.where.id ? dados.mensagem ?? null : null;
    })
  };
}

function criarServico(dados: Record<string, unknown>) {
  const repositorios = {
    canal: criarRepositorioFake('canal', dados),
    template: criarRepositorioFake('template', dados),
    mensagem: criarRepositorioFake('mensagem', dados),
    outbox: criarRepositorioFake('outbox', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CanalNotificacaoOrm) return repositorios.canal;
      if (entidade === TemplateMensagemOrm) return repositorios.template;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const fila = {
    add: jest.fn(async () => undefined)
  };

  return {
    servico: new ServicoComunicacoes(executorTenant as never, fila as never),
    fila,
    repositorios
  };
}

describe('ServicoComunicacoes', () => {
  it('deve criar mensagem pendente e evento outbox na mesma transacao', async () => {
    const { servico, fila, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true }
    });

    const mensagem = await servico.dispararMensagem('tenant-1', {
      pacienteId: 'paciente-1',
      canalId: 'canal-1',
      templateId: 'template-1',
      payload: { destino: 'paciente@example.com' }
    });

    expect(repositorios.mensagem.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        status: 'pendente',
        payload: { destino: 'paciente@example.com' }
      })
    );
    expect(repositorios.outbox.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tipo: 'notificacao.enviar',
        status: 'pendente',
        payload: { mensagemId: mensagem.id }
      })
    );
    expect(fila.add).not.toHaveBeenCalled();
  });

  it('deve publicar evento de notificacao na fila com job idempotente', async () => {
    const { servico, fila } = criarServico({});

    await servico.publicarEventoNotificacao('tenant-1', 'mensagem-1');

    expect(fila.add).toHaveBeenCalledWith(
      'enviar',
      { tenantId: 'tenant-1', mensagemId: 'mensagem-1' },
      expect.objectContaining({ jobId: 'mensagem:mensagem-1', attempts: 3 })
    );
  });

  it('deve listar mensagens somente no contexto do tenant', async () => {
    const { servico, repositorios } = criarServico({});

    await servico.listarMensagens('tenant-1');

    expect(repositorios.mensagem.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      order: { criadoEm: 'DESC' },
      take: 50
    });
  });

  it('deve rejeitar template WhatsApp nao aprovado', async () => {
    const { servico } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: false }
    });

    await expect(
      servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: '+5511999999999' }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve rejeitar template incompativel com canal', async () => {
    const { servico } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true }
    });

    await expect(
      servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
