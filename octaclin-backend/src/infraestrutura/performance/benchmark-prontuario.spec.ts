import { AgendaConsultaOrm } from '../../modulos/agenda/infraestrutura/agenda-consulta.orm';
import type { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';
import { MensagemNotificacaoOrm } from '../../modulos/comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../../modulos/mobile/infraestrutura/log-diario-rapido.orm';
import { ServicoPacientes } from '../../modulos/pacientes/aplicacao/servico-pacientes';
import { AcompanhamentoTarefaOrm } from '../../modulos/pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { EvolucaoClinicaOrm } from '../../modulos/pacientes/infraestrutura/evolucao-clinica.orm';
import { PacienteOrm } from '../../modulos/pacientes/infraestrutura/paciente.orm';
import { PlanoAlimentarOrm } from '../../modulos/planos-alimentares/infraestrutura/plano-alimentar.orm';
import { PlanoAlimentarVersaoOrm } from '../../modulos/planos-alimentares/infraestrutura/plano-alimentar-versao.orm';
import { EnvioQuestionarioOrm } from '../../modulos/questionarios/infraestrutura/envio-questionario.orm';
import { QuestionarioOrm } from '../../modulos/questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../modulos/questionarios/infraestrutura/resposta-checkin.orm';

const usuarioSuperAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-superadmin-1',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash-superadmin',
  permissoes: ['pacientes.ler', 'planos_alimentares.ler', 'comunicacoes.mensagens.ler', 'agenda.financeiro.ler']
};

const paciente = {
  id: 'paciente-1',
  tenantId: 'tenant-1',
  profissionalResponsavelId: 'profissional-1',
  nomeCriptografado: Buffer.from('Ana Sintetica'),
  statusAdesao: 'em_acompanhamento',
  scoreRisco: '25',
  criadoEm: new Date('2026-01-01T10:00:00.000Z'),
  atualizadoEm: new Date('2026-08-01T10:00:00.000Z')
};

function instante(indice: number) {
  return new Date(Date.UTC(2026, 7, 1, 12, 0, 0) - indice * 60_000);
}

function serie(quantidade: number, criar: (indice: number) => Record<string, unknown>) {
  return Array.from({ length: quantidade }, (_, indice) => criar(indice));
}

function repositorioCom(metodo: 'find' | 'findOne', retorno: unknown) {
  return { [metodo]: jest.fn(async () => retorno) } as Record<'find' | 'findOne', jest.Mock>;
}

function montarResumoSintetico(quantidadePorFonte: number) {
  const questionarios = serie(quantidadePorFonte, (indice) => ({
    id: `questionario-${indice}`,
    tenantId: 'tenant-1',
    titulo: `Questionario ${indice}`
  }));
  const repositorios = new Map<unknown, Record<string, jest.Mock>>([
    [PacienteOrm, repositorioCom('findOne', paciente)],
    [AgendaConsultaOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `consulta-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      titulo: `Consulta ${indice}`,
      inicioEm: instante(indice),
      fimEm: new Date(instante(indice).getTime() + 3_600_000),
      status: 'concluida',
      local: 'Sala sintetica'
    })))],
    [EnvioQuestionarioOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `envio-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      questionarioId: `questionario-${indice}`,
      status: 'respondido',
      enviadoEm: instante(indice),
      expiraEm: new Date(instante(indice).getTime() + 86_400_000)
    })))],
    [RespostaCheckinOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `resposta-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      envioQuestionarioId: `envio-${indice}`,
      scoreFinal: String(80 - indice),
      criadoEm: instante(indice),
      finalizadoEm: instante(indice)
    })))],
    [LogDiarioRapidoOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `diario-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'humor',
      valor: { humor: 'bem', adesaoPlano: 85, sintomas: 'sem sintomas' },
      registradoEm: instante(indice)
    })))],
    [MensagemNotificacaoOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `mensagem-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      status: 'enviado',
      payload: { texto: `Mensagem sintetica ${indice}` },
      criadoEm: instante(indice),
      enviadoEm: instante(indice)
    })))],
    [EvolucaoClinicaOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `evolucao-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      autorUsuarioId: 'usuario-superadmin-1',
      titulo: `Evolucao ${indice}`,
      conteudoCriptografado: Buffer.from(`Conteudo sintetico ${indice}`),
      tipo: 'observacao',
      visibilidade: 'privada',
      criadoEm: instante(indice),
      atualizadoEm: instante(indice)
    })))],
    [AcompanhamentoTarefaOrm, repositorioCom('find', serie(quantidadePorFonte, (indice) => ({
      id: `tarefa-${indice}`,
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: `Tarefa ${indice}`,
      descricaoCriptografada: Buffer.from(`Descricao sintetica ${indice}`),
      categoria: 'tarefa',
      prioridade: 'media',
      status: 'concluida',
      criadoEm: instante(indice),
      atualizadoEm: instante(indice)
    })))],
    [PlanoAlimentarOrm, repositorioCom('findOne', {
      id: 'plano-1', tenantId: 'tenant-1', pacienteId: 'paciente-1',
      versaoPublicadaAtualId: 'versao-1', atualizadoEm: instante(0)
    })],
    [PlanoAlimentarVersaoOrm, repositorioCom('findOne', {
      id: 'versao-1', tenantId: 'tenant-1', planoId: 'plano-1', numero: 1, publicadaEm: instante(0)
    })],
    [QuestionarioOrm, repositorioCom('find', questionarios)]
  ]);
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => repositorios.get(entidade))
  };
  const servico = new ServicoPacientes(
    { executar: jest.fn((_tenantId: string, operacao: (alvo: unknown) => Promise<unknown>) => operacao(gerenciador)) } as never,
    { descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8')) } as never,
    { checarLimite: jest.fn(async () => ({ permitido: true })) } as never
  );

  return { gerenciador, repositorios, servico };
}

