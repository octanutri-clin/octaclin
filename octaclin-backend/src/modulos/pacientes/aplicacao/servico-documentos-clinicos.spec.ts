import { BadRequestException, ConflictException } from '@nestjs/common';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { DocumentoEmitidoOrm } from '../infraestrutura/documento-emitido.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoDocumentosClinicos } from './servico-documentos-clinicos';

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash',
  permissoes: []
};

const criptografia = {
  criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8')),
  descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
};

const portalCliente = {
  obterConfiguracoes: jest.fn(async () => ({
    timezone: 'America/Sao_Paulo',
    marca: { nomeExibido: 'Clinica Vida' }
  })),
  obterPerfilEmpresa: jest.fn(async () => ({
    documento: '12.345.678/0001-90',
    nomeLegal: 'Clinica Vida LTDA',
    nomeFantasia: 'Clinica Vida',
    endereco: { logradouro: 'Rua A', numero: '10', cidade: 'Recife', uf: 'PE' }
  })),
  obterModelosDocumento: jest.fn(async () => ({ tenantId: 'tenant-1', modelos: [] }))
};

function consultaConcluida(sobrescrever: Partial<AgendaConsultaOrm> = {}) {
  return {
    id: 'consulta-1',
    tenantId: 'tenant-1',
    pacienteId: 'paciente-1',
    profissionalId: 'profissional-1',
    status: 'concluida',
    modalidade: 'presencial',
    timezone: 'America/Sao_Paulo',
    inicioEm: new Date('2026-08-04T13:00:00.000Z'),
    fimEm: new Date('2026-08-04T14:00:00.000Z'),
    ...sobrescrever
  } as AgendaConsultaOrm;
}

const profissionalCarla = {
  id: 'profissional-1',
  tenantId: 'tenant-1',
  nomeCriptografado: Buffer.from('Dra. Carla Lima', 'utf8'),
  registroProfissional: 'CRN-6 1234',
  especialidade: 'Nutricao clinica'
};

function montarServico(opcoes: {
  consulta?: unknown;
  documentos?: Record<string, unknown>;
  tarefas?: unknown[];
  consultasConcluidas?: unknown[];
  paciente?: Partial<PacienteOrm>;
  comunicacoes?: Record<string, unknown>;
  profissionalCreditado?: unknown;
  profissionalDoUsuario?: unknown;
}) {
  let filtroConsultas: Record<string, unknown> = {};
  let filtroTarefas: Record<string, unknown> = {};
  const repositorioDocumentos = opcoes.documentos ?? {
    create: jest.fn((dados: Record<string, unknown>) => dados),
    save: jest.fn(async (dados: Record<string, unknown>) => ({
      id: 'documento-1',
      criadoEm: new Date(),
      ...dados
    })),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    update: jest.fn(async () => undefined)
  };

  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) {
        return {
          findOne: jest.fn(async () => ({
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('Ana Souza', 'utf8'),
            ...opcoes.paciente
          }))
        };
      }
      if (entidade === ProfissionalOrm) {
        return {
          // Distingue "profissional creditado" (busca por id) de "profissional do
          // usuario logado" (busca por usuarioId): a regra de autoria depende disso.
          findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
            if (where.usuarioId) return opcoes.profissionalDoUsuario ?? null;
            return opcoes.profissionalCreditado === null
              ? null
              : (opcoes.profissionalCreditado ?? {
                  id: 'profissional-1',
                  tenantId: 'tenant-1',
                  nomeCriptografado: Buffer.from('Dra. Carla Lima', 'utf8'),
                  registroProfissional: 'CRN-6 1234',
                  especialidade: 'Nutricao clinica'
                });
          })
        };
      }
      if (entidade === AgendaConsultaOrm) {
        return {
          findOne: jest.fn(async () => opcoes.consulta ?? null),
          find: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
            filtroConsultas = consulta.where;
            return opcoes.consultasConcluidas ?? [];
          })
        };
      }
      if (entidade === AcompanhamentoTarefaOrm) {
        return {
          find: jest.fn(async (consulta: { where: Record<string, unknown> }) => {
            filtroTarefas = consulta.where;
            return opcoes.tarefas ?? [];
          })
        };
      }
      if (entidade === DocumentoEmitidoOrm) return repositorioDocumentos;
      return { find: jest.fn(async () => []), findOne: jest.fn(async () => null) };
    })
  };

  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  const servico = new ServicoDocumentosClinicos(
    executorTenant as never,
    criptografia as never,
    portalCliente as never,
    (opcoes.comunicacoes ?? {}) as never
  );

  return {
    servico,
    repositorioDocumentos,
    filtroConsultas: () => filtroConsultas,
    filtroTarefas: () => filtroTarefas
  };
}

