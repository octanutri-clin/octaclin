import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { AgendaSolicitacaoOrm } from '../../agenda/infraestrutura/agenda-solicitacao.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { ServicoDashboardClinico } from './servico-dashboard-clinico';
import { DashboardAlertaOcultoOrm } from '../infraestrutura/dashboard-alerta-oculto.orm';

type RegistroTeste =
  | PacienteOrm
  | ProfissionalOrm
  | AgendaConsultaOrm
  | AcompanhamentoTarefaOrm
  | EnvioQuestionarioOrm
  | AgendaSolicitacaoOrm
  | MensagemNotificacaoOrm
  | DashboardAlertaOcultoOrm;

const AGORA = new Date('2026-07-27T15:00:00.000Z');
const DIA = 24 * 60 * 60 * 1000;

function diasAntes(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA);
}

function usuario(papel: UsuarioAutenticado['papel'], usuarioId: string): UsuarioAutenticado {
  return {
    usuarioId,
    tenantId: 'tenant-1',
    papel,
    emailHash: 'hash',
    permissoes: ['dashboard.ler']
  };
}

function profissional(id: string, usuarioId: string, tenantId = 'tenant-1'): ProfissionalOrm {
  return {
    id,
    tenantId,
    usuarioId,
    nomeCriptografado: Buffer.from(`nome-${id}`),
    criadoEm: diasAntes(200),
    atualizadoEm: diasAntes(1)
  };
}

function paciente(
  id: string,
  profissionalResponsavelId: string,
  criadoHaDias: number,
  opcoes: Partial<PacienteOrm> = {}
): PacienteOrm {
  return {
    id,
    tenantId: 'tenant-1',
    profissionalResponsavelId,
    nomeCriptografado: Buffer.from(`nome-${id}`),
    statusAdesao: 'em_acompanhamento',
    scoreRisco: '10',
    criadoEm: diasAntes(criadoHaDias),
    atualizadoEm: diasAntes(1),
    ...opcoes
  };
}

function consulta(
  id: string,
  pacienteId: string,
  profissionalId: string,
  status: AgendaConsultaOrm['status'],
  inicioEm: Date,
  tenantId = 'tenant-1'
): AgendaConsultaOrm {
  return {
    id,
    tenantId,
    pacienteId,
    profissionalId,
    titulo: 'Consulta',
    inicioEm,
    fimEm: new Date(inicioEm.getTime() + 60 * 60 * 1000),
    timezone: 'America/Sao_Paulo',
    status,
    notificacoes: {},
    payload: {},
    criadoEm: diasAntes(100),
    atualizadoEm: diasAntes(1)
  };
}

