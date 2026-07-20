import { BadRequestException } from '@nestjs/common';
import { ServicoComunicacoes } from './servico-comunicacoes';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    find: jest.fn(async () => (nome === 'mensagem' ? dados.mensagens ?? [] : [])),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'canal') return dados.canal ?? null;
      if (nome === 'template') return dados.template ?? null;
      if (nome === 'paciente') return dados.paciente ?? null;
      return consulta.where.id ? dados.mensagem ?? null : null;
    })
  };
}

function criarServico(dados: Record<string, unknown>) {
  const repositorios = {
    canal: criarRepositorioFake('canal', dados),
    template: criarRepositorioFake('template', dados),
    mensagem: criarRepositorioFake('mensagem', dados),
    outbox: criarRepositorioFake('outbox', dados),
    paciente: criarRepositorioFake('paciente', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CanalNotificacaoOrm) return repositorios.canal;
      if (entidade === TemplateMensagemOrm) return repositorios.template;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      if (entidade === PacienteOrm) return repositorios.paciente;
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
    servico: new ServicoComunicacoes(executorTenant as never, fila as never, {
      criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`))
    } as never),
    fila,
    repositorios
  };
}

describe('ServicoComunicacoes', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORTA;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

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
    process.env.REDIS_URL = 'rediss://default:senha@redis.example.com:6379';

    await servico.publicarEventoNotificacao('tenant-1', 'mensagem-1');

    expect(fila.add).toHaveBeenCalledWith(
      'enviar',
      { tenantId: 'tenant-1', mensagemId: 'mensagem-1' },
      expect.objectContaining({ jobId: 'mensagem:mensagem-1', attempts: 3 })
    );
  });

  it('deve ignorar publicacao na fila quando Redis nao estiver configurado', async () => {
    const { servico, fila } = criarServico({});

    await servico.publicarEventoNotificacao('tenant-1', 'mensagem-1');

    expect(fila.add).not.toHaveBeenCalled();
  });

  it('deve listar mensagens somente no contexto do tenant', async () => {
    const { servico, repositorios } = criarServico({});

    await servico.listarMensagens('tenant-1');

    expect(repositorios.mensagem.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      order: { criadoEm: 'DESC' },
      take: 200
    });
  });

  it('deve associar mensagens WhatsApp de um contato a um paciente', async () => {
    const mensagemRecebida = {
      id: 'mensagem-1',
      tenantId: 'tenant-1',
      payload: { origem: 'whatsapp', remetente: '+55 11 99236-2080', texto: 'Ola' }
    };
    const mensagemEnviada = {
      id: 'mensagem-2',
      tenantId: 'tenant-1',
      canalId: 'canal-whatsapp',
      payload: { destino: '5511992362080', observacao: 'Resposta' }
    };
    const { servico, repositorios } = criarServico({
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' },
      mensagens: [mensagemRecebida, mensagemEnviada, { id: 'mensagem-3', tenantId: 'tenant-1', payload: { remetente: '5511888888888' } }]
    });

    const resultado = await servico.associarContatoWhatsapp('tenant-1', {
      contato: '5511992362080',
      pacienteId: 'paciente-1',
      atualizarContatoPaciente: true
    });

    expect(resultado).toEqual({
      pacienteId: 'paciente-1',
      contato: '5511992362080',
      mensagensAtualizadas: 2,
      contatoPacienteAtualizado: true
    });
    expect(repositorios.mensagem.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'mensagem-1', pacienteId: 'paciente-1' }),
      expect.objectContaining({ id: 'mensagem-2', pacienteId: 'paciente-1' })
    ]);
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'paciente-1', contatoCriptografado: Buffer.from('cripto:5511992362080') })
    );
  });

  it('deve registrar nota interna WhatsApp sem criar evento de envio', async () => {
    const { servico, repositorios } = criarServico({
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
    });

    const nota = await servico.registrarNotaWhatsapp('tenant-1', {
      contato: '5511992362080',
      pacienteId: 'paciente-1',
      texto: 'Paciente pediu retorno amanha.',
      statusAtendimento: 'acompanhamento'
    });

    expect(nota).toEqual(
      expect.objectContaining({
        id: 'mensagem-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        status: 'nota',
        payload: expect.objectContaining({
          origem: 'whatsapp',
          direcao: 'nota',
          tipo: 'nota_interna',
          contato: '5511992362080',
          texto: 'Paciente pediu retorno amanha.',
          statusAtendimento: 'acompanhamento'
        })
      })
    );
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
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
