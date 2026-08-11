import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { WebhookAssinaturaOrm } from '../../integracoes/infraestrutura/webhook-assinatura.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { EvolucaoClinicaOrm } from '../infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { LIMITE_LINHAS_EXPORTACAO, ServicoPacientes } from './servico-pacientes';

function criarGerenciadorFake(repositorio: Record<string, unknown>) {
  if ('paciente' in repositorio || 'profissional' in repositorio) {
    return {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === WebhookAssinaturaOrm) return { find: jest.fn(async () => []) };
        if (entidade === PacienteOrm) return repositorio.paciente;
        if (entidade === ProfissionalOrm) return repositorio.profissional;
        if (entidade === AgendaConsultaOrm) return repositorio.agenda ?? { find: jest.fn(async () => []) };
        return repositorio.paciente;
      })
    };
  }

  return {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === WebhookAssinaturaOrm) return { find: jest.fn(async () => []) };
      return entidade === AgendaConsultaOrm ? repositorio.agenda ?? { find: jest.fn(async () => []) } : repositorio;
    })
  };
}

const limitesPermitidos = {
  checarLimite: jest.fn(async () => ({ permitido: true }))
};

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

describe('ServicoPacientes', () => {
  it('reutiliza o paciente vencedor quando duas criacoes usam a mesma referencia externa', async () => {
    const existente = {
      id: 'paciente-existente',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('criptografado:Maria'),
      buscaHashes: [],
      referenciaExterna: 'crm-42',
      statusAdesao: 'novo',
      scoreRisco: '0',
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    const erroPostgres = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'ux_pacientes_referencia_externa'
    });
    const repositorioPacientes = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existente),
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async () => {
        throw new QueryFailedError('insert into pacientes', [], erroPostgres);
      })
    };
    const gerenciador = criarGerenciadorFake({
      paciente: repositorioPacientes,
      profissional: { findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1' })) }
    });
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
    };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', '')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
    };
    const servico = new ServicoPacientes(executorTenant as never, criptografia as never, limitesPermitidos as never);

    const resposta = await servico.criar(
      'tenant-1',
      { profissionalResponsavelId: 'profissional-1', nome: 'Maria', referenciaExterna: '  crm-42  ' },
      usuarioColaborador
    );

    expect(resposta.id).toBe('paciente-existente');
    expect(repositorioPacientes.findOne).toHaveBeenNthCalledWith(1, { where: { tenantId: 'tenant-1', referenciaExterna: 'crm-42' } });
    expect(repositorioPacientes.findOne).toHaveBeenLastCalledWith({ where: { tenantId: 'tenant-1', referenciaExterna: 'crm-42' } });
  });

  it('deve criar paciente dentro do contexto do tenant e criptografar dados sensiveis', async () => {
    const repositorioPacientes = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1' }))
    };
    const gerenciador = criarGerenciadorFake({
      paciente: repositorioPacientes,
      profissional: repositorioProfissionais
    });
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const criptografia = {
      criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', '')),
      gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
    };
    const servico = new ServicoPacientes(executorTenant as never, criptografia as never, limitesPermitidos as never);

    const paciente = await servico.criar(
      'tenant-1',
      {
        profissionalResponsavelId: 'profissional-1',
        nome: 'Maria',
        contato: 'maria@example.com'
      },
      usuarioColaborador
    );

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(criptografia.criptografar).toHaveBeenCalledWith('Maria');
    expect(paciente).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve limitar a paginacao em no maximo 100 itens', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [[], 0])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await servico.listar('tenant-1', usuarioColaborador, 1, 500);

    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  describe('exportarCsv', () => {
    function montarServicoExportacao(paginas: Array<Array<Record<string, unknown>>>) {
      let chamada = 0;
      const repositorio = {
        findAndCount: jest.fn(async () => {
          const pagina = paginas[chamada] ?? [];
          chamada += 1;
          return [pagina, paginas.flat().length];
        })
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake(repositorio))
          )
        } as never,
        {
          descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', '')),
          gerarHashesConsultaPii: jest.fn(() => ['hash'])
        } as never,
        limitesPermitidos as never
      );
      return { servico, repositorio };
    }

    const pacienteOrm = (id: string, nome: string) => ({
      id,
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from(`criptografado:${nome}`),
      dataNascimento: '1990-05-04',
      statusAdesao: 'novo',
      scoreRisco: '0',
      criadoEm: new Date('2026-01-02T10:00:00.000Z')
    });

    it('exporta CSV com cabecalho e uma linha por paciente', async () => {
      const { servico } = montarServicoExportacao([[pacienteOrm('paciente-1', 'Maria Souza')]]);

      const csv = await servico.exportarCsv('tenant-1', usuarioColaborador);

      const [cabecalho, primeira] = csv.trim().split('\n');
      expect(cabecalho).toContain('nome');
      expect(primeira).toContain('Maria Souza');
    });

    it('neutraliza nome com formula, que chega do proprio cadastro', async () => {
      const { servico } = montarServicoExportacao([[pacienteOrm('paciente-1', '=HYPERLINK("http://x")')]]);

      const csv = await servico.exportarCsv('tenant-1', usuarioColaborador);

      expect(csv).toContain(`"'=HYPERLINK`);
    });

    it('mantem o escopo da listagem: exporta paginando a mesma consulta filtrada', async () => {
      const { servico, repositorio } = montarServicoExportacao([
        [pacienteOrm('paciente-1', 'Maria')],
        []
      ]);

      await servico.exportarCsv('tenant-1', usuarioColaborador, {
        pagina: 1,
        limite: 100,
        status: 'aderente'
      } as never);

      expect(repositorio.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ statusAdesao: 'aderente' }) })
      );
    });

    it('para de paginar no teto de exportacao em vez de varrer a base inteira', async () => {
      const paginaCheia = Array.from({ length: 100 }, (_item, indice) =>
        pacienteOrm(`paciente-${indice}`, `Paciente ${indice}`)
      );
      const { servico, repositorio } = montarServicoExportacao(Array.from({ length: 100 }, () => paginaCheia));

      const csv = await servico.exportarCsv('tenant-1', usuarioColaborador);

      expect(csv.trim().split('\n')).toHaveLength(LIMITE_LINHAS_EXPORTACAO + 1);
      expect(repositorio.findAndCount.mock.calls.length).toBeLessThanOrEqual(LIMITE_LINHAS_EXPORTACAO / 100);
    });
  });

  it('deve aplicar busca e filtros no banco antes da paginacao', async () => {
    const repositorio = { findAndCount: jest.fn(async () => [[], 0]) };
    const criptografia = {
      gerarHashesConsultaPii: jest.fn(() => ['hash-ana']),
      descriptografar: jest.fn()
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      criptografia as never,
      limitesPermitidos as never
    );

    await servico.listar('tenant-1', usuarioColaborador, 2, 25, {
      pagina: 2,
      limite: 25,
      busca: 'Ana',
      profissionalId: '11111111-1111-4111-8111-111111111111',
      status: 'aderente',
      semProximaConsulta: true
    });

    expect(criptografia.gerarHashesConsultaPii).toHaveBeenCalledWith('tenant-1', 'Ana');
    expect(repositorio.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 25,
      take: 25,
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        profissionalResponsavelId: '11111111-1111-4111-8111-111111111111',
        statusAdesao: 'aderente',
        buscaHashes: expect.objectContaining({ _type: 'arrayContains', _value: ['hash-ana'] }),
        id: expect.objectContaining({ _type: 'raw' })
      })
    }));
  });

  it('deve incluir a ultima consulta concluida e a proxima consulta do proprio tenant', async () => {
    const agora = Date.now();
    const repositorioPacientes = {
      findAndCount: jest.fn(async () => [[
        {
          id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1',
          nomeCriptografado: Buffer.from('cripto:Maria'), statusAdesao: 'em_acompanhamento', scoreRisco: '20',
          criadoEm: new Date(agora - 10_000), atualizadoEm: new Date(agora - 10_000)
        }
      ], 1])
    };
    const repositorioAgenda = {
      find: jest.fn(async () => [
        { pacienteId: 'paciente-1', status: 'concluida', inicioEm: new Date(agora - 86_400_000) },
        { pacienteId: 'paciente-1', status: 'agendada', inicioEm: new Date(agora + 172_800_000) },
        { pacienteId: 'paciente-1', status: 'agendada', inicioEm: new Date(agora + 86_400_000) }
      ])
    };
    const servico = new ServicoPacientes(
      { executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(criarGerenciadorFake({ paciente: repositorioPacientes, agenda: repositorioAgenda }))) } as never,
      { descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', '')) } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1', usuarioColaborador);

    expect(repositorioAgenda.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1', pacienteId: expect.any(Object) } }));
    expect(resposta.itens[0]).toEqual(expect.objectContaining({
      ultimaConsultaConcluidaEm: new Date(agora - 86_400_000),
      proximaConsultaEm: new Date(agora + 86_400_000)
    }));
  });

  it('deve bloquear criacao de paciente quando limite do plano for atingido', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const executorTenant = {
      executar: jest.fn((tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(criarGerenciadorFake(repositorio))
      )
    };
    const limites = {
      checarLimite: jest.fn(async () => ({
        permitido: false,
        recurso: 'pacientes',
        plano: 'Plano gratuito',
        uso: 25,
        limite: 25,
        restante: 0,
        mensagem: 'Limite de pacientes atingido para o Plano gratuito.'
      }))
    };
    const servico = new ServicoPacientes(
      executorTenant as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limites as never
    );

    await expect(
      servico.criar(
        'tenant-1',
        {
          profissionalResponsavelId: 'profissional-1',
          nome: 'Maria',
          contato: 'maria@example.com'
        },
        usuarioColaborador
      )
    ).rejects.toThrow('Limite de pacientes atingido para o Plano gratuito.');

    expect(limites.checarLimite).toHaveBeenCalledWith('tenant-1', 'pacientes');
    expect(repositorio.save).not.toHaveBeenCalled();
  });

  it('deve impedir criar paciente com profissional responsavel de outro tenant', async () => {
    const repositorioPacientes = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => null)
    };
    const gerenciador = criarGerenciadorFake({
      paciente: repositorioPacientes,
      profissional: repositorioProfissionais
    });
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(gerenciador)
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await expect(
      servico.criar(
        'tenant-1',
        {
          profissionalResponsavelId: 'profissional-tenant-2',
          nome: 'Maria',
          contato: 'maria@example.com'
        },
        usuarioColaborador
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
      where: { id: 'profissional-tenant-2', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }
    });
    expect(repositorioPacientes.save).not.toHaveBeenCalled();
  });

  it('deve impedir atualizar paciente para profissional responsavel de outro tenant', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      contatoCriptografado: Buffer.from('cripto:maria@example.com'),
      statusAdesao: 'novo',
      scoreRisco: '0'
    };
    const repositorioPacientes = {
      findOne: jest.fn(async () => paciente),
      save: jest.fn(async (dados: Record<string, unknown>) => dados)
    };
    const repositorioProfissionais = {
      findOne: jest.fn(async () => null)
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(
            criarGerenciadorFake({
              paciente: repositorioPacientes,
              profissional: repositorioProfissionais
            })
          )
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    await expect(
      servico.atualizar(
        'tenant-1',
        'paciente-1',
        {
          profissionalResponsavelId: 'profissional-tenant-2'
        },
        usuarioColaborador
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
      where: { id: 'profissional-tenant-2', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }
    });
    expect(repositorioPacientes.save).not.toHaveBeenCalled();
  });

  it('deve retornar pacientes com campos sensiveis descriptografados na listagem', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from('cripto:maria@example.com'),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1', usuarioColaborador);

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve exibir contato principal quando paciente possui contato estruturado pelo portal', async () => {
    const repositorio = {
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            profissionalResponsavelId: 'profissional-1',
            nomeCriptografado: Buffer.from('cripto:Maria'),
            contatoCriptografado: Buffer.from(
              'cripto:{"email":"maria@example.com","whatsapp":"5511999999999","preferencias":{"email":true,"whatsapp":false}}'
            ),
            statusAdesao: 'novo',
            scoreRisco: '0',
            criadoEm: new Date('2026-01-01T00:00:00Z'),
            atualizadoEm: new Date('2026-01-01T00:00:00Z')
          }
        ],
        1
      ])
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const resposta = await servico.listar('tenant-1', usuarioColaborador);

    expect(resposta.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', contato: 'maria@example.com' }));
  });

  it('deve falhar ao arquivar paciente inexistente', async () => {
    const repositorio = {
      update: jest.fn(async () => ({ affected: 0 }))
    };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake(repositorio))
        )
      } as never,
      { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
      limitesPermitidos as never
    );

    await expect(servico.arquivar('tenant-1', 'paciente-inexistente', usuarioColaborador)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  describe('lixeira e restauracao', () => {
    it('lista somente arquivados e preserva o escopo do Professional', async () => {
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
      };
      const repositorioPacientes = {
        findAndCount: jest.fn(async () => [[{
          id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1',
          nomeCriptografado: Buffer.from('cripto:Maria'), statusAdesao: 'aderente', scoreRisco: '20',
          arquivadoEm: new Date('2026-08-01T10:00:00.000Z'), criadoEm: new Date('2026-01-01T10:00:00.000Z')
        }], 1])
      };
      const servico = new ServicoPacientes(
        { executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))) } as never,
        { descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', '')) } as never,
        limitesPermitidos as never
      );

      const resultado = await servico.listarArquivados('tenant-1', usuarioProfissional, 1, 25);

      expect(repositorioPacientes.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1', arquivadoEm: expect.any(Object) })
      }));
      expect(resultado.itens[0]).toEqual(expect.objectContaining({ nome: 'Maria', arquivadoEm: new Date('2026-08-01T10:00:00.000Z') }));
    });

    it('arquiva sem apagar o status clinico anterior', async () => {
      const repositorio = { update: jest.fn(async () => ({ affected: 1 })) };
      const servico = new ServicoPacientes(
        { executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(criarGerenciadorFake(repositorio))) } as never,
        {} as never,
        limitesPermitidos as never
      );

      await servico.arquivar('tenant-1', 'paciente-1', usuarioColaborador);

      expect(repositorio.update).toHaveBeenCalledWith(expect.any(Object), { arquivadoEm: expect.any(Date) });
    });

    it('restaura paciente arquivado somente se houver vaga no plano', async () => {
      const repositorio = { update: jest.fn(async () => ({ affected: 1 })) };
      const portalCliente = { checarLimite: jest.fn(async () => ({ permitido: true })) };
      const servico = new ServicoPacientes(
        { executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(criarGerenciadorFake(repositorio))) } as never,
        {} as never,
        portalCliente as never
      );

      await servico.restaurar('tenant-1', 'paciente-1', usuarioColaborador);

      expect(portalCliente.checarLimite).toHaveBeenCalledWith('tenant-1', 'pacientes');
      expect(repositorio.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }),
        { arquivadoEm: null }
      );
    });
  });

  it('deve montar prontuario longitudinal do paciente com agenda, formularios, respostas e mensagens', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      contatoCriptografado: Buffer.from('cripto:maria@example.com'),
      statusAdesao: 'risco',
      scoreRisco: '82',
      ultimoCheckinEm: new Date('2026-07-21T10:00:00.000Z'),
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-21T10:00:00.000Z')
    };
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [
        PacienteOrm,
        {
          findOne: jest.fn(async () => paciente)
        }
      ],
      [
        AgendaConsultaOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'consulta-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              titulo: 'Consulta de retorno',
              inicioEm: new Date('2026-07-22T13:00:00.000Z'),
              fimEm: new Date('2026-07-22T14:00:00.000Z'),
              status: 'agendada',
              local: 'Online'
            }
          ])
        }
      ],
      [
        EnvioQuestionarioOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'envio-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              questionarioId: 'questionario-1',
              status: 'enviado',
              enviadoEm: new Date('2026-07-20T13:00:00.000Z'),
              expiraEm: new Date('2026-07-25T13:00:00.000Z')
            }
          ])
        }
      ],
      [
        RespostaCheckinOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'resposta-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              envioQuestionarioId: 'envio-1',
              scoreFinal: '74.5',
              finalizadoEm: new Date('2026-07-21T15:00:00.000Z'),
              criadoEm: new Date('2026-07-21T14:55:00.000Z')
            }
          ])
        }
      ],
      [
        LogDiarioRapidoOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'diario-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              tipo: 'humor',
              valor: { humor: 'bem', adesaoPlano: 85, sintomas: 'Sono leve' },
              registradoEm: new Date('2026-07-21T18:00:00.000Z')
            }
          ])
        }
      ],
      [
        QuestionarioOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'questionario-1',
              tenantId: 'tenant-1',
              titulo: 'Check-in semanal',
              status: 'publicado',
              versao: 2
            }
          ])
        }
      ],
      [
        AcompanhamentoTarefaOrm,
        {
          find: jest.fn(async () => [])
        }
      ],
      [
        EvolucaoClinicaOrm,
        {
          find: jest.fn(async () => [])
        }
      ],
      [
        MensagemNotificacaoOrm,
        {
          find: jest.fn(async () => [
            {
              id: 'mensagem-1',
              tenantId: 'tenant-1',
              pacienteId: 'paciente-1',
              status: 'recebido',
              payload: { texto: 'Estou com duvida no plano.' },
              criadoEm: new Date('2026-07-22T16:00:00.000Z')
            }
          ])
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn(),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1', usuarioColaborador);

    expect(prontuario.paciente).toEqual(expect.objectContaining({ id: 'paciente-1', nome: 'Maria', contato: 'maria@example.com' }));
    expect(prontuario.resumo).toEqual({
      consultas: 1,
      formulariosPendentes: 1,
      respostas: 1,
      checkinsRapidos: 1,
      mensagens: 1,
      evolucoes: 0,
      tarefasPendentes: 0,
      ultimoEventoEm: new Date('2026-07-22T16:00:00.000Z')
    });
    expect(prontuario.linhaDoTempo.map((evento: { tipo: string }) => evento.tipo)).toEqual([
      'mensagem',
      'consulta',
      'checkin_rapido',
      'resposta_formulario',
      'formulario'
    ]);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        titulo: 'Mensagem recebida',
        descricao: 'Estou com duvida no plano.'
      })
    );
    expect(prontuario.linhaDoTempo[2]).toEqual(
      expect.objectContaining({
        tipo: 'checkin_rapido',
        titulo: 'Check-in rapido',
        descricao: 'Humor: bem - Adesao ao plano: 85% - Sintomas: Sono leve'
      })
    );
    expect(prontuario.linhaDoTempo[3]).toEqual(
      expect.objectContaining({
        titulo: 'Resposta de Check-in semanal',
        descricao: 'Score final 74.5'
      })
    );
  });

  it('deve criar evolucao clinica privada criptografada e listar no prontuario', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '40',
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-01T10:00:00.000Z')
    };
    const evolucoesSalvas: Record<string, unknown>[] = [];
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [PacienteOrm, { findOne: jest.fn(async () => paciente) }],
      [AgendaConsultaOrm, { find: jest.fn(async () => []) }],
      [EnvioQuestionarioOrm, { find: jest.fn(async () => []) }],
      [RespostaCheckinOrm, { find: jest.fn(async () => []) }],
      [LogDiarioRapidoOrm, { find: jest.fn(async () => []) }],
      [QuestionarioOrm, { find: jest.fn(async () => []) }],
      [MensagemNotificacaoOrm, { find: jest.fn(async () => []) }],
      [AcompanhamentoTarefaOrm, { find: jest.fn(async () => []) }],
      [
        EvolucaoClinicaOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = {
              id: 'evolucao-1',
              criadoEm: new Date('2026-07-22T17:00:00.000Z'),
              atualizadoEm: new Date('2026-07-22T17:00:00.000Z'),
              ...dados
            };
            evolucoesSalvas.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => evolucoesSalvas)
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const evolucao = await servico.criarEvolucaoClinica(
      'tenant-1',
      'paciente-1',
      'usuario-profissional-1',
      {
        titulo: 'Consulta inicial',
        conteudo: 'Paciente relatou melhora de adesao.',
        tipo: 'consulta',
        visibilidade: 'privada'
      },
      usuarioColaborador
    );
    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1', usuarioColaborador);

    expect(evolucao).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        autorUsuarioId: 'usuario-profissional-1',
        titulo: 'Consulta inicial',
        conteudo: 'Paciente relatou melhora de adesao.',
        tipo: 'consulta',
        visibilidade: 'privada'
      })
    );
    expect(evolucoesSalvas[0]).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        conteudoCriptografado: Buffer.from('cripto:Paciente relatou melhora de adesao.')
      })
    );
    expect(prontuario.resumo.evolucoes).toBe(1);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        tipo: 'evolucao_clinica',
        titulo: 'Consulta inicial',
        descricao: 'Paciente relatou melhora de adesao.'
      })
    );
  });

  it('deve criar tarefa de acompanhamento e exibir pendencia no prontuario', async () => {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('cripto:Maria'),
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '40',
      criadoEm: new Date('2026-07-01T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-01T10:00:00.000Z')
    };
    const tarefasSalvas: Record<string, unknown>[] = [];
    const repositorios = new Map<unknown, Record<string, unknown>>([
      [PacienteOrm, { findOne: jest.fn(async () => paciente) }],
      [AgendaConsultaOrm, { find: jest.fn(async () => []) }],
      [EnvioQuestionarioOrm, { find: jest.fn(async () => []) }],
      [RespostaCheckinOrm, { find: jest.fn(async () => []) }],
      [LogDiarioRapidoOrm, { find: jest.fn(async () => []) }],
      [QuestionarioOrm, { find: jest.fn(async () => []) }],
      [MensagemNotificacaoOrm, { find: jest.fn(async () => []) }],
      [EvolucaoClinicaOrm, { find: jest.fn(async () => []) }],
      [
        AcompanhamentoTarefaOrm,
        {
          create: jest.fn((dados: Record<string, unknown>) => dados),
          save: jest.fn(async (dados: Record<string, unknown>) => {
            const salvo = {
              id: 'tarefa-1',
              criadoEm: new Date('2026-07-22T18:00:00.000Z'),
              atualizadoEm: new Date('2026-07-22T18:00:00.000Z'),
              ...dados
            };
            tarefasSalvas.push(salvo);
            return salvo;
          }),
          find: jest.fn(async () => tarefasSalvas)
        }
      ]
    ]);
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao({ getRepository: jest.fn((entidade) => repositorios.get(entidade)) })
        )
      } as never,
      {
        criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
        descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('cripto:', ''))
      } as never,
      limitesPermitidos as never
    );

    const tarefa = await servico.criarTarefaAcompanhamento(
      'tenant-1',
      'paciente-1',
      'usuario-profissional-1',
      {
        titulo: 'Beber agua no periodo da tarde',
        descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
        categoria: 'meta',
        prioridade: 'media',
        vencimentoEm: '2026-07-29T18:00:00.000Z'
      },
      usuarioColaborador
    );
    const prontuario = await servico.obterProntuario('tenant-1', 'paciente-1', usuarioColaborador);

    expect(tarefa).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        profissionalId: 'usuario-profissional-1',
        titulo: 'Beber agua no periodo da tarde',
        descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
        categoria: 'meta',
        prioridade: 'media',
        status: 'pendente'
      })
    );
    expect(tarefasSalvas[0]).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        descricaoCriptografada: Buffer.from('cripto:Meta diaria de 1 litro entre 13h e 18h.')
      })
    );
    expect(prontuario.resumo.tarefasPendentes).toBe(1);
    expect(prontuario.linhaDoTempo[0]).toEqual(
      expect.objectContaining({
        tipo: 'tarefa_acompanhamento',
        titulo: 'Beber agua no periodo da tarde',
        descricao: 'Meta diaria de 1 litro entre 13h e 18h.',
        status: 'pendente'
      })
    );
  });

  describe('escopo pacientes_responsaveis para Professional', () => {
    it('deve listar apenas pacientes do proprio profissional quando o usuario for Professional', async () => {
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
      };
      const repositorioPacientes = {
        findAndCount: jest.fn(async () => [[], 0])
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn(), gerarHashesBuscaPii: jest.fn(() => []) } as never,
        limitesPermitidos as never
      );

      await servico.listar('tenant-1', usuarioProfissional);

      expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
        where: { usuarioId: 'usuario-profissional-1', tenantId: 'tenant-1', arquivadoEm: expect.any(Object) }
      });
      expect(repositorioPacientes.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ profissionalResponsavelId: 'profissional-1' }) })
      );
    });

    it('nao deve filtrar pacientes por profissional quando o usuario for Collaborator ou SuperAdmin', async () => {
      const repositorioPacientes = {
        findAndCount: jest.fn(async (_opcoes: { where: Record<string, unknown> }) => [[], 0])
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake(repositorioPacientes))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn(), gerarHashesBuscaPii: jest.fn(() => []) } as never,
        limitesPermitidos as never
      );

      await servico.listar('tenant-1', usuarioColaborador);

      const chamada = repositorioPacientes.findAndCount.mock.calls[0][0];
      expect(chamada.where).not.toHaveProperty('profissionalResponsavelId');
    });

    it('deve forcar profissionalResponsavelId para o proprio profissional ao criar paciente como Professional', async () => {
      const repositorioPacientes = {
        create: jest.fn((dados: Record<string, unknown>) => dados),
        save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'paciente-1', ...dados }))
      };
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn(), gerarHashesBuscaPii: jest.fn(() => []) } as never,
        limitesPermitidos as never
      );

      const paciente = await servico.criar(
        'tenant-1',
        {
          profissionalResponsavelId: 'profissional-outro-2',
          nome: 'Maria',
          contato: 'maria@example.com'
        },
        usuarioProfissional
      );

      expect(paciente.profissionalResponsavelId).toBe('profissional-1');
    });

    it('deve tratar paciente de outro profissional como nao encontrado para um Professional', async () => {
      const paciente = {
        id: 'paciente-2',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-outro-2',
        nomeCriptografado: Buffer.from('cripto:Joao'),
        statusAdesao: 'novo',
        scoreRisco: '0'
      };
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
      };
      const repositorioPacientes = {
        findOne: jest.fn(async (opcoes: { where: Record<string, unknown> }) =>
          opcoes.where.profissionalResponsavelId && opcoes.where.profissionalResponsavelId !== paciente.profissionalResponsavelId
            ? null
            : paciente
        )
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
        limitesPermitidos as never
      );

      await expect(servico.obterPorId('tenant-1', 'paciente-2', usuarioProfissional)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('deve impedir Professional de reatribuir paciente para outro profissional', async () => {
      const paciente = {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Maria'),
        statusAdesao: 'novo',
        scoreRisco: '0'
      };
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }))
      };
      const repositorioPacientes = {
        findOne: jest.fn(async () => paciente),
        save: jest.fn(async (dados: Record<string, unknown>) => dados)
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
        limitesPermitidos as never
      );

      await expect(
        servico.atualizar('tenant-1', 'paciente-1', { profissionalResponsavelId: 'profissional-outro-2' }, usuarioProfissional)
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorioPacientes.save).not.toHaveBeenCalled();
    });

    it('deve travar a linha do paciente durante reatribuicao administrativa', async () => {
      const paciente = {
        id: 'paciente-1',
        tenantId: 'tenant-1',
        profissionalResponsavelId: 'profissional-1',
        nomeCriptografado: Buffer.from('cripto:Maria'),
        statusAdesao: 'novo',
        scoreRisco: '0'
      };
      const repositorioPacientes = {
        findOne: jest.fn(async () => paciente),
        save: jest.fn(async (dados: Record<string, unknown>) => dados)
      };
      const repositorioProfissionais = {
        findOne: jest.fn(async () => ({ id: 'profissional-2', tenantId: 'tenant-1' }))
      };
      const servico = new ServicoPacientes(
        {
          executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
            operacao(criarGerenciadorFake({ paciente: repositorioPacientes, profissional: repositorioProfissionais }))
          )
        } as never,
        { criptografar: jest.fn(), descriptografar: jest.fn() } as never,
        limitesPermitidos as never
      );

      await servico.atualizar(
        'tenant-1',
        'paciente-1',
        { profissionalResponsavelId: 'profissional-2' },
        usuarioColaborador
      );

      expect(repositorioPacientes.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
      );
      expect(paciente.profissionalResponsavelId).toBe('profissional-2');
    });
  });
});

