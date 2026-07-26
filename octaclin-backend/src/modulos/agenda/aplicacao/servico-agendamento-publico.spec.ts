import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { AgendaLinkPublicoOrm } from '../infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm } from '../infraestrutura/agenda-solicitacao.orm';
import { CriarSolicitacaoAgendamentoPublicoDto } from './dtos';
import { ServicoAgendamentoPublico } from './servico-agendamento-publico';

interface EstadoFalso {
  link?: AgendaLinkPublicoOrm | null;
  profissional?: ProfissionalOrm | null;
  consultas?: AgendaConsultaOrm[];
  bloqueios?: AgendaBloqueioExternoOrm[];
}

function criarRepositorioLink(estado: EstadoFalso) {
  return {
    findOne: jest.fn(async () => estado.link ?? null)
  };
}

function criarRepositorioProfissional(estado: EstadoFalso) {
  return {
    findOne: jest.fn(async () => estado.profissional ?? null)
  };
}

function criarRepositorioConsulta(estado: EstadoFalso) {
  return {
    find: jest.fn(async () => estado.consultas ?? [])
  };
}

function criarRepositorioBloqueio(estado: EstadoFalso) {
  return {
    find: jest.fn(async () => estado.bloqueios ?? [])
  };
}

function criarRepositorioSolicitacao() {
  let ultimoSalvo: AgendaSolicitacaoOrm | null = null;
  return {
    create: jest.fn((entrada: Partial<AgendaSolicitacaoOrm>) => entrada),
    save: jest.fn(async (entrada: Partial<AgendaSolicitacaoOrm>) => {
      ultimoSalvo = {
        id: 'solicitacao-1',
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        inicioEm: new Date('2026-07-28T13:00:00.000Z'),
        fimEm: new Date('2026-07-28T14:00:00.000Z'),
        nomeCriptografado: Buffer.from(''),
        contatoCriptografado: Buffer.from(''),
        status: 'pendente',
        expiraEm: new Date('2026-07-28T13:00:00.000Z'),
        criadoEm: new Date('2026-07-26T12:00:00.000Z'),
        atualizadoEm: new Date('2026-07-26T12:00:00.000Z'),
        ...entrada
      } as AgendaSolicitacaoOrm;
      return ultimoSalvo;
    }),
    ultimoSalvo: () => ultimoSalvo
  };
}