describe('ServicoDocumentosClinicos - emissao', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emite declaracao a partir de consulta concluida com os dados da clinica', async () => {
    const { servico } = montarServico({ consulta: consultaConcluida() });

    const documento = await servico.emitir('tenant-1', 'paciente-1', usuario, {
      tipo: 'declaracao_comparecimento',
      consultaId: 'consulta-1'
    });

    expect(documento.corpo).toContain('Ana Souza');
    expect(documento.corpo).toContain('04/08/2026');
    expect(documento.corpo).toContain('Dra. Carla Lima');
    expect(documento.corpo).toContain('CRN-6 1234');
    expect(documento.cabecalho?.clinicaNome).toBe('Clinica Vida');
    expect(documento.variaveisVazias).toEqual([]);
  });

  it('recusa declaracao de consulta nao concluida', async () => {
    const { servico } = montarServico({ consulta: consultaConcluida({ status: 'agendada' }) });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'declaracao_comparecimento',
        consultaId: 'consulta-1'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa declaracao de consulta faltada', async () => {
    const { servico } = montarServico({ consulta: consultaConcluida({ status: 'falta' }) });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'declaracao_comparecimento',
        consultaId: 'consulta-1'
      })
    ).rejects.toThrow(/consulta concluida/);
  });

  it('recusa declaracao sem consulta informada', async () => {
    const { servico } = montarServico({});

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'declaracao_comparecimento' })
    ).rejects.toThrow(/consulta de origem/);
  });

  it('traduz colisao do indice unico em conflito legivel', async () => {
    const { servico } = montarServico({
      consulta: consultaConcluida(),
      documentos: {
        create: jest.fn((dados: Record<string, unknown>) => dados),
        save: jest.fn(async () => {
          throw Object.assign(new Error('duplicate key'), { code: '23505' });
        })
      }
    });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'declaracao_comparecimento',
        consultaId: 'consulta-1'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('emite relatorio de alta com periodo e metas do acompanhamento', async () => {
    const { servico } = montarServico({
      profissionalDoUsuario: profissionalCarla,
      consultasConcluidas: [
        consultaConcluida({ id: 'c1', inicioEm: new Date('2026-03-02T13:00:00.000Z') }),
        consultaConcluida({ id: 'c2', inicioEm: new Date('2026-07-20T13:00:00.000Z') })
      ],
      tarefas: [
        { status: 'concluida' },
        { status: 'concluida' },
        { status: 'pendente' },
        { status: 'cancelada' }
      ]
    });

    const documento = await servico.emitir('tenant-1', 'paciente-1', usuario, {
      tipo: 'relatorio_alta',
      conteudo: 'Paciente atingiu a meta de composicao corporal.'
    });

    expect(documento.corpo).toContain('02/03/2026 a 20/07/2026');
    expect(documento.corpo).toContain('Consultas realizadas: 2');
    // Tarefa cancelada nao conta como meta: 2 de 3, nao 2 de 4.
    expect(documento.corpo).toContain('2 de 3');
    expect(documento.corpo).toContain('Paciente atingiu a meta de composicao corporal.');
  });

  it('grava o corpo criptografado e o titulo em claro', async () => {
    const { servico, repositorioDocumentos } = montarServico({ consulta: consultaConcluida() });

    await servico.emitir('tenant-1', 'paciente-1', usuario, {
      tipo: 'declaracao_comparecimento',
      consultaId: 'consulta-1'
    });

    const [gravado] = (repositorioDocumentos.create as jest.Mock).mock.calls[0];
    expect(Buffer.isBuffer(gravado.corpoCriptografado)).toBe(true);
    expect(gravado.titulo).toBe('Declaracao de comparecimento');
    expect(criptografia.criptografar).toHaveBeenCalledWith(expect.stringContaining('Ana Souza'));
  });
});

