import { ServicoWebhookWhatsapp } from './servico-webhook-whatsapp';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

describe('ServicoWebhookWhatsapp', () => {
  function criarServico(
    mensagem?: Record<string, unknown>,
    opcoes?: {
      mensagemExistente?: boolean;
      contatoPaciente?: string;
      mensagensRecentes?: Array<{ pacienteId?: string; payload: Record<string, unknown> }>;
      consulta?: Record<string, unknown>;
    }
  ) {
    const entidadeMensagem: { status: string; payload: Record<string, unknown>; erro?: string } | null = mensagem
      ? {
          status: 'enviado',
          payload: mensagem
        }
      : null;

    const repositorioMensagens = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn(() => ({
          getOne: jest.fn(async () => (opcoes?.mensagemExistente ? { id: 'mensagem-existente' } : entidadeMensagem))
        }))
      })),
      find: jest.fn(async () => opcoes?.mensagensRecentes ?? []),
      create: jest.fn((registro) => registro),
      save: jest.fn(async (registro) => registro)
    };
    const repositorioCanais = {
      find: jest.fn(async () => [
        {
          id: 'canal-whatsapp',
          tenantId: 'tenant-1',
          tipo: 'whatsapp',
          nome: 'WhatsApp',
          ativo: true,
          configuracao: { phoneNumberId: 'phone-1' }
        }
      ])
    };
    const repositorioPacientes = {
      find: jest.fn(async () => [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          contatoCriptografado: Buffer.from(opcoes?.contatoPaciente ?? '5511999999999')
        }
      ])
    };
    const repositorioConsultas = {
      findOne: jest.fn(async () => opcoes?.consulta ?? null),
      save: jest.fn(async (registro) => registro)
    };

    const fonteDados = {
      getRepository: jest.fn(() => ({
        find: jest.fn(async () => [{ id: 'tenant-1' }])
      }))
    };

    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8')),
      descriptografar: jest.fn((valor: Buffer) => valor.toString())
    };

    const executorTenant = {
      executar: jest.fn(async (_tenantId, operacao) =>
        operacao({
          getRepository: jest.fn((entidade) => {
            if (entidade === MensagemNotificacaoOrm) return repositorioMensagens;
            if (entidade === CanalNotificacaoOrm) return repositorioCanais;
            if (entidade === PacienteOrm) return repositorioPacientes;
            if (entidade === AgendaConsultaOrm) return repositorioConsultas;
            return repositorioMensagens;
          })
        })
      )
    };

    return {
      servico: new ServicoWebhookWhatsapp(fonteDados as never, executorTenant as never, criptografia as never),
      entidadeMensagem,
      repositorioMensagens,
      repositorioCanais,
      repositorioPacientes,
      repositorioConsultas,
      criptografia,
      executorTenant
    };
  }

  it('deve anexar o ultimo status Meta na mensagem correspondente', async () => {
    const { servico, entidadeMensagem, repositorioMensagens } = criarServico({
      resultadoEnvio: { idExterno: 'wamid-1' }
    });

    await expect(
      servico.registrarStatus([{ id: 'wamid-1', status: 'delivered', timestamp: '1780000000', recipient_id: '5511999999999' }])
    ).resolves.toEqual({ atualizados: 1, ignorados: 0 });

    expect(entidadeMensagem?.payload).toMatchObject({
      resultadoEnvio: { idExterno: 'wamid-1' },
      ultimoStatusMeta: {
        status: 'delivered',
        timestamp: '1780000000',
        recipientId: '5511999999999'
      }
    });
    expect(repositorioMensagens.save).toHaveBeenCalledWith(entidadeMensagem);
  });

  it('deve marcar mensagem como falhou quando a Meta reportar failed', async () => {
    const { servico, entidadeMensagem } = criarServico({
      resultadoEnvio: { idExterno: 'wamid-1' }
    });

    await servico.registrarStatus([
      {
        id: 'wamid-1',
        status: 'failed',
        errors: [{ title: 'Telefone indisponivel' }]
      }
    ]);

    expect(entidadeMensagem?.status).toBe('falhou');
    expect(entidadeMensagem?.erro).toBe('Telefone indisponivel');
  });

  it('deve ignorar status sem mensagem correspondente', async () => {
    const { servico, repositorioMensagens } = criarServico();

    await expect(servico.registrarStatus([{ id: 'wamid-inexistente', status: 'read' }])).resolves.toEqual({
      atualizados: 0,
      ignorados: 1
    });
    expect(repositorioMensagens.save).not.toHaveBeenCalled();
  });

  it('deve persistir mensagem recebida do WhatsApp e associar paciente por contato', async () => {
    const { servico, repositorioMensagens } = criarServico();

    await expect(
      servico.registrarMensagensRecebidas([
        {
          phoneNumberId: 'phone-1',
          mensagem: {
            id: 'wamid-in-1',
            from: '5511999999999',
            timestamp: '1780000000',
            type: 'text',
            text: { body: 'Oi, preciso remarcar.' }
          }
        }
      ])
    ).resolves.toEqual({ criadas: 1, ignoradas: 0 });

    expect(repositorioMensagens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        canalId: 'canal-whatsapp',
        status: 'recebido'
      })
    );

    // O roteamento fica em claro; o texto escrito pelo paciente, nao.
    const [[gravada]] = repositorioMensagens.save.mock.calls;
    expect(gravada.payload).toEqual({
      direcao: 'recebida',
      origem: 'whatsapp',
      idExterno: 'wamid-in-1',
      remetente: '5511999999999',
      phoneNumberId: 'phone-1',
      tipo: 'text',
      timestamp: '1780000000'
    });
    expect(gravada.payload).not.toHaveProperty('texto');
    expect(JSON.stringify(gravada.payload)).not.toContain('Oi, preciso remarcar.');
    expect(JSON.parse(gravada.conteudoCriptografado.toString('utf8'))).toEqual({
      texto: 'Oi, preciso remarcar.'
    });
    expect(repositorioMensagens.save).toHaveBeenCalledTimes(1);
  });

  it('deve ignorar mensagem recebida duplicada pelo id externo', async () => {
    const { servico, repositorioMensagens } = criarServico(undefined, { mensagemExistente: true });

    await expect(
      servico.registrarMensagensRecebidas([
        {
          phoneNumberId: 'phone-1',
          mensagem: { id: 'wamid-in-1', from: '5511999999999', type: 'text' }
        }
      ])
    ).resolves.toEqual({ criadas: 0, ignoradas: 1 });

    expect(repositorioMensagens.save).not.toHaveBeenCalled();
  });

  it('deve associar mensagem recebida ao paciente por envio WhatsApp anterior', async () => {
    const { servico, repositorioMensagens } = criarServico(undefined, {
      contatoPaciente: '5511888888888',
      mensagensRecentes: [
        {
          pacienteId: 'paciente-1',
          payload: { destino: '55 (11) 99999-9999' }
        }
      ]
    });

    await expect(
      servico.registrarMensagensRecebidas([
        {
          phoneNumberId: 'phone-1',
          mensagem: {
            id: 'wamid-in-2',
            from: '5511999999999',
            timestamp: '1780000001',
            type: 'text',
            text: { body: 'Obrigado.' }
          }
        }
      ])
    ).resolves.toEqual({ criadas: 1, ignoradas: 0 });

    expect(repositorioMensagens.create).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-1', status: 'recebido' })
    );

    const [[gravada]] = repositorioMensagens.save.mock.calls;
    expect(gravada.payload).toEqual(
      expect.objectContaining({ idExterno: 'wamid-in-2', remetente: '5511999999999' })
    );
    expect(gravada.payload).not.toHaveProperty('texto');
    expect(JSON.parse(gravada.conteudoCriptografado.toString('utf8'))).toEqual({ texto: 'Obrigado.' });
  });

  it('deve marcar consulta como confirmada quando paciente responde confirmo ao lembrete', async () => {
    const consulta = {
      id: 'consulta-1',
      tenantId: 'tenant-1',
      notificacoes: { lembrete24h: { status: 'processado' } },
      payload: {}
    };
    const { servico, repositorioConsultas } = criarServico(undefined, {
      contatoPaciente: '5511888888888',
      consulta,
      mensagensRecentes: [
        {
          pacienteId: 'paciente-1',
          payload: {
            destino: '5511999999999',
            consultaId: 'consulta-1',
            evento: 'agenda.consulta.lembrete'
          }
        }
      ]
    });

    await expect(
      servico.registrarMensagensRecebidas([
        {
          phoneNumberId: 'phone-1',
          mensagem: {
            id: 'wamid-in-confirmacao',
            from: '5511999999999',
            timestamp: '1780000002',
            type: 'text',
            text: { body: 'Confirmo' }
          }
        }
      ])
    ).resolves.toEqual({ criadas: 1, ignoradas: 0 });

    expect(repositorioConsultas.findOne).toHaveBeenCalledWith({ where: { id: 'consulta-1', tenantId: 'tenant-1' } });
    expect(repositorioConsultas.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'consulta-1',
        notificacoes: expect.objectContaining({
          confirmacaoPaciente: expect.objectContaining({
            status: 'confirmada',
            origem: 'whatsapp',
            texto: 'Confirmo'
          })
        })
      })
    );
  });
});
