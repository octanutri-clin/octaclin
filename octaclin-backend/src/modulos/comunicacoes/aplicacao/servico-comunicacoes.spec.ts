import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ServicoComunicacoes } from './servico-comunicacoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';
import { PlanoAlimentarOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar.orm';
import { EnvioMaterialPacienteOrm } from '../../materiais/infraestrutura/envio-material-paciente.orm';

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
      if (nome === 'canal') return dados.canais ?? (dados.canal ? [dados.canal] : []);
      if (nome === 'template') return dados.templates ?? (dados.template ? [dados.template] : []);
      if (nome === 'plano') return dados.plano ? [dados.plano] : [];
      if (nome === 'envio') return dados.envio ? [dados.envio] : [];
      return [];
    }),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
      if (nome === 'canal') return dados.canal ?? (dados.canais as Record<string, unknown>[] | undefined)?.find((item) => item.id === consulta.where.id) ?? null;
      if (nome === 'template') return dados.template ?? (dados.templates as Record<string, unknown>[] | undefined)?.find((item) => item.id === consulta.where.id) ?? null;
      if (nome === 'plano') return dados.plano ?? null;
      if (nome === 'envio') {
        const envio = dados.envio as Record<string, unknown> | undefined;
        if (!envio) return null;
        if (consulta.where.id && consulta.where.id !== envio.id) return null;
        if (consulta.where.tenantId && consulta.where.tenantId !== envio.tenantId) return null;
        if (consulta.where.status && consulta.where.status !== envio.status) return null;
        if ('visualizadoEm' in consulta.where && envio.visualizadoEm != null) return null;
        return envio;
      }
      if (nome === 'paciente') {
        const paciente = dados.paciente as Record<string, unknown> | undefined;
        if (!paciente) return null;
        return Object.entries(consulta.where).every(([chave, valor]) => paciente[chave] === valor)
          ? paciente
          : null;
      }
      if (nome === 'profissional') return dados.profissional ?? null;
      if (nome === 'mensagem' && consulta.where.criadoEm) return dados.mensagemRecente ?? null;
      return consulta.where.id || consulta.where.chaveIdempotencia ? dados.mensagem ?? null : null;
    })
  };
}

function criarServico(dados: Record<string, unknown>) {
  const repositorios = {
    canal: criarRepositorioFake('canal', dados),
    template: criarRepositorioFake('template', dados),
    plano: criarRepositorioFake('plano', dados),
    envio: criarRepositorioFake('envio', dados),
    mensagem: criarRepositorioFake('mensagem', dados),
    outbox: criarRepositorioFake('outbox', dados),
    paciente: criarRepositorioFake('paciente', dados),
    profissional: criarRepositorioFake('profissional', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CanalNotificacaoOrm) return repositorios.canal;
      if (entidade === TemplateMensagemOrm) return repositorios.template;
      if (entidade === PlanoAlimentarOrm) return repositorios.plano;
      if (entidade === EnvioMaterialPacienteOrm) return repositorios.envio;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    }),
    query: jest.fn(async () => [{ bloqueado: true }])
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const fila = {
    add: jest.fn(async () => undefined)
  };

  const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', '')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
  };

  return {
    servico: new ServicoComunicacoes(executorTenant as never, fila as never, criptografia as never),
    fila,
    repositorios,
    gerenciador,
    criptografia
  };
}