function criarServico(estado: EstadoFalso = {}) {
  const repositorios = {
    link: criarRepositorioLink(estado),
    profissional: criarRepositorioProfissional(estado),
    consulta: criarRepositorioConsulta(estado),
    bloqueio: criarRepositorioBloqueio(estado),
    solicitacao: criarRepositorioSolicitacao()
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AgendaLinkPublicoOrm) return repositorios.link;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
      if (entidade === AgendaBloqueioExternoOrm) return repositorios.bloqueio;
      if (entidade === AgendaSolicitacaoOrm) return repositorios.solicitacao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const fonteDados = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === AgendaLinkPublicoOrm) return repositorios.link;
      throw new Error(`Repositorio global nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn(async (_tenantId: string, operacao: (manager: typeof gerenciador) => Promise<unknown>) => operacao(gerenciador))
  };
  const protecaoAbuso = {
    consumirTentativa: jest.fn(async () => undefined)
  } as unknown as ServicoProtecaoAbuso;
  const criptografia = new CriptografiaDadosSensiveis();

  return {
    servico: new ServicoAgendamentoPublico(executorTenant as never, fonteDados as never, criptografia, protecaoAbuso),
    executorTenant,
    fonteDados,
    protecaoAbuso,
    repositorios
  };
}

function criarLinkAtivo(): AgendaLinkPublicoOrm {
  return {
    id: 'link-1',
    tenantId: 'tenant-1',
    profissionalId: 'profissional-1',
    tokenHash: createHash('sha256').update('token-valido').digest('hex'),
    ativo: true,
    duracaoMinutos: 60,
    criadoEm: new Date('2026-07-01T12:00:00.000Z'),
    atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
  };
}

function criarProfissional(): ProfissionalOrm {
  return {
    id: 'profissional-1',
    tenantId: 'tenant-1',
    usuarioId: 'usuario-1',
    nomeCriptografado: new CriptografiaDadosSensiveis().criptografar('Dra. Carla'),
    criadoEm: new Date('2026-07-01T12:00:00.000Z'),
    atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
  };
}

describe('ServicoAgendamentoPublico', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-26T12:10:00.000Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna somente resumo publico com horarios livres e bloqueia lookup apos antiabuso', async () => {
    const { servico, protecaoAbuso, repositorios } = criarServico({
      link: criarLinkAtivo(),
      profissional: criarProfissional(),
      consultas: [
        {
          id: 'consulta-ocupada',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          titulo: 'Consulta ocupada',
          inicioEm: new Date('2026-07-26T14:00:00.000Z'),
          fimEm: new Date('2026-07-26T15:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: {},
          criadoEm: new Date('2026-07-01T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
        }
      ],
      bloqueios: [
        {
          id: 'bloqueio-1',
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          googleEventId: 'evento-externo-1',
          inicioEm: new Date('2026-07-26T16:00:00.000Z'),
          fimEm: new Date('2026-07-26T17:00:00.000Z'),
          criadoEm: new Date('2026-07-01T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
        }
      ]
    });

    const resumo = await servico.obterAgendaPublica('token-valido', '203.0.113.5');

    const consumirTentativaMock = protecaoAbuso.consumirTentativa as unknown as jest.Mock;

    expect(protecaoAbuso.consumirTentativa).toHaveBeenCalled();
    expect(consumirTentativaMock.mock.invocationCallOrder[0]).toBeLessThan(
      repositorios.link.findOne.mock.invocationCallOrder[0]
    );
    expect(resumo.profissionalNome).toBe('Dra. Carla');
    expect(resumo.timezone).toBe('America/Sao_Paulo');
    expect(resumo.duracaoMinutos).toBe(60);
    expect(resumo.horariosLivres).toContain('2026-07-26T13:00:00.000Z');
    expect(resumo.horariosLivres).not.toContain('2026-07-26T14:00:00.000Z');
    expect(resumo.horariosLivres).not.toContain('2026-07-26T16:00:00.000Z');
    expect(JSON.stringify(resumo)).not.toContain('tenantId');
    expect(JSON.stringify(resumo)).not.toContain('pacienteId');
  });

  it('retorna resposta neutra para token ausente ou inativo', async () => {
    const { servico } = criarServico({ link: null });

    await expect(servico.obterAgendaPublica('token-invalido', '203.0.113.5')).rejects.toEqual(
      new NotFoundException('Link de agendamento indisponivel.')
    );
  });

  it('interrompe o lookup quando o antiabuso bloqueia a tentativa', async () => {
    const { servico, protecaoAbuso, repositorios } = criarServico({
      link: criarLinkAtivo(),
      profissional: criarProfissional()
    });
    (protecaoAbuso.consumirTentativa as jest.Mock).mockRejectedValueOnce(
      new HttpException('Muitas tentativas de agendamento. Tente novamente em alguns minutos.', HttpStatus.TOO_MANY_REQUESTS)
    );

    await expect(servico.obterAgendaPublica('token-valido', '203.0.113.5')).rejects.toBeInstanceOf(HttpException);
    expect(repositorios.link.findOne).not.toHaveBeenCalled();
  });

  it('persiste solicitacao pendente com dados criptografados e sem criar consulta ou paciente', async () => {
    const { servico, repositorios } = criarServico({
      link: criarLinkAtivo(),
      profissional: criarProfissional()
    });
    const dados: CriarSolicitacaoAgendamentoPublicoDto = {
      nome: 'Ana Silva',
      email: 'ana@exemplo.com',
      whatsapp: '5511999998888',
      observacao: 'Primeira consulta',
      inicioEm: '2026-07-28T13:00:00.000Z'
    };

    const resposta = await servico.criarSolicitacaoPublica('token-valido', dados, '203.0.113.5');
    const salvo = repositorios.solicitacao.ultimoSalvo();
    const criptografia = new CriptografiaDadosSensiveis();

    expect(resposta).toEqual({ status: 'pendente' });
    expect(salvo).toBeTruthy();
    expect(salvo?.status).toBe('pendente');
    expect(salvo?.pacienteId).toBeUndefined();
    expect(salvo?.consultaId).toBeUndefined();
    expect(criptografia.descriptografar(salvo?.nomeCriptografado as Buffer)).toBe('Ana Silva');
    expect(criptografia.descriptografar(salvo?.contatoCriptografado as Buffer)).toBe(
      JSON.stringify({ email: 'ana@exemplo.com', whatsapp: '5511999998888' })
    );
    expect(criptografia.descriptografar(salvo?.observacaoCriptografada as Buffer)).toBe('Primeira consulta');
  });

  it('revalida disponibilidade antes de salvar a solicitacao publica', async () => {
    const { servico, repositorios } = criarServico({
      link: criarLinkAtivo(),
      profissional: criarProfissional(),
      consultas: [
        {
          id: 'consulta-concorrente',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-9',
          profissionalId: 'profissional-1',
          titulo: 'Consulta concorrente',
          inicioEm: new Date('2026-07-28T13:00:00.000Z'),
          fimEm: new Date('2026-07-28T14:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: {},
          criadoEm: new Date('2026-07-01T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
        }
      ]
    });

    await expect(
      servico.criarSolicitacaoPublica(
        'token-valido',
        {
          nome: 'Ana Silva',
          email: 'ana@exemplo.com',
          inicioEm: '2026-07-28T13:00:00.000Z'
        },
        '203.0.113.5'
      )
    ).rejects.toThrow('Horario indisponivel.');
    expect(repositorios.solicitacao.save).not.toHaveBeenCalled();
  });
});
