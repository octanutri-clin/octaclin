import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServicoComunicacoes } from './servico-comunicacoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    save: jest.fn(async (entrada: Record<string, unknown>) => ({ id: `${nome}-1`, ...entrada })),
    find: jest.fn(async () => {
      if (nome === 'mensagem') return dados.mensagens ?? [];
      if (nome === 'paciente') return dados.pacientes ?? [];
      return [];
    }),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'canal') return dados.canal ?? null;
      if (nome === 'template') return dados.template ?? null;
      if (nome === 'paciente') return dados.paciente ?? null;
      if (nome === 'profissional') return dados.profissional ?? null;
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
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CanalNotificacaoOrm) return repositorios.canal;
      if (entidade === TemplateMensagemOrm) return repositorios.template;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
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
      criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', '')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
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
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
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
      expect.objectContaining({ jobId: 'mensagem-mensagem-1', attempts: 3 })
    );
  });

  it('deve ignorar publicacao na fila quando Redis nao estiver configurado', async () => {
    const { servico, fila } = criarServico({});

    await servico.publicarEventoNotificacao('tenant-1', 'mensagem-1');

    expect(fila.add).not.toHaveBeenCalled();
  });

  it('deve listar mensagens somente no contexto do tenant', async () => {
    const { servico, repositorios } = criarServico({});

    await servico.listarMensagens('tenant-1', usuarioColaborador);

    expect(repositorios.mensagem.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      order: { criadoEm: 'DESC' },
      take: 200
    });
  });

  it('deve listar mensagens apenas dos proprios pacientes quando o usuario for Professional', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' }]
    });

    await servico.listarMensagens('tenant-1', usuarioProfissional);

    expect(repositorios.paciente.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' }
    });
    expect(repositorios.mensagem.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) })
    );
  });

  it('deve retornar lista vazia quando Professional nao possui pacientes proprios', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      pacientes: []
    });

    const mensagens = await servico.listarMensagens('tenant-1', usuarioProfissional);

    expect(mensagens).toEqual([]);
    expect(repositorios.mensagem.find).not.toHaveBeenCalled();
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
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', nomeCriptografado: Buffer.from('cripto:Ana') },
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

  it('deve impedir disparo de mensagem para paciente de outro tenant', async () => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: null
    });

    await expect(
      servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-tenant-2',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.paciente.findOne).toHaveBeenCalledWith({
      where: { id: 'paciente-tenant-2', tenantId: 'tenant-1' }
    });
    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar template WhatsApp nao aprovado', async () => {
    const { servico } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: false },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
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
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
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

describe('ServicoComunicacoes - conteudo fora do payload em claro', () => {
  /*
   * `mensagens_notificacao.payload` e jsonb legivel por quem alcancar o banco ou
   * um backup. Antes disto, toda confirmacao de consulta gravava ali o nome do
   * paciente e o texto inteiro da mensagem; a declaracao de comparecimento da
   * Fase 208 gravava o corpo do documento.
   */
  it('grava roteamento em claro e conteudo criptografado ao disparar', async () => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
    });

    await servico.dispararMensagem('tenant-1', {
      pacienteId: 'paciente-1',
      canalId: 'canal-1',
      templateId: 'template-1',
      payload: {
        destino: 'ana@example.com',
        assunto: 'Declaracao de comparecimento',
        texto: 'Declaro que Ana Souza compareceu em 15/07/2026.',
        nomePaciente: 'Ana Souza',
        consultaId: 'consulta-1'
      }
    });

    const [[gravada]] = repositorios.mensagem.save.mock.calls;

    expect(gravada.payload).toEqual({ destino: 'ana@example.com', consultaId: 'consulta-1' });
    expect(JSON.stringify(gravada.payload)).not.toContain('Ana Souza');
    expect(JSON.stringify(gravada.payload)).not.toContain('compareceu');
    expect(Buffer.isBuffer(gravada.conteudoCriptografado)).toBe(true);
  });

  it('devolve o payload remontado na leitura, para a tela nao ficar sem texto', async () => {
    const { servico } = criarServico({
      mensagem: {
        id: 'mensagem-1',
        tenantId: 'tenant-1',
        payload: { destino: 'ana@example.com' },
        conteudoCriptografado: Buffer.from(`cripto:${JSON.stringify({ texto: 'Ola Ana.' })}`)
      }
    });

    const mensagem = await servico.obterMensagem('tenant-1', 'mensagem-1');

    expect(mensagem.payload).toEqual({ destino: 'ana@example.com', texto: 'Ola Ana.' });
  });

  it('nao derruba a leitura quando o conteudo esta ilegivel', async () => {
    const { servico } = criarServico({
      mensagem: {
        id: 'mensagem-1',
        tenantId: 'tenant-1',
        payload: { destino: 'ana@example.com' },
        conteudoCriptografado: Buffer.from('ruido-sem-json')
      }
    });

    const mensagem = await servico.obterMensagem('tenant-1', 'mensagem-1');

    expect(mensagem.payload.destino).toBe('ana@example.com');
    expect(mensagem.payload.conteudoIlegivel).toBe(true);
  });
});