describe('ServicoDashboardClinico', () => {
  let servico: ServicoDashboardClinico;
  let registros: Map<Function, RegistroTeste[]>;
  let salvarOcultacao: jest.Mock;

  const profissionalUm = usuario('Professional', 'usuario-1');
  const superAdmin = usuario('SuperAdmin', 'usuario-admin');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
    salvarOcultacao = jest.fn(async (valor: DashboardAlertaOcultoOrm) => valor);

    registros = new Map<Function, RegistroTeste[]>([
      [
        ProfissionalOrm,
        [profissional('profissional-1', 'usuario-1'), profissional('profissional-2', 'usuario-2'), profissional('profissional-x', 'usuario-x', 'tenant-2')]
      ],
      [
        PacienteOrm,
        [
          paciente('paciente-risco', 'profissional-1', 120, { statusAdesao: 'risco', scoreRisco: '90' }),
          paciente('paciente-60', 'profissional-1', 150),
          paciente('paciente-90', 'profissional-1', 180),
          paciente('paciente-pausado', 'profissional-1', 180, { statusAdesao: 'inativo' }),
          paciente('paciente-outro', 'profissional-2', 180, { statusAdesao: 'risco', scoreRisco: '99' }),
          paciente('paciente-outro-tenant', 'profissional-1', 180, { tenantId: 'tenant-2' })
        ]
      ],
      [
        AgendaConsultaOrm,
        [
          consulta('concluida-risco', 'paciente-risco', 'profissional-1', 'concluida', diasAntes(35)),
          consulta('concluida-60', 'paciente-60', 'profissional-1', 'concluida', diasAntes(65)),
          consulta('concluida-90', 'paciente-90', 'profissional-1', 'concluida', diasAntes(95)),
          consulta('hoje-1', 'paciente-risco', 'profissional-1', 'agendada', new Date('2026-07-27T17:00:00.000Z')),
          consulta('hoje-outro', 'paciente-outro', 'profissional-2', 'agendada', new Date('2026-07-27T18:00:00.000Z')),
          consulta('hoje-outro-tenant', 'paciente-outro-tenant', 'profissional-1', 'agendada', new Date('2026-07-27T19:00:00.000Z'), 'tenant-2')
        ]
      ],
      [
        AcompanhamentoTarefaOrm,
        [
          {
            id: 'tarefa-1',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-60',
            profissionalId: 'usuario-1',
            titulo: 'Retornar paciente',
            categoria: 'tarefa',
            prioridade: 'alta',
            status: 'pendente',
            vencimentoEm: diasAntes(2),
            criadoEm: diasAntes(10),
            atualizadoEm: diasAntes(2)
          },
          {
            id: 'tarefa-outro',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-outro',
            profissionalId: 'usuario-2',
            titulo: 'Outro profissional',
            categoria: 'tarefa',
            prioridade: 'alta',
            status: 'pendente',
            vencimentoEm: diasAntes(3),
            criadoEm: diasAntes(10),
            atualizadoEm: diasAntes(2)
          }
        ]
      ],
      [
        EnvioQuestionarioOrm,
        [
          {
            id: 'envio-1',
            tenantId: 'tenant-1',
            questionarioId: 'questionario-1',
            pacienteId: 'paciente-90',
            status: 'respondido',
            respondidoEm: diasAntes(1)
          },
          {
            id: 'envio-outro',
            tenantId: 'tenant-1',
            questionarioId: 'questionario-1',
            pacienteId: 'paciente-outro',
            status: 'respondido',
            respondidoEm: diasAntes(1)
          }
        ]
      ],
      [
        AgendaSolicitacaoOrm,
        [
          {
            id: 'solicitacao-1',
            tenantId: 'tenant-1',
            profissionalId: 'profissional-1',
            inicioEm: new Date('2026-07-28T13:00:00.000Z'),
            fimEm: new Date('2026-07-28T14:00:00.000Z'),
            nomeCriptografado: Buffer.from('nome-solicitante'),
            contatoCriptografado: Buffer.from('contato'),
            status: 'pendente',
            expiraEm: new Date('2026-07-28T12:00:00.000Z'),
            criadoEm: diasAntes(1),
            atualizadoEm: diasAntes(1)
          }
        ]
      ],
      [
        MensagemNotificacaoOrm,
        [
          {
            id: 'mensagem-1',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-risco',
            status: 'falhou',
            payload: { texto: 'nao deve sair no resumo' },
            erro: 'segredo tecnico',
            criadoEm: diasAntes(1)
          },
          {
            id: 'mensagem-outro',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-outro',
            status: 'recebido',
            payload: { texto: 'outro profissional' },
            criadoEm: diasAntes(1)
          }
        ]
      ],
      [
        DashboardAlertaOcultoOrm,
        [
          {
            id: 'oculto-1',
            tenantId: 'tenant-1',
            usuarioId: 'usuario-1',
            alertaId: 'tarefa_vencida:profissional-1:tarefa-1',
            ocultoAteEm: new Date('2026-07-28T15:00:00.000Z'),
            criadoEm: diasAntes(1),
            atualizadoEm: diasAntes(1)
          },
          {
            id: 'oculto-risco',
            tenantId: 'tenant-1',
            usuarioId: 'usuario-1',
            alertaId: 'sem_retorno_risco_alto:profissional-1:paciente-risco',
            ocultoAteEm: new Date('2026-07-28T15:00:00.000Z'),
            criadoEm: diasAntes(1),
            atualizadoEm: diasAntes(1)
          },
          {
            id: 'oculto-expirado',
            tenantId: 'tenant-1',
            usuarioId: 'usuario-1',
            alertaId: 'formulario_pendente:profissional-1:envio-1',
            ocultoAteEm: new Date('2026-07-26T15:00:00.000Z'),
            criadoEm: diasAntes(3),
            atualizadoEm: diasAntes(3)
          }
        ]
      ]
    ]);

    const gerenciador = {
      getRepository: jest.fn((entidade: Function) => {
        const dados = registros.get(entidade) ?? [];
        return {
          find: jest.fn(async () => [...dados]),
          findOne: jest.fn(async (opcoes: { where: Record<string, unknown> }) =>
            dados.find((registro) =>
              Object.entries(opcoes.where).every(([chave, valor]) => (registro as unknown as Record<string, unknown>)[chave] === valor)
            )
          ),
          create: jest.fn((valor: DashboardAlertaOcultoOrm) => valor),
          save: salvarOcultacao
        };
      })
    } as unknown as EntityManager;

    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) => operacao(gerenciador))
    } as unknown as ExecutorTenant;
    const criptografia = {
      descriptografar: jest.fn((valor: Buffer) => valor.toString().replace(/^nome-/, ''))
    } as unknown as CriptografiaDadosSensiveis;

    servico = new ServicoDashboardClinico(executor, criptografia);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('forca Professional ao proprio profissional e elimina dados de outro profissional e tenant', async () => {
    const resumo = await servico.obterResumo(
      'tenant-1',
      { periodo: 'hoje', profissionalId: 'profissional-2' },
      profissionalUm
    );

    expect(resumo.contexto.profissionalId).toBe('profissional-1');
    expect(resumo.atendimentos.map((item) => item.id)).toEqual(['hoje-1']);
    expect(resumo.semRetorno.every((item) => item.profissionalId === 'profissional-1')).toBe(true);
    expect(resumo.semRetorno.map((item) => item.pacienteId)).not.toContain('paciente-outro');
    expect(resumo.comunicacoes).toEqual([
      expect.objectContaining({ id: 'mensagem-1', pacienteId: 'paciente-risco', status: 'falhou' })
    ]);
    expect(resumo.comunicacoes[0]).not.toHaveProperty('payload');
    expect(resumo.comunicacoes[0]).not.toHaveProperty('erro');
  });

  it('exige selecao explicita do SuperAdmin e permite selecionar profissional do tenant', async () => {
    const semSelecao = await servico.obterResumo('tenant-1', { periodo: 'hoje' }, superAdmin);
    expect(semSelecao.selecaoObrigatoria).toBe(true);
    expect(semSelecao.atendimentos).toEqual([]);

    const selecionado = await servico.obterResumo(
      'tenant-1',
      { periodo: 'sete_dias', profissionalId: 'profissional-2' },
      superAdmin
    );
    expect(selecionado.selecaoObrigatoria).toBe(false);
    expect(selecionado.contexto.profissionalId).toBe('profissional-2');
    expect(selecionado.atendimentos.map((item) => item.id)).toContain('hoje-outro');
    expect(selecionado.atendimentos.map((item) => item.id)).not.toContain('hoje-outro-tenant');
  });

  it('prioriza risco alto sem retorno, cria faixas 30/60/90+ e exclui paciente inativo', async () => {
    const resumo = await servico.obterResumo('tenant-1', { periodo: 'hoje' }, profissionalUm);

    expect(resumo.semRetorno.map((item) => [item.pacienteId, item.faixa])).toEqual([
      ['paciente-risco', '30'],
      ['paciente-90', '90+'],
      ['paciente-60', '60']
    ]);
    expect(resumo.semRetorno.find((item) => item.pacienteId === 'paciente-pausado')).toBeUndefined();
    expect(resumo.alertas[0]).toEqual(
      expect.objectContaining({
        id: 'sem_retorno_risco_alto:profissional-1:paciente-risco',
        tipo: 'sem_retorno_risco_alto',
        ocultavel: false
      })
    );
    expect(resumo.alertas.map((item) => item.tipo)).not.toContain('tarefa_vencida');
    expect(resumo.alertas.map((item) => item.tipo)).toContain('formulario_pendente');
  });

  it('recusa papeis nao autorizados mesmo se a guarda HTTP for contornada', async () => {
    await expect(
      servico.obterResumo('tenant-1', { periodo: 'hoje' }, usuario('Collaborator', 'usuario-colaborador'))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nao permite ocultar alerta clinico de risco alto', async () => {
    await expect(
      servico.ocultarAlerta(
        'tenant-1',
        'sem_retorno_risco_alto:profissional-1:paciente-risco',
        profissionalUm
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(salvarOcultacao).not.toHaveBeenCalled();
  });

  it('persiste ocultacao individual somente no proprio contexto profissional', async () => {
    const resultado = await servico.ocultarAlerta(
      'tenant-1',
      'tarefa_vencida:profissional-1:tarefa-1',
      profissionalUm
    );

    expect(resultado).toEqual({
      alertaId: 'tarefa_vencida:profissional-1:tarefa-1',
      ocultoAteEm: new Date('2026-07-28T15:00:00.000Z')
    });
    expect(salvarOcultacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        alertaId: 'tarefa_vencida:profissional-1:tarefa-1'
      })
    );

    await expect(
      servico.ocultarAlerta('tenant-1', 'tarefa_vencida:profissional-2:tarefa-outro', profissionalUm)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