describe('ServicoDocumentosClinicos - envio por email', () => {
  beforeEach(() => jest.clearAllMocks());

  function documentoPersistido(sobrescrever: Partial<DocumentoEmitidoOrm> = {}) {
    return {
      id: 'documento-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'declaracao_comparecimento',
      titulo: 'Declaracao de comparecimento',
      corpoCriptografado: Buffer.from('Declaro que Ana Souza compareceu.', 'utf8'),
      cabecalhoCriptografado: Buffer.from('{}', 'utf8'),
      emitidoEm: new Date('2026-08-05T12:00:00.000Z'),
      ...sobrescrever
    } as DocumentoEmitidoOrm;
  }

  it('recusa enviar relatorio de alta por email', async () => {
    const { servico } = montarServico({
      paciente: { contatoCriptografado: Buffer.from('ana@example.com', 'utf8') },
      documentos: {
        findOne: jest.fn(async () => documentoPersistido({ tipo: 'relatorio_alta', consultaId: undefined }))
      }
    });

    await expect(
      servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario)
    ).rejects.toThrow(/nao e enviado por e-mail/);
  });

  it('recusa enviar documento cancelado', async () => {
    const { servico } = montarServico({
      paciente: { contatoCriptografado: Buffer.from('ana@example.com', 'utf8') },
      documentos: { findOne: jest.fn(async () => documentoPersistido({ canceladoEm: new Date() })) }
    });

    await expect(
      servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignora envio quando o paciente nao tem email', async () => {
    const { servico } = montarServico({
      documentos: { findOne: jest.fn(async () => documentoPersistido()) }
    });

    const resultado = await servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario);
    expect(resultado).toEqual({ status: 'ignorado', motivo: 'contato_ausente' });
  });

  it('respeita a preferencia do paciente de nao receber email', async () => {
    const { servico } = montarServico({
      paciente: {
        contatoCriptografado: Buffer.from(
          JSON.stringify({ email: 'ana@example.com', preferencias: { email: false } }),
          'utf8'
        )
      },
      documentos: { findOne: jest.fn(async () => documentoPersistido()) }
    });

    const resultado = await servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario);
    expect(resultado.motivo).toBe('contato_ausente');
  });

  it('dispara a mensagem e carimba a data de envio', async () => {
    const comunicacoes = {
      listarCanais: jest.fn(async () => [{ id: 'canal-1', tipo: 'email', ativo: true }]),
      listarTemplates: jest.fn(async () => [{ id: 'template-1', canal: 'email' }]),
      dispararMensagem: jest.fn(async () => ({ id: 'mensagem-1' })),
      publicarEventoNotificacao: jest.fn(async () => undefined)
    };
    const documentos = {
      findOne: jest.fn(async () => documentoPersistido()),
      update: jest.fn(async () => undefined)
    };
    const { servico } = montarServico({
      paciente: { contatoCriptografado: Buffer.from('ana@example.com', 'utf8') },
      documentos,
      comunicacoes
    });

    const resultado = await servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario);

    expect(resultado).toEqual({ status: 'pendente', mensagemId: 'mensagem-1' });
    expect(comunicacoes.dispararMensagem).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        canalId: 'canal-1',
        templateId: 'template-1',
        payload: expect.objectContaining({ destino: 'ana@example.com' })
      }),
      usuario
    );
    expect(documentos.update).toHaveBeenCalledWith(
      { id: 'documento-1', tenantId: 'tenant-1' },
      { enviadoEm: expect.any(Date) }
    );
  });

  it('ignora envio quando o tenant nao tem canal de email ativo', async () => {
    const comunicacoes = {
      listarCanais: jest.fn(async () => [{ id: 'canal-1', tipo: 'email', ativo: false }]),
      listarTemplates: jest.fn(async () => [{ id: 'template-1', canal: 'email' }])
    };
    const { servico } = montarServico({
      paciente: { contatoCriptografado: Buffer.from('ana@example.com', 'utf8') },
      documentos: { findOne: jest.fn(async () => documentoPersistido()) },
      comunicacoes
    });

    const resultado = await servico.enviarPorEmail('tenant-1', 'paciente-1', 'documento-1', usuario);
    expect(resultado).toEqual({ status: 'ignorado', motivo: 'canal_ausente' });
  });
});