describe('ServicoPacientes - avaliacao antropometrica', () => {
  const criptografiaFake = () => ({
    criptografar: jest.fn((valor: string) => Buffer.from(`criptografado:${valor}`)),
    descriptografar: jest.fn((valor: Buffer) => valor.toString().replace('criptografado:', '')),
    gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
  });

  function montarServico(opcoes: { avaliacoes?: Record<string, unknown>[] } = {}) {
    const paciente = {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      profissionalResponsavelId: 'profissional-1',
      dataNascimento: '1990-06-15',
      arquivadoEm: null
    };
    const repositorioAvaliacoes = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({
        id: 'avaliacao-1',
        criadoEm: new Date('2026-08-04T12:00:00.000Z'),
        ...dados
      })),
      find: jest.fn(async () => opcoes.avaliacoes ?? []),
      findOne: jest.fn(async () => (opcoes.avaliacoes ?? [])[0] ?? null)
    };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) =>
        entidade === PacienteOrm ? { findOne: jest.fn(async () => paciente) } : repositorioAvaliacoes
      )
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const criptografia = criptografiaFake();
    const servico = new ServicoPacientes(
      executorTenant as never,
      criptografia as never,
      limitesPermitidos as never
    );
    return { servico, repositorioAvaliacoes, criptografia };
  }

  it('deve calcular na gravacao e persistir medidas e resultado criptografados', async () => {
    const { servico, repositorioAvaliacoes, criptografia } = montarServico();

    const avaliacao = await servico.registrarAvaliacaoAntropometrica(
      'tenant-1',
      'paciente-1',
      'usuario-colaborador-1',
      {
        avaliadaEm: '2026-08-04',
        protocolo: 'pollock_3',
        sexo: 'masculino',
        pesoKg: 80,
        alturaCm: 180,
        dobras: { peitoral: 10, abdominal: 20, coxa: 15 }
      },
      usuarioColaborador
    );

    expect(avaliacao.resultado.imc).toBe(24.69);
    expect(avaliacao.protocolo).toBe('pollock_3');
    // Idade e snapshot do momento: 36 anos completos em 2026-08-04 para nascimento 1990-06-15.
    expect(avaliacao.idadeAnos).toBe(36);
    expect(avaliacao.formulaAplicada).toContain('Jackson & Pollock 1978');

    const gravado = repositorioAvaliacoes.save.mock.calls[0][0] as Record<string, unknown>;
    expect(Buffer.isBuffer(gravado.medidasCriptografadas)).toBe(true);
    expect(Buffer.isBuffer(gravado.resultadoCriptografado)).toBe(true);
    // A formula fica em claro: descreve o metodo, nao o paciente.
    expect(gravado.formulaAplicada).toContain('Jackson & Pollock 1978');
    expect(criptografia.criptografar).toHaveBeenCalledWith(expect.stringContaining('"pesoKg":80'));
  });

  it('nao deve recalcular no historico: le o resultado gravado, nao o dominio atual', async () => {
    const resultadoAntigo = { imc: 99.9, percentualGordura: 42, protocoloAplicado: 'faulkner', avisos: [] };
    const { servico } = montarServico({
      avaliacoes: [
        {
          id: 'avaliacao-antiga',
          pacienteId: 'paciente-1',
          avaliadaEm: '2020-01-10',
          protocolo: 'faulkner',
          idadeAnos: 30,
          medidasCriptografadas: Buffer.from('criptografado:{"pesoKg":70}'),
          resultadoCriptografado: Buffer.from(`criptografado:${JSON.stringify(resultadoAntigo)}`),
          formulaAplicada: 'Faulkner 1968',
          criadoEm: new Date('2020-01-10T12:00:00.000Z')
        }
      ]
    });

    const serie = await servico.listarAvaliacoesAntropometricas('tenant-1', 'paciente-1', usuarioColaborador);

    // IMC 99,9 seria recusado pelo dominio hoje; o registro historico volta como esta.
    expect(serie.avaliacoes[0].resultado.imc).toBe(99.9);
    expect(serie.avaliacoes[0].formulaAplicada).toBe('Faulkner 1968');
  });

  it('deve devolver delta entre as duas avaliacoes mais recentes', async () => {
    const registro = (id: string, data: string, peso: number, imc: number) => ({
      id,
      pacienteId: 'paciente-1',
      avaliadaEm: data,
      protocolo: 'nenhum',
      medidasCriptografadas: Buffer.from(`criptografado:${JSON.stringify({ pesoKg: peso })}`),
      resultadoCriptografado: Buffer.from(
        `criptografado:${JSON.stringify({ imc, protocoloAplicado: 'nenhum', avisos: [] })}`
      ),
      criadoEm: new Date(`${data}T12:00:00.000Z`)
    });
    const { servico } = montarServico({
      avaliacoes: [registro('a2', '2026-08-04', 78.1, 25.5), registro('a1', '2026-06-04', 82.4, 26.9)]
    });

    const serie = await servico.listarAvaliacoesAntropometricas('tenant-1', 'paciente-1', usuarioColaborador);

    expect(serie.deltaUltimas).toEqual([
      { campo: 'pesoKg', anterior: 82.4, atual: 78.1, variacao: -4.3 },
      { campo: 'imc', anterior: 26.9, atual: 25.5, variacao: -1.4 }
    ]);
  });

  it('nao deve devolver delta com uma unica avaliacao', async () => {
    const { servico } = montarServico({
      avaliacoes: [
        {
          id: 'a1',
          pacienteId: 'paciente-1',
          avaliadaEm: '2026-08-04',
          protocolo: 'nenhum',
          medidasCriptografadas: Buffer.from('criptografado:{"pesoKg":80}'),
          resultadoCriptografado: Buffer.from('criptografado:{"protocoloAplicado":"nenhum","avisos":[]}'),
          criadoEm: new Date()
        }
      ]
    });

    const serie = await servico.listarAvaliacoesAntropometricas('tenant-1', 'paciente-1', usuarioColaborador);
    expect(serie.deltaUltimas).toEqual([]);
  });

  it('deve sinalizar registro ilegivel em vez de devolver avaliacao vazia', async () => {
    const { servico } = montarServico({
      avaliacoes: [
        {
          id: 'a1',
          pacienteId: 'paciente-1',
          avaliadaEm: '2026-08-04',
          protocolo: 'nenhum',
          medidasCriptografadas: Buffer.from('criptografado:isso-nao-e-json'),
          resultadoCriptografado: Buffer.from('criptografado:isso-nao-e-json'),
          criadoEm: new Date()
        }
      ]
    });

    const serie = await servico.listarAvaliacoesAntropometricas('tenant-1', 'paciente-1', usuarioColaborador);
    expect(serie.avaliacoes[0].resultado.avisos).toContain('registro_ilegivel');
  });

  it('deve excluir logicamente, sem apagar do banco', async () => {
    const { servico, repositorioAvaliacoes } = montarServico({
      avaliacoes: [{ id: 'avaliacao-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', excluidaEm: null }]
    });

    await servico.excluirAvaliacaoAntropometrica('tenant-1', 'paciente-1', 'avaliacao-1', usuarioColaborador);

    const salvo = repositorioAvaliacoes.save.mock.calls[0][0] as Record<string, unknown>;
    expect(salvo.excluidaEm).toBeInstanceOf(Date);
  });

  it('deve tratar paciente de outro profissional como inexistente ao registrar avaliacao', async () => {
    const gerenciador = { getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null) })) };
    const servico = new ServicoPacientes(
      {
        executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
          operacao(gerenciador)
        )
      } as never,
      criptografiaFake() as never,
      limitesPermitidos as never
    );

    await expect(
      servico.registrarAvaliacaoAntropometrica(
        'tenant-1',
        'paciente-de-outro',
        'usuario-profissional-1',
        { pesoKg: 80 },
        usuarioProfissional
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pagina a timeline por cursor sem descriptografar conteudo clinico', async () => {
    const query = jest.fn(async (_sql: string, _params: unknown[]) => [
      {
        id: '00000000-0000-4000-8000-000000000002',
        tipo: 'evolucao_clinica',
        titulo: 'Ajuste de conduta',
        data: '2026-08-11T10:00:00.000Z',
        status: 'ajuste_plano',
        origemId: '00000000-0000-4000-8000-000000000002',
        metadados: { visibilidade: 'privada' }
      },
      {
        id: '00000000-0000-4000-8000-000000000001',
        tipo: 'mensagem',
        titulo: 'Mensagem recebida',
        data: '2026-08-10T10:00:00.000Z',
        status: 'recebido',
        origemId: '00000000-0000-4000-8000-000000000001',
        metadados: {}
      }
    ]);
    const paciente = {
      id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1',
      nomeCriptografado: Buffer.from('criptografado:Maria'), statusAdesao: 'novo', scoreRisco: '0',
      criadoEm: new Date(), atualizadoEm: new Date()
    };
    const servico = new ServicoPacientes(
      { executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao({
        query,
        getRepository: jest.fn(() => ({ findOne: jest.fn(async () => paciente) }))
      })) } as never,
      criptografiaFake() as never,
      limitesPermitidos as never
    );

    const pagina = await servico.listarLinhaDoTempoPaginada('tenant-1', 'paciente-1', usuarioColaborador, undefined, 1);

    expect(pagina.itens).toHaveLength(1);
    expect(pagina.itens[0]).toEqual(expect.objectContaining({ titulo: 'Ajuste de conduta' }));
    expect(pagina.itens[0]).not.toHaveProperty('descricao');
    expect(pagina.proximoCursor).toBeTruthy();
    expect(query.mock.calls[0][1]).toEqual(['tenant-1', 'paciente-1', null, null, 2]);
    await expect(servico.listarLinhaDoTempoPaginada('tenant-1', 'paciente-1', usuarioColaborador, 'invalido')).rejects.toBeInstanceOf(BadRequestException);
  });
});