describe('ServicoComunicacoes', () => {
  it('bloqueia a mensagem do motor legado apos o cutover sob o mesmo lock da politica', async () => {
    const { servico, gerenciador, repositorios } = criarServico({});
    gerenciador.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ bloqueado: true }]);
    await expect(servico.dispararMensagemSistema('tenant-1', {
      pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1',
      chaveIdempotencia: 'agenda-followup:consulta-1:1:2',
      payload: { evento: 'agenda.consulta.lembrete' }
    })).rejects.toThrow('Calendario configuravel ja assumiu');
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['followup-padrao:tenant-1']);
    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
  });
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

  it('instala somente modelos iniciais ausentes no tenant e preserva os personalizados', async () => {
    const { servico, repositorios, gerenciador } = criarServico({});
    repositorios.template.find.mockResolvedValueOnce([
      { id: 'existente-1', tenantId: 'tenant-1', codigoExterno: 'octaclin_inicial_boas_vindas', nome: 'Personalizado' }
    ]);

    const resultado = await servico.instalarTemplatesIniciais('tenant-1');

    expect(repositorios.template.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [expect.stringContaining('tenant-1')]);
    expect(resultado.criados).toHaveLength(7);
    expect(repositorios.template.save).toHaveBeenCalledTimes(7);
    expect(repositorios.template.save).not.toHaveBeenCalledWith(expect.objectContaining({ codigoExterno: 'octaclin_inicial_boas_vindas' }));
    expect(repositorios.template.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', canal: 'email', aprovado: false }));
    expect(repositorios.template.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', canal: 'email', codigoExterno: 'octaclin_inicial_retorno', aprovado: false }));
    expect(repositorios.template.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'octaclin_plano_publicado', aprovado: false }));
  });

  it('seleciona só o e-mail quando a preferência é qualquer e nunca inclui dados do plano', async () => {
    const { servico, repositorios } = criarServico({
      canais: [{ id: 'canal-email', tenantId: 'tenant-1', tipo: 'email', ativo: true }],
      templates: [{ id: 'template-email', tenantId: 'tenant-1', canal: 'email', codigoExterno: 'octaclin_inicial_plano_publicado', aprovado: false }],
      plano: { id: 'plano-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', versaoPublicadaAtualId: 'versao-1', arquivadoEm: null },
      paciente: {
        id: 'paciente-1', tenantId: 'tenant-1',
        contatoCriptografado: Buffer.from('cripto:{"email":"paciente@example.com","preferencias":{"email":true,"whatsapp":true,"canalPreferido":"qualquer","horarioPermitido":{"inicio":"00:00","fim":"23:59","timezone":"UTC"}}}')
      }
    });

    await servico.processarAvisoPlanoPublicado('tenant-1', {
      pacienteId: 'paciente-1', planoId: 'plano-1', versaoId: 'versao-1'
    });

    expect(repositorios.mensagem.save).toHaveBeenCalledWith(expect.objectContaining({
      canalId: 'canal-email', templateId: 'template-email',
      chaveIdempotencia: 'plano-publicado:paciente-1:versao-1:email',
      payload: { destino: 'paciente@example.com', evento: 'automacao.regra.template' }
    }));
  });

  it('não encaminha canal externo quando a versão saiu de vigência ou o plano foi arquivado', async () => {
    const { servico, repositorios } = criarServico({ plano: null });

    await servico.processarAvisoPlanoPublicado('tenant-1', {
      pacienteId: 'paciente-1', planoId: 'plano-1', versaoId: 'versao-1'
    });

    expect(repositorios.plano.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'plano-1', tenantId: 'tenant-1', pacienteId: 'paciente-1',
        versaoPublicadaAtualId: 'versao-1', arquivadoEm: expect.anything()
      })
    });
    expect(repositorios.template.save).not.toHaveBeenCalled();
    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
  });

  it('registra lembrete cifrado no portal e enfileira um canal externo permitido', async () => {
    const { servico, repositorios } = criarServico({
      envio: { id: 'envio-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'enviado', visualizadoEm: null },
      paciente: {
        id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null,
        contatoCriptografado: Buffer.from('cripto:{"email":"paciente@example.com","preferencias":{"email":true,"whatsapp":true,"canalPreferido":"qualquer","horarioPermitido":{"inicio":"00:00","fim":"23:59","timezone":"UTC"}}}')
      },
      canais: [{ id: 'canal-email', tenantId: 'tenant-1', tipo: 'email', ativo: true }],
      templates: [{ id: 'template-email', tenantId: 'tenant-1', canal: 'email', codigoExterno: 'octaclin_inicial_material_nao_visualizado', aprovado: false }]
    });

    await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:2026-10-01T00:00:00.000Z'
    });

    expect(repositorios.envio.findOne).toHaveBeenCalledWith({ where: {
      id: 'envio-1', tenantId: 'tenant-1', status: 'enviado', visualizadoEm: expect.anything()
    } });
    expect(repositorios.mensagem.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'enviado',
      chaveIdempotencia: 'material-nao-visualizado:envio-1:2026-10-01T00:00:00.000Z:portal',
      payload: { evento: 'material_nao_visualizado_portal' }
    }));
    expect(repositorios.mensagem.save).toHaveBeenCalledWith(expect.objectContaining({
      canalId: 'canal-email', templateId: 'template-email',
      chaveIdempotencia: 'material-nao-visualizado:envio-1:2026-10-01T00:00:00.000Z:email'
    }));
  });

  it('nao cria lembrete se o material ja foi visualizado', async () => {
    const { servico, repositorios } = criarServico({
      envio: { id: 'envio-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'visualizado', visualizadoEm: new Date() }
    });

    await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:2026-10-01T00:00:00.000Z'
    });

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.template.save).not.toHaveBeenCalled();
  });

  it('nao atravessa tenant ao resolver um envio indicado pelo evento de outbox', async () => {
    const { servico, repositorios } = criarServico({
      envio: { id: 'envio-1', tenantId: 'tenant-2', pacienteId: 'paciente-2', status: 'enviado', visualizadoEm: null }
    });

    await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:4'
    });

    expect(repositorios.envio.findOne).toHaveBeenCalledWith({ where: {
      id: 'envio-1', tenantId: 'tenant-1', status: 'enviado', visualizadoEm: expect.anything()
    } });
    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
  });

  it('mantem o aviso no portal mesmo com opt-out de todos os canais externos', async () => {
    const { servico, repositorios, criptografia } = criarServico({
      envio: { id: 'envio-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'enviado', visualizadoEm: null },
      paciente: {
        id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null,
        contatoCriptografado: Buffer.from('cripto:{"email":"paciente@example.com","whatsapp":"5511999999999","preferencias":{"email":false,"whatsapp":false,"canalPreferido":"qualquer"}}')
      },
      canais: [
        { id: 'canal-email', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        { id: 'canal-whatsapp', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true }
      ]
    });

    await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:1'
    });

    expect(repositorios.mensagem.save).toHaveBeenCalledTimes(1);
    expect(criptografia.criptografar).toHaveBeenCalledWith(expect.stringContaining('Um material educativo'));
    expect(criptografia.criptografar.mock.calls[0][0]).not.toContain('material-1');
  });

  it('usa o WhatsApp somente quando preferido e com template aprovado', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
    try {
      const { servico, repositorios } = criarServico({
        envio: { id: 'envio-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'enviado', visualizadoEm: null },
        paciente: {
          id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null,
          contatoCriptografado: Buffer.from('cripto:{"whatsapp":"5511999999999","preferencias":{"email":true,"whatsapp":true,"canalPreferido":"whatsapp","horarioPermitido":{"inicio":"00:00","fim":"23:59","timezone":"UTC"}}}')
        },
        canais: [{ id: 'canal-whatsapp', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true }],
        templates: [{ id: 'template-whatsapp', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'octaclin_material_nao_visualizado', aprovado: true }]
      });

      await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
        envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:2'
      });

      expect(repositorios.mensagem.save).toHaveBeenCalledWith(expect.objectContaining({
        canalId: 'canal-whatsapp', templateId: 'template-whatsapp',
        chaveIdempotencia: 'material-nao-visualizado:envio-1:2:whatsapp'
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('nao encaminha WhatsApp quando o template ainda nao foi aprovado', async () => {
    const { servico, repositorios } = criarServico({
      envio: { id: 'envio-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'enviado', visualizadoEm: null },
      paciente: {
        id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: null,
        contatoCriptografado: Buffer.from('cripto:{"whatsapp":"5511999999999","preferencias":{"whatsapp":true,"canalPreferido":"whatsapp"}}')
      },
      canais: [{ id: 'canal-whatsapp', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true }],
      templates: [{ id: 'template-whatsapp', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'octaclin_material_nao_visualizado', aprovado: false }]
    });

    await servico.processarLembreteMaterialNaoVisualizado('tenant-1', {
      envioId: 'envio-1', chaveIdempotencia: 'material-nao-visualizado:envio-1:3'
    });

    expect(repositorios.mensagem.save).toHaveBeenCalledTimes(1);
    expect(repositorios.mensagem.save).toHaveBeenCalledWith(expect.objectContaining({
      payload: { evento: 'material_nao_visualizado_portal' }
    }));
  });

  it('edita template do tenant sem trocar o canal e recusa id de outro tenant', async () => {
    const template = { id: 'template-1', tenantId: 'tenant-1', canal: 'email', nome: 'Antigo', conteudo: { corpo: 'Antigo' }, aprovado: false };
    const { servico, repositorios } = criarServico({ template });
    const dados = { canal: 'email' as const, nome: 'Novo', conteudo: { assunto: 'Novo', corpo: 'Olá' }, aprovado: true };

    await expect(servico.atualizarTemplate('tenant-1', 'template-1', dados)).resolves.toMatchObject({ nome: 'Novo', conteudo: dados.conteudo });
    expect(repositorios.template.findOne).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1', id: 'template-1' } });
    expect(repositorios.template.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', canal: 'email', nome: 'Novo' }));

    const outro = criarServico({ template: null });
    await expect(outro.servico.atualizarTemplate('tenant-1', 'template-de-outro-tenant', dados)).rejects.toThrow(NotFoundException);
    expect(outro.repositorios.template.save).not.toHaveBeenCalled();
  });

  it('retira aprovação de template WhatsApp ao alterar conteúdo ou código externo', async () => {
    const { servico } = criarServico({ template: {
      id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', codigoExterno: 'codigo_antigo',
      nome: 'Antigo', conteudo: { corpo: 'Antigo' }, aprovado: true
    } });
    const atualizado = await servico.atualizarTemplate('tenant-1', 'template-1', {
      canal: 'whatsapp', codigoExterno: 'codigo_novo', nome: 'Novo', conteudo: { corpo: 'Novo' }, aprovado: true
    });
    expect(atualizado.aprovado).toBe(false);
    await expect(servico.atualizarTemplate('tenant-1', 'template-1', {
      canal: 'email', nome: 'Troca', conteudo: { corpo: 'Troca' }
    })).rejects.toThrow(BadRequestException);
  });

  it('preserva codigo estavel de modelo inicial ao editar o texto', async () => {
    const { servico, repositorios } = criarServico({ template: {
      id: 'template-1', tenantId: 'tenant-1', canal: 'email',
      codigoExterno: 'octaclin_inicial_boas_vindas', nome: 'Original',
      conteudo: { corpo: 'Original' }, aprovado: false
    } });
    await expect(servico.atualizarTemplate('tenant-1', 'template-1', {
      canal: 'email', codigoExterno: 'codigo_alterado', nome: 'Editado', conteudo: { corpo: 'Editado' }
    })).rejects.toThrow(BadRequestException);
    expect(repositorios.template.save).not.toHaveBeenCalled();

    await expect(servico.atualizarTemplate('tenant-1', 'template-1', {
      canal: 'email', codigoExterno: 'octaclin_inicial_boas_vindas', nome: 'Editado',
      conteudo: { corpo: 'Editado' }
    })).resolves.toMatchObject({ nome: 'Editado' });
  });

  it('preserva o identificador do template WhatsApp de plano e remove aprovação ao editar conteúdo', async () => {
    const { servico, repositorios } = criarServico({ template: {
      id: 'template-plano-whatsapp', tenantId: 'tenant-1', canal: 'whatsapp',
      codigoExterno: 'octaclin_plano_publicado', nome: 'Plano publicado',
      conteudo: { idioma: 'pt_BR', components: [] }, aprovado: true
    } });

    await expect(servico.atualizarTemplate('tenant-1', 'template-plano-whatsapp', {
      canal: 'whatsapp', codigoExterno: 'nome_meta_diferente', nome: 'Plano', conteudo: { idioma: 'pt_BR', components: [] }
    })).rejects.toThrow(BadRequestException);
    expect(repositorios.template.save).not.toHaveBeenCalled();

    await expect(servico.atualizarTemplate('tenant-1', 'template-plano-whatsapp', {
      canal: 'whatsapp', codigoExterno: 'octaclin_plano_publicado', nome: 'Plano',
      conteudo: { idioma: 'pt_BR', components: [{ type: 'BODY' }] }, aprovado: true
    })).resolves.toMatchObject({ aprovado: false });
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
    }, usuarioColaborador);

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

  it('deve enfileirar mensagem de automacao com outbox, lock e chave idempotente', async () => {
    const contato = JSON.stringify({
      email: 'paciente@example.com',
      preferencias: {
        email: true,
        whatsapp: true,
        canalPreferido: 'qualquer',
        horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
      }
    });
    const { servico, repositorios, gerenciador } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: false },
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        contatoCriptografado: Buffer.from(`cripto:${contato}`)
      }
    });

    await expect(
      servico.enfileirarMensagemAutomacao(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          intervaloMinimoHoras: 24,
          chaveIdempotencia: 'automacao:execucao-1:acao:0'
        },
        new Date('2026-09-19T13:00:00.000Z')
      )
    ).resolves.toEqual({ status: 'enfileirada', mensagemId: 'mensagem-1' });

    expect(gerenciador.query).toHaveBeenCalledWith(
      'select pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['automacao-comunicacao:tenant-1:paciente-1:canal-1']
    );
    expect(repositorios.mensagem.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        status: 'pendente',
        categoria: 'administrativo',
        chaveIdempotencia: 'automacao:execucao-1:acao:0',
        payload: { destino: 'paciente@example.com', evento: 'automacao.regra.template' }
      })
    );
    expect(repositorios.outbox.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tipo: 'notificacao.enviar',
        status: 'pendente',
        payload: { mensagemId: 'mensagem-1' }
      })
    );
  });

  it('deve devolver a mensagem existente antes de reavaliar politicas no retry idempotente', async () => {
    const { servico, repositorios } = criarServico({ mensagem: { id: 'mensagem-existente' } });

    await expect(
      servico.enfileirarMensagemAutomacao('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        intervaloMinimoHoras: 24,
        chaveIdempotencia: 'automacao:execucao-1:acao:0'
      })
    ).resolves.toEqual({ status: 'enfileirada', mensagemId: 'mensagem-existente' });

    expect(repositorios.paciente.findOne).not.toHaveBeenCalled();
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
  });

  it.each([
    {
      nome: 'opt-out',
      contato: {
        email: 'paciente@example.com',
        preferencias: { email: false, whatsapp: true, canalPreferido: 'qualquer' }
      },
      agora: '2026-09-19T13:00:00.000Z',
      motivo: 'opt_out'
    },
    {
      nome: 'fora da janela',
      contato: {
        email: 'paciente@example.com',
        preferencias: {
          email: true,
          whatsapp: true,
          canalPreferido: 'qualquer',
          horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
        }
      },
      agora: '2026-09-19T02:00:00.000Z',
      motivo: 'fora_horario_permitido'
    }
  ])('deve ignorar automacao por $nome sem criar mensagem', async ({ contato, agora, motivo }) => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        contatoCriptografado: Buffer.from(`cripto:${JSON.stringify(contato)}`)
      }
    });

    await expect(
      servico.enfileirarMensagemAutomacao(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          intervaloMinimoHoras: 24,
          chaveIdempotencia: 'automacao:execucao-1:acao:0'
        },
        new Date(agora)
      )
    ).resolves.toEqual({ status: 'ignorada', motivo });

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
  });

  it('deve aplicar limite de frequencia somente depois das preferencias e antes do outbox', async () => {
    const contato = JSON.stringify({
      whatsapp: '5511999999999',
      preferencias: {
        email: true,
        whatsapp: true,
        canalPreferido: 'whatsapp',
        horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
      }
    });
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        contatoCriptografado: Buffer.from(`cripto:${contato}`)
      },
      mensagemRecente: { id: 'mensagem-recente' }
    });

    await expect(
      servico.enfileirarMensagemAutomacao(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          intervaloMinimoHoras: 24,
          chaveIdempotencia: 'automacao:execucao-1:acao:0'
        },
        new Date('2026-09-19T13:00:00.000Z')
      )
    ).resolves.toEqual({ status: 'ignorada', motivo: 'limite_frequencia' });

    expect(repositorios.mensagem.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        canalId: 'canal-1'
      })
    });
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
  });

  it('deve recusar recurso removido ou template WhatsApp nao aprovado sem retry externo', async () => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: false },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
    });

    await expect(
      servico.enfileirarMensagemAutomacao('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        intervaloMinimoHoras: 24,
        chaveIdempotencia: 'automacao:execucao-1:acao:0'
      })
    ).resolves.toEqual({ status: 'indisponivel', motivo: 'template_indisponivel' });

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
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

  it('deve negar disparo para paciente de outro profissional do mesmo tenant', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-2', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-2' }
    });

    await expect(
      servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-2',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      }, usuarioProfissional)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.outbox.save).not.toHaveBeenCalled();
  });

  it('deve permitir disparo para paciente da carteira do Professional', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' }
    });

    await expect(
      servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      }, usuarioProfissional)
    ).resolves.toEqual(expect.objectContaining({ pacienteId: 'paciente-1', status: 'pendente' }));

    expect(repositorios.paciente.findOne).toHaveBeenCalledWith({
      where: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1'
      }
    });
  });

  describe('opt-out no disparo manual', () => {
    function pacienteComPreferencia(preferencias: Record<string, unknown>) {
      return {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        contatoCriptografado: Buffer.from(`cripto:${JSON.stringify({ preferencias })}`)
      };
    }

    it('deve recusar disparo manual quando o paciente optou por nao receber no canal', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
        paciente: pacienteComPreferencia({ whatsapp: false })
      });

      await expect(
        servico.dispararMensagem('tenant-1', {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          payload: { destino: '5511999999999' }
        }, usuarioColaborador)
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repositorios.mensagem.save).not.toHaveBeenCalled();
      expect(repositorios.outbox.save).not.toHaveBeenCalled();
    });

    it('deve permitir o disparo quando o chamador confirma explicitamente com ignorarOptOut', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
        paciente: pacienteComPreferencia({ whatsapp: false })
      });

      await expect(
        servico.dispararMensagem('tenant-1', {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          payload: { destino: '5511999999999' },
          ignorarOptOut: true
        }, usuarioColaborador)
      ).resolves.toEqual(expect.objectContaining({ status: 'pendente' }));

      expect(repositorios.mensagem.save).toHaveBeenCalled();
    });

    it('deve permitir o disparo quando o paciente autorizou o canal', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
        paciente: pacienteComPreferencia({ whatsapp: true })
      });

      await expect(
        servico.dispararMensagem('tenant-1', {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          payload: { destino: '5511999999999' }
        }, usuarioColaborador)
      ).resolves.toEqual(expect.objectContaining({ status: 'pendente' }));

      expect(repositorios.mensagem.save).toHaveBeenCalled();
    });

    it('nao deve checar opt-out em disparo de sistema (automacoes ja tem sua propria checagem)', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'whatsapp', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'whatsapp', aprovado: true },
        paciente: pacienteComPreferencia({ whatsapp: false })
      });

      await expect(
        servico.dispararMensagemSistema('tenant-1', {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          payload: { destino: '5511999999999' }
        })
      ).resolves.toEqual(expect.objectContaining({ status: 'pendente' }));

      expect(repositorios.mensagem.save).toHaveBeenCalled();
    });
  });

  describe('idempotencia do disparo', () => {
    it('deve gravar a chave de idempotencia na mensagem criada', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
        paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
      });

      await servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' },
        chaveIdempotencia: 'lembrete-consulta-42'
      }, usuarioColaborador);

      expect(repositorios.mensagem.save).toHaveBeenCalledWith(
        expect.objectContaining({ chaveIdempotencia: 'lembrete-consulta-42' })
      );
    });

    it('deve retornar a mensagem existente sem criar nova quando a chave ja foi usada', async () => {
      const mensagemExistente = {
        id: 'mensagem-existente-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        status: 'pendente',
        chaveIdempotencia: 'lembrete-consulta-42'
      };
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
        paciente: { id: 'paciente-1', tenantId: 'tenant-1' },
        mensagem: mensagemExistente
      });

      const resultado = await servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' },
        chaveIdempotencia: 'lembrete-consulta-42'
      }, usuarioColaborador);

      expect(resultado).toBe(mensagemExistente);
      expect(repositorios.mensagem.save).not.toHaveBeenCalled();
      expect(repositorios.outbox.save).not.toHaveBeenCalled();
    });

    it('deve criar mensagens distintas para chamadas sem chave de idempotencia', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
        paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
      });

      await servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      }, usuarioColaborador);
      await servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' }
      }, usuarioColaborador);

      expect(repositorios.mensagem.save).toHaveBeenCalledTimes(2);
      expect(repositorios.outbox.save).toHaveBeenCalledTimes(2);
    });

    /**
     * Simula a corrida real: duas requisicoes concorrentes passam pela
     * checagem previa (nenhuma encontra a mensagem ainda) e so o banco, via o
     * indice unico parcial, rejeita a segunda gravacao. O servico deve
     * absorver o erro 23505 e devolver a mensagem que venceu a corrida, em
     * vez de propagar um 500 para o chamador.
     */
    it('deve absorver conflito de indice unico sob concorrencia e devolver a mensagem vencedora', async () => {
      const mensagemVencedora = {
        id: 'mensagem-vencedora-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        status: 'pendente',
        chaveIdempotencia: 'lembrete-consulta-42'
      };
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
        paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
      });
      const erroPostgres = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_mensagens_notificacao_tenant_chave_idempotencia'
      });
      repositorios.mensagem.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mensagemVencedora);
      repositorios.mensagem.save.mockImplementationOnce(async () => {
        throw new QueryFailedError('insert into mensagens_notificacao', [], erroPostgres);
      });

      const resultado = await servico.dispararMensagem('tenant-1', {
        pacienteId: 'paciente-1',
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: { destino: 'paciente@example.com' },
        chaveIdempotencia: 'lembrete-consulta-42'
      }, usuarioColaborador);

      expect(resultado).toBe(mensagemVencedora);
      expect(repositorios.outbox.save).not.toHaveBeenCalled();
    });

    it('deve propagar outros erros de gravacao sem tratar como conflito de idempotencia', async () => {
      const { servico, repositorios } = criarServico({
        canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
        template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
        paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
      });
      repositorios.mensagem.save.mockImplementationOnce(async () => {
        throw new Error('falha de conexao com o banco');
      });

      await expect(
        servico.dispararMensagem('tenant-1', {
          pacienteId: 'paciente-1',
          canalId: 'canal-1',
          templateId: 'template-1',
          payload: { destino: 'paciente@example.com' },
          chaveIdempotencia: 'lembrete-consulta-42'
        }, usuarioColaborador)
      ).rejects.toThrow('falha de conexao com o banco');
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
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', nomeCriptografado: Buffer.from('cripto:Ana') },
      mensagens: [mensagemRecebida, mensagemEnviada, { id: 'mensagem-3', tenantId: 'tenant-1', payload: { remetente: '5511888888888' } }]
    });

    const resultado = await servico.associarContatoWhatsapp('tenant-1', {
      contato: '5511992362080',
      pacienteId: 'paciente-1',
      atualizarContatoPaciente: true
    }, usuarioColaborador);

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

  it('nao associa mensagem usando recipientId herdado do prototipo', async () => {
    const ultimoStatusMeta = Object.create({ recipientId: '5511992362080' }) as Record<string, unknown>;
    const { servico, repositorios } = criarServico({
      paciente: { id: 'paciente-1', tenantId: 'tenant-1', nomeCriptografado: Buffer.from('cripto:Ana') },
      mensagens: [{
        id: 'mensagem-herdada',
        tenantId: 'tenant-1',
        payload: { origem: 'whatsapp', ultimoStatusMeta }
      }]
    });

    const resultado = await servico.associarContatoWhatsapp('tenant-1', {
      contato: '5511992362080',
      pacienteId: 'paciente-1'
    }, usuarioColaborador);

    expect(resultado.mensagensAtualizadas).toBe(0);
    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
  });

  it('deve negar associacao WhatsApp a paciente de outro profissional do mesmo tenant', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      paciente: { id: 'paciente-2', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-2' },
      mensagens: [{ id: 'mensagem-1', tenantId: 'tenant-1', payload: { origem: 'whatsapp', remetente: '5511992362080' } }]
    });

    await expect(
      servico.associarContatoWhatsapp('tenant-1', {
        contato: '5511992362080',
        pacienteId: 'paciente-2'
      }, usuarioProfissional)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
    expect(repositorios.paciente.save).not.toHaveBeenCalled();
  });

  it('nao reatribui ao Professional mensagem ja vinculada a outro paciente', async () => {
    const mensagemSemPaciente = {
      id: 'mensagem-livre',
      tenantId: 'tenant-1',
      payload: { origem: 'whatsapp', remetente: '5511992362080' }
    };
    const mensagemDeOutroPaciente = {
      id: 'mensagem-alheia',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-2',
      payload: { origem: 'whatsapp', remetente: '5511992362080' }
    };
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      paciente: {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Ana')
      },
      mensagens: [mensagemSemPaciente, mensagemDeOutroPaciente]
    });

    const resultado = await servico.associarContatoWhatsapp('tenant-1', {
      contato: '5511992362080',
      pacienteId: 'paciente-1'
    }, usuarioProfissional);

    expect(resultado.mensagensAtualizadas).toBe(1);
    expect(repositorios.mensagem.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'mensagem-livre', pacienteId: 'paciente-1' })
    ]);
    expect(mensagemDeOutroPaciente.pacienteId).toBe('paciente-2');
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
    }, usuarioColaborador);

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

  it('deve negar nota interna em paciente de outro profissional do mesmo tenant', async () => {
    const { servico, repositorios } = criarServico({
      profissional: { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' },
      paciente: { id: 'paciente-2', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-2' }
    });

    await expect(
      servico.registrarNotaWhatsapp('tenant-1', {
        contato: '5511992362080',
        pacienteId: 'paciente-2',
        texto: 'Contato clinico restrito.',
        statusAtendimento: 'acompanhamento'
      }, usuarioProfissional)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.mensagem.save).not.toHaveBeenCalled();
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
      }, usuarioColaborador)
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
      }, usuarioColaborador)
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
      }, usuarioColaborador)
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
    }, usuarioColaborador);

    const [[gravada]] = repositorios.mensagem.save.mock.calls;

    expect(gravada.payload).toEqual({ destino: 'ana@example.com', consultaId: 'consulta-1' });
    expect(JSON.stringify(gravada.payload)).not.toContain('Ana Souza');
    expect(JSON.stringify(gravada.payload)).not.toContain('compareceu');
    expect(Buffer.isBuffer(gravada.conteudoCriptografado)).toBe(true);
  });

  it('grava categoria administrativo por padrao quando o chamador nao informa', async () => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
    });

    await servico.dispararMensagem(
      'tenant-1',
      { pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', payload: {} },
      usuarioColaborador
    );

    const [[gravada]] = repositorios.mensagem.save.mock.calls;
    expect(gravada.categoria).toBe('administrativo');
  });

  it('grava categoria clinico quando o chamador informa explicitamente (Fase 261)', async () => {
    const { servico, repositorios } = criarServico({
      canal: { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email', ativo: true },
      template: { id: 'template-1', tenantId: 'tenant-1', canal: 'email', aprovado: true },
      paciente: { id: 'paciente-1', tenantId: 'tenant-1' }
    });

    await servico.dispararMensagem(
      'tenant-1',
      { pacienteId: 'paciente-1', canalId: 'canal-1', templateId: 'template-1', payload: {}, categoria: 'clinico' },
      usuarioColaborador
    );

    const [[gravada]] = repositorios.mensagem.save.mock.calls;
    expect(gravada.categoria).toBe('clinico');
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