describe('ServicoDocumentosClinicos - cancelamento', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancela sem apagar e recusa cancelar duas vezes', async () => {
    const documento = {
      id: 'documento-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'declaracao_comparecimento' as const,
      titulo: 'Declaracao de comparecimento',
      corpoCriptografado: Buffer.from('corpo', 'utf8'),
      cabecalhoCriptografado: Buffer.from('{}', 'utf8'),
      emitidoEm: new Date('2026-08-05T12:00:00.000Z')
    } as DocumentoEmitidoOrm;
    const { servico } = montarServico({
      documentos: {
        findOne: jest.fn(async () => documento),
        save: jest.fn(async (dados: DocumentoEmitidoOrm) => dados)
      }
    });

    const cancelado = await servico.cancelar('tenant-1', 'paciente-1', 'documento-1', usuario, {
      motivo: 'Horario errado'
    });
    expect(cancelado.canceladoEm).toBeDefined();
    expect(cancelado.motivoCancelamento).toBe('Horario errado');

    await expect(
      servico.cancelar('tenant-1', 'paciente-1', 'documento-1', usuario, {})
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ServicoDocumentosClinicos - registro ilegivel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marca o documento como ilegivel sem derrubar a lista', async () => {
    criptografia.descriptografar.mockImplementationOnce(() => {
      throw new Error('chave rotacionada');
    });
    const { servico } = montarServico({
      documentos: {
        find: jest.fn(async () => [
          {
            id: 'documento-1',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-1',
            tipo: 'declaracao_comparecimento',
            titulo: 'Declaracao de comparecimento',
            corpoCriptografado: Buffer.from('ruido', 'utf8'),
            cabecalhoCriptografado: Buffer.from('{}', 'utf8'),
            emitidoEm: new Date('2026-08-05T12:00:00.000Z')
          }
        ])
      }
    });

    const [documento] = await servico.listar('tenant-1', 'paciente-1', usuario);
    expect(documento.corpo).toContain('ilegivel');
    expect(documento.titulo).toBe('Declaracao de comparecimento');
  });
});

describe('ServicoDocumentosClinicos - identificacao obrigatoria', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recusa emitir sem profissional identificado', async () => {
    const { servico } = montarServico({
      consulta: consultaConcluida(),
      profissionalCreditado: null
    });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'declaracao_comparecimento',
        consultaId: 'consulta-1'
      })
    ).rejects.toThrow(/Profissional responsavel nao identificado/);
  });

  /*
   * O aviso da interface tem a classe `nao-imprimir`: nao sai na folha. Se o
   * registro do conselho pudesse ficar vazio, o terceiro receberia a linha de
   * assinatura em branco sem nenhum sinal. Por isso e bloqueio.
   */
  it('recusa emitir quando o profissional nao tem registro no conselho', async () => {
    const { servico } = montarServico({
      consulta: consultaConcluida(),
      profissionalCreditado: { ...profissionalCarla, registroProfissional: undefined }
    });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'declaracao_comparecimento',
        consultaId: 'consulta-1'
      })
    ).rejects.toThrow(/registro no conselho/);
  });

  it('nao devolve o id de usuario emissor no cabecalho', async () => {
    const { servico } = montarServico({ consulta: consultaConcluida() });

    const documento = await servico.emitir('tenant-1', 'paciente-1', usuario, {
      tipo: 'declaracao_comparecimento',
      consultaId: 'consulta-1'
    });

    expect(documento.cabecalho).not.toHaveProperty('emitidoPor');
    expect(JSON.stringify(documento)).not.toContain('usuario-1');
  });
});