function totalOperacoes(repositorios: Map<unknown, Record<string, jest.Mock>>) {
  return [...repositorios.values()].reduce(
    (total, repositorio) => total + Object.values(repositorio).reduce((subtotal, metodo) => subtotal + metodo.mock.calls.length, 0),
    0
  );
}

describe('benchmark sintetico do prontuario', () => {
  it('mantem o orcamento de consultas constante ao ampliar a massa do resumo', async () => {
    const pequeno = montarResumoSintetico(1);
    const carregado = montarResumoSintetico(30);

    const resumoPequeno = await pequeno.servico.obterProntuario('tenant-1', 'paciente-1', usuarioSuperAdmin);
    const resumoCarregado = await carregado.servico.obterProntuario('tenant-1', 'paciente-1', usuarioSuperAdmin);

    expect(totalOperacoes(pequeno.repositorios)).toBe(11);
    expect(totalOperacoes(carregado.repositorios)).toBe(11);
    expect(carregado.gerenciador.getRepository).toHaveBeenCalledTimes(11);
    expect(carregado.repositorios.get(QuestionarioOrm)?.find).toHaveBeenCalledTimes(1);
    expect(resumoPequeno.linhaDoTempo).toHaveLength(7);
    expect(resumoCarregado.linhaDoTempo).toHaveLength(80);
  });

  it('pagina cinquenta eventos com uma unica query consolidada, sem N+1', async () => {
    const linhas = serie(51, (indice) => ({
      id: `evento-${String(indice).padStart(3, '0')}`,
      tipo: 'consulta',
      titulo: `Evento ${indice}`,
      data: instante(indice),
      status: 'concluida',
      origemId: `consulta-${indice}`,
      origem: 'Agenda',
      responsavelId: 'profissional-1',
      metadados: {}
    }));
    const encontrarPaciente = jest.fn(async () => paciente);
    const query = jest.fn(async (_sql: string, _parametros: unknown[]) => linhas);
    const gerenciador = {
      getRepository: jest.fn(() => ({ findOne: encontrarPaciente })),
      query
    };
    const servico = new ServicoPacientes(
      { executar: jest.fn((_tenantId: string, operacao: (alvo: unknown) => Promise<unknown>) => operacao(gerenciador)) } as never,
      { descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8')) } as never,
      { checarLimite: jest.fn(async () => ({ permitido: true })) } as never
    );

    const pagina = await servico.listarLinhaDoTempoPaginada(
      'tenant-1',
      'paciente-1',
      usuarioSuperAdmin,
      { limite: 50 }
    );

    expect(encontrarPaciente).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining([51]));
    expect(pagina.itens).toHaveLength(50);
    expect(pagina.proximoCursor).toBeTruthy();
  });
});