describe('ServicoDocumentosClinicos - autoria e escopo do relatorio de alta', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recusa relatorio de alta emitido por quem nao e o profissional creditado', async () => {
    const { servico } = montarServico({
      profissionalDoUsuario: { ...profissionalCarla, id: 'profissional-2' }
    });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, {
        tipo: 'relatorio_alta',
        conteudo: 'Alta escrita por outra pessoa.'
      })
    ).rejects.toThrow(/proprio profissional responsavel/);
  });

  it('recusa relatorio de alta emitido por usuario sem profissional vinculado', async () => {
    const { servico } = montarServico({ profissionalDoUsuario: null });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'relatorio_alta' })
    ).rejects.toThrow(/proprio profissional responsavel/);
  });

  /*
   * Numeros de toda a clinica no relatorio contariam a quem recebe o papel que o
   * paciente tambem e atendido por outra especialidade na mesma casa.
   */
  it('conta consultas e metas apenas do profissional creditado', async () => {
    const { servico, filtroConsultas, filtroTarefas } = montarServico({
      profissionalDoUsuario: profissionalCarla,
      consultasConcluidas: [consultaConcluida()],
      tarefas: [{ status: 'concluida' }]
    });

    await servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'relatorio_alta' });

    expect(filtroConsultas()).toEqual({
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      status: 'concluida'
    });
    expect(filtroTarefas()).toEqual({
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1'
    });
  });
});

describe('ServicoDocumentosClinicos - recibo da consulta', () => {
  beforeEach(() => jest.clearAllMocks());

  const consultaPaga = (sobrescrever: Partial<AgendaConsultaOrm> = {}) =>
    consultaConcluida({
      statusPagamento: 'pago',
      valorCentavos: 18000,
      formaPagamento: 'pix',
      pagoEm: new Date('2026-08-04T14:10:00.000Z'),
      ...sobrescrever
    });

  it('emite recibo com valor, forma de pagamento e dados fiscais da clinica', async () => {
    const { servico } = montarServico({ consulta: consultaPaga() });

    const documento = await servico.emitir('tenant-1', 'paciente-1', usuario, {
      tipo: 'recibo_consulta',
      consultaId: 'consulta-1'
    });

    expect(documento.corpo).toContain('Ana Souza');
    expect(documento.corpo).toContain('180,00');
    expect(documento.corpo).toContain('Pix');
    expect(documento.corpo).toContain('04/08/2026');
    // Dados fiscais reais do tenant: criterio de aceite da fase.
    expect(documento.corpo).toContain('12.345.678/0001-90');
    expect(documento.variaveisVazias).toEqual([]);
  });

  it('recusa recibo de consulta sem pagamento registrado', async () => {
    const { servico } = montarServico({ consulta: consultaPaga({ statusPagamento: 'pendente' }) });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'recibo_consulta', consultaId: 'consulta-1' })
    ).rejects.toThrow(/pagamento registrado/);
  });

  it('recusa recibo de consulta paga por pacote, que nao tem valor proprio', async () => {
    const { servico } = montarServico({
      consulta: consultaPaga({ pacoteId: 'pacote-1', valorCentavos: 0, formaPagamento: 'pacote' })
    });

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'recibo_consulta', consultaId: 'consulta-1' })
    ).rejects.toThrow(/pacote/);
  });

  it('recusa recibo sem consulta de origem', async () => {
    const { servico } = montarServico({});

    await expect(
      servico.emitir('tenant-1', 'paciente-1', usuario, { tipo: 'recibo_consulta' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
