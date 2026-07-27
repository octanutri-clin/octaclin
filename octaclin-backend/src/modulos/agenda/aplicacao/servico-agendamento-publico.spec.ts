import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { AgendaLinkPublicoOrm } from '../infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm } from '../infraestrutura/agenda-solicitacao.orm';
import { CriarSolicitacaoAgendamentoPublicoDto } from './dtos';
import { ServicoAgenda } from './servico-agenda';
import { ServicoAgendamentoPublico, solicitacaoPendenteExpirou } from './servico-agendamento-publico';

interface EstadoFalso {
  links?: AgendaLinkPublicoOrm[];
  link?: AgendaLinkPublicoOrm | null;
  profissionais?: ProfissionalOrm[];
  profissional?: ProfissionalOrm | null;
  consultas?: AgendaConsultaOrm[];
  bloqueios?: AgendaBloqueioExternoOrm[];
  solicitacoes?: AgendaSolicitacaoOrm[];
  criarConsultaImpl?: (tenantId: string, entrada: Record<string, unknown>, usuario: UsuarioAutenticado) => Promise<unknown>;
  cancelarConsultaImpl?: (tenantId: string, consultaId: string, usuario: UsuarioAutenticado) => Promise<unknown>;
  falharAtualizacaoFinal?: boolean;
}

function coincideWhere<T extends object>(registro: T, where: Partial<T> = {}): boolean {
  return Object.entries(where).every(([chave, valor]) => {
    const atual = (registro as Record<string, unknown>)[chave];
    if (valor && typeof valor === 'object' && '_type' in (valor as Record<string, unknown>)) {
      const operador = valor as { _type?: string; _value?: unknown };
      if (operador._type === 'moreThan') return atual instanceof Date && operador._value instanceof Date && atual > operador._value;
      if (operador._type === 'lessThan') return atual instanceof Date && operador._value instanceof Date && atual < operador._value;
      if (operador._type === 'isNull') return atual == null;
      return true;
    }
    return atual === valor;
  });
}

function criarRepositorioLink(estado: EstadoFalso) {
  const links = [...(estado.links ?? (estado.link ? [estado.link] : []))].filter(
    (item): item is AgendaLinkPublicoOrm => Boolean(item)
  );

  return {
    findOne: jest.fn(async (consulta?: { where?: Partial<AgendaLinkPublicoOrm> }) => {
      const where = consulta?.where ?? {};
      return links.find((item) => coincideWhere(item, where)) ?? null;
    }),
    find: jest.fn(async (consulta?: { where?: Partial<AgendaLinkPublicoOrm> }) => {
      const where = consulta?.where ?? {};
      return links.filter((item) => coincideWhere(item, where));
    }),
    update: jest.fn(async (criterios: Partial<AgendaLinkPublicoOrm>, valores: Partial<AgendaLinkPublicoOrm>) => {
      let afetados = 0;
      for (const link of links) {
        if (!coincideWhere(link, criterios)) continue;
        Object.assign(link, valores);
        afetados++;
      }
      return { affected: afetados };
    }),
    create: jest.fn((entrada: Partial<AgendaLinkPublicoOrm>) => entrada),
    save: jest.fn(async (entrada: Partial<AgendaLinkPublicoOrm>) => {
      const salvo = {
        id: entrada.id ?? `link-${links.length + 1}`,
        tenantId: 'tenant-1',
        profissionalId: 'profissional-1',
        tokenHash: '',
        ativo: true,
        duracaoMinutos: 50,
        criadoEm: new Date('2026-07-26T12:00:00.000Z'),
        atualizadoEm: new Date('2026-07-26T12:00:00.000Z'),
        ...entrada
      } as AgendaLinkPublicoOrm;
      const indice = links.findIndex((item) => item.id === salvo.id);
      if (indice >= 0) links[indice] = salvo;
      else links.push(salvo);
      return salvo;
    }),
    todos: () => links
  };
}

function criarRepositorioProfissional(estado: EstadoFalso) {
  const profissionais = [...(estado.profissionais ?? (estado.profissional ? [estado.profissional] : []))].filter(
    (item): item is ProfissionalOrm => Boolean(item)
  );

  return {
    findOne: jest.fn(async (consulta?: { where?: Partial<ProfissionalOrm> }) => {
      const where = consulta?.where ?? {};
      return profissionais.find((item) => coincideWhere(item, where)) ?? null;
    }),
    find: jest.fn(async () => profissionais)
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

function criarRepositorioSolicitacao(estado: EstadoFalso) {
  const solicitacoes = [...(estado.solicitacoes ?? [])];
  let ultimoSalvo: AgendaSolicitacaoOrm | null = null;

  return {
    create: jest.fn((entrada: Partial<AgendaSolicitacaoOrm>) => entrada),
    save: jest.fn(async (entrada: Partial<AgendaSolicitacaoOrm>) => {
      const salvo = {
        id: entrada.id ?? 'solicitacao-1',
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
      const indice = solicitacoes.findIndex((item) => item.id === salvo.id);
      if (indice >= 0) solicitacoes[indice] = salvo;
      else solicitacoes.push(salvo);
      ultimoSalvo = salvo;
      return salvo;
    }),
    find: jest.fn(async (consulta?: { where?: Partial<AgendaSolicitacaoOrm> }) => {
      const where = consulta?.where ?? {};
      return solicitacoes.filter((item) => coincideWhere(item, where));
    }),
    findOne: jest.fn(async (consulta?: { where?: Partial<AgendaSolicitacaoOrm> }) => {
      const where = consulta?.where ?? {};
      return solicitacoes.find((item) => coincideWhere(item, where)) ?? null;
    }),
    update: jest.fn(async (criterios: Partial<AgendaSolicitacaoOrm>, valores: Partial<AgendaSolicitacaoOrm>) => {
      if (estado.falharAtualizacaoFinal && valores.status === 'aprovada') {
        throw new Error('falha-persistencia-final');
      }

      let afetados = 0;
      for (const solicitacao of solicitacoes) {
        if (!coincideWhere(solicitacao, criterios)) continue;
        Object.assign(solicitacao, valores);
        afetados++;
      }
      return { affected: afetados };
    }),
    ultimoSalvo: () => ultimoSalvo,
    todos: () => solicitacoes
  };
}

function criarServico(estado: EstadoFalso = {}) {
  const repositorios = {
    link: criarRepositorioLink(estado),
    profissional: criarRepositorioProfissional(estado),
    consulta: criarRepositorioConsulta(estado),
    bloqueio: criarRepositorioBloqueio(estado),
    solicitacao: criarRepositorioSolicitacao(estado)
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
  const servicoAgenda = {
    criarConsulta: jest.fn(async (tenantId: string, entrada: Record<string, unknown>, usuario: UsuarioAutenticado) => {
      if (estado.criarConsultaImpl) {
        return estado.criarConsultaImpl(tenantId, entrada, usuario);
      }

      return {
        id: 'consulta-1',
        tenantId: 'tenant-1',
        pacienteId: entrada.pacienteId,
        profissionalId: entrada.profissionalId,
        titulo: 'Consulta - Ana Silva',
        inicioEm: new Date(entrada.inicioEm as string),
        fimEm: new Date(entrada.fimEm as string),
        timezone: 'America/Sao_Paulo',
        status: 'agendada',
        notificacoes: {},
        payload: {},
        criadoEm: new Date('2026-07-26T12:00:00.000Z'),
        atualizadoEm: new Date('2026-07-26T12:00:00.000Z')
      };
    }),
    cancelarConsulta: jest.fn(async (tenantId: string, consultaId: string, _dados: unknown, usuario: UsuarioAutenticado) => {
      if (estado.cancelarConsultaImpl) {
        return estado.cancelarConsultaImpl(tenantId, consultaId, usuario);
      }

      return { id: consultaId, tenantId, status: 'cancelada' };
    })
  } as unknown as ServicoAgenda;

  return {
    servico: new ServicoAgendamentoPublico(
      executorTenant as never,
      fonteDados as never,
      criptografia,
      protecaoAbuso,
      servicoAgenda
    ),
    executorTenant,
    fonteDados,
    protecaoAbuso,
    repositorios,
    servicoAgenda
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

function criarProfissionalDois(): ProfissionalOrm {
  return {
    id: 'profissional-2',
    tenantId: 'tenant-1',
    usuarioId: 'usuario-2',
    nomeCriptografado: new CriptografiaDadosSensiveis().criptografar('Dr. Bruno'),
    criadoEm: new Date('2026-07-01T12:00:00.000Z'),
    atualizadoEm: new Date('2026-07-01T12:00:00.000Z')
  };
}

function criarSolicitacaoPendente(parcial: Partial<AgendaSolicitacaoOrm> = {}): AgendaSolicitacaoOrm {
  const criptografia = new CriptografiaDadosSensiveis();
  return {
    id: parcial.id ?? 'solicitacao-pendente-1',
    tenantId: 'tenant-1',
    profissionalId: 'profissional-1',
    inicioEm: new Date('2026-07-28T13:00:00.000Z'),
    fimEm: new Date('2026-07-28T14:00:00.000Z'),
    nomeCriptografado: criptografia.criptografar('Ana Silva'),
    contatoCriptografado: criptografia.criptografar(JSON.stringify({ email: 'ana@exemplo.com', whatsapp: '5511999998888' })),
    observacaoCriptografada: criptografia.criptografar('Primeira consulta'),
    status: 'pendente',
    expiraEm: new Date('2026-07-28T13:00:00.000Z'),
    criadoEm: new Date('2026-07-26T12:00:00.000Z'),
    atualizadoEm: new Date('2026-07-26T12:00:00.000Z'),
    ...parcial
  };
}

const usuarioProfissionalUm: UsuarioAutenticado = {
  usuarioId: 'usuario-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional-1',
  permissoes: ['agenda.consultas.criar']
};

const usuarioProfissionalDois: UsuarioAutenticado = {
  usuarioId: 'usuario-2',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional-2',
  permissoes: ['agenda.consultas.criar']
};

const usuarioSuperAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-admin',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash-admin',
  permissoes: ['agenda.consultas.criar']
};

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
    expect(repositorios.consulta.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          status: 'agendada',
          inicioEm: expect.objectContaining({ _value: new Date('2026-08-25T12:10:00.000Z') }),
          fimEm: expect.objectContaining({ _value: new Date('2026-07-26T12:10:00.000Z') })
        })
      })
    );
    expect(repositorios.bloqueio.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          profissionalId: 'profissional-1',
          inicioEm: expect.objectContaining({ _value: new Date('2026-08-25T12:10:00.000Z') }),
          fimEm: expect.objectContaining({ _value: new Date('2026-07-26T12:10:00.000Z') })
        })
      })
    );
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
    expect(salvo?.expiraEm.toISOString()).toBe('2026-07-28T13:00:00.000Z');
    expect(salvo?.expiraEm.getTime()).toBe(salvo?.inicioEm.getTime());
    expect(criptografia.descriptografar(salvo?.nomeCriptografado as Buffer)).toBe('Ana Silva');
    expect(criptografia.descriptografar(salvo?.contatoCriptografado as Buffer)).toBe(
      JSON.stringify({ email: 'ana@exemplo.com', whatsapp: '5511999998888' })
    );
    expect(criptografia.descriptografar(salvo?.observacaoCriptografada as Buffer)).toBe('Primeira consulta');
  });

  it('formaliza que a solicitacao pendente expira no inicio do horario e deve ser rejeitada quando expiraEm for menor ou igual a agora', () => {
    expect(solicitacaoPendenteExpirou(new Date('2026-07-28T13:00:00.000Z'), new Date('2026-07-28T12:59:59.999Z'))).toBe(false);
    expect(solicitacaoPendenteExpirou(new Date('2026-07-28T13:00:00.000Z'), new Date('2026-07-28T13:00:00.000Z'))).toBe(true);
    expect(solicitacaoPendenteExpirou(new Date('2026-07-28T13:00:00.000Z'), new Date('2026-07-28T13:00:00.001Z'))).toBe(true);
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

  it('lista apenas solicitacoes do proprio profissional autenticado', async () => {
    const { servico } = criarServico({
      profissionais: [criarProfissional(), criarProfissionalDois()],
      solicitacoes: [
        criarSolicitacaoPendente({ id: 'sol-1', profissionalId: 'profissional-1' }),
        criarSolicitacaoPendente({ id: 'sol-2', profissionalId: 'profissional-2' })
      ]
    });

    const solicitacoes = await servico.listarSolicitacoes('tenant-1', usuarioProfissionalUm);

    expect(solicitacoes.map((item) => item.id)).toEqual(['sol-1']);
    expect(solicitacoes[0]).toEqual(
      expect.objectContaining({
        nome: 'Ana Silva',
        contato: { email: 'ana@exemplo.com', whatsapp: '5511999998888' }
      })
    );
  });

  it('impede profissional de aprovar solicitacao de outro profissional', async () => {
    const { servico, servicoAgenda } = criarServico({
      profissionais: [criarProfissional(), criarProfissionalDois()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-1', profissionalId: 'profissional-1' })]
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-1', { pacienteId: 'paciente-1' }, usuarioProfissionalDois)
    ).rejects.toThrow('Solicitacao nao encontrada.');
    expect(servicoAgenda.criarConsulta).not.toHaveBeenCalled();
  });

  it('rejeita decisao apos expiraEm e marca a solicitacao como expirada', async () => {
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [
        criarSolicitacaoPendente({
          id: 'sol-expirada',
          expiraEm: new Date('2026-07-26T12:09:59.000Z')
        })
      ]
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-expirada', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('Solicitacao expirada.');

    const atualizada = repositorios.solicitacao.todos().find((item) => item.id === 'sol-expirada');
    expect(atualizada?.status).toBe('expirada');
    expect(servicoAgenda.criarConsulta).not.toHaveBeenCalled();
  });

  it('aprova somente uma vez e delega a criacao para a agenda existente', async () => {
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-aprovacao' })]
    });

    const resposta = await servico.aprovarSolicitacao(
      'tenant-1',
      'sol-aprovacao',
      { pacienteId: 'paciente-1' },
      usuarioProfissionalUm
    );

    expect(servicoAgenda.criarConsulta).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        pacienteId: 'paciente-1',
        profissionalId: 'profissional-1',
        inicioEm: '2026-07-28T13:00:00.000Z',
        fimEm: '2026-07-28T14:00:00.000Z',
        observacoes: 'Primeira consulta'
      }),
      usuarioProfissionalUm
    );
    expect(resposta).toEqual(
      expect.objectContaining({
        id: 'sol-aprovacao',
        status: 'aprovada',
        pacienteId: 'paciente-1',
        consultaId: 'consulta-1'
      })
    );
    expect(repositorios.solicitacao.todos().find((item) => item.id === 'sol-aprovacao')).toEqual(
      expect.objectContaining({
        status: 'aprovada',
        pacienteId: 'paciente-1',
        consultaId: 'consulta-1',
        decididaPorUsuarioId: 'usuario-1'
      })
    );

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-aprovacao', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('Solicitacao ja decidida.');
  });

  it('rotaciona o link publico do profissional e inativa o token anterior', async () => {
    const { servico, repositorios } = criarServico({
      profissionais: [criarProfissional()],
      links: [criarLinkAtivo()]
    });

    const resultado = await servico.rotacionarLinkPublico('tenant-1', usuarioProfissionalUm);

    expect(resultado).toEqual(
      expect.objectContaining({
        profissionalId: 'profissional-1',
        duracaoMinutos: 60,
        token: expect.any(String)
      })
    );
    const links = repositorios.link.todos();
    expect(links).toHaveLength(2);
    expect(links.find((item) => item.id === 'link-1')?.ativo).toBe(false);
    expect(links.filter((item) => item.ativo)).toHaveLength(1);
    expect(links.find((item) => item.ativo)?.tokenHash).toBe(createHash('sha256').update(resultado.token).digest('hex'));
  });

  it('preserva historico inativo e mantem no maximo um link ativo por tenant e profissional apos rotacao', async () => {
    const { servico, repositorios } = criarServico({
      profissionais: [criarProfissional()],
      links: [
        criarLinkAtivo(),
        {
          ...criarLinkAtivo(),
          id: 'link-antigo',
          tokenHash: createHash('sha256').update('token-antigo').digest('hex'),
          ativo: false,
          criadoEm: new Date('2026-06-01T12:00:00.000Z'),
          atualizadoEm: new Date('2026-06-01T12:00:00.000Z')
        }
      ]
    });

    await servico.rotacionarLinkPublico('tenant-1', usuarioProfissionalUm);

    const links = repositorios.link.todos();
    expect(links.filter((item) => item.profissionalId === 'profissional-1')).toHaveLength(3);
    expect(links.filter((item) => item.profissionalId === 'profissional-1' && item.ativo)).toHaveLength(1);
    expect(links.find((item) => item.id === 'link-antigo')?.ativo).toBe(false);
  });

  it('faz claim atomico da solicitacao antes de criar a consulta e impede segunda aprovacao concorrente de chamar a agenda', async () => {
    let liberarCriacao: (() => void) | undefined;
    const bloqueioCriacao = new Promise<void>((resolve) => {
      liberarCriacao = resolve;
    });
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-claim' })],
      criarConsultaImpl: async (_tenantId, entrada) => {
        await bloqueioCriacao;
        return {
          id: 'consulta-claim',
          tenantId: 'tenant-1',
          pacienteId: entrada.pacienteId,
          profissionalId: entrada.profissionalId,
          titulo: 'Consulta - Ana Silva',
          inicioEm: new Date(entrada.inicioEm as string),
          fimEm: new Date(entrada.fimEm as string),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: {},
          criadoEm: new Date('2026-07-26T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-26T12:00:00.000Z')
        };
      }
    });

    const primeira = servico.aprovarSolicitacao('tenant-1', 'sol-claim', { pacienteId: 'paciente-1' }, usuarioProfissionalUm);
    await Promise.resolve();
    const segunda = servico.aprovarSolicitacao('tenant-1', 'sol-claim', { pacienteId: 'paciente-1' }, usuarioProfissionalUm);

    liberarCriacao?.();

    const [resultadoPrimeira, resultadoSegunda] = await Promise.allSettled([primeira, segunda]);

    expect(servicoAgenda.criarConsulta).toHaveBeenCalledTimes(1);
    expect(resultadoPrimeira.status).toBe('fulfilled');
    expect(resultadoSegunda.status).toBe('rejected');
    expect((resultadoSegunda as PromiseRejectedResult).reason.message).toBe('Solicitacao em processamento.');
    expect(repositorios.solicitacao.todos().find((item) => item.id === 'sol-claim')).toEqual(
      expect.objectContaining({
        status: 'aprovada',
        consultaId: 'consulta-claim'
      })
    );
  });

  it('restaura a solicitacao para pendente se a criacao da consulta falhar apos o claim', async () => {
    const { servico, repositorios } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-rollback' })],
      criarConsultaImpl: async () => {
        throw new Error('falha-google');
      }
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-rollback', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('falha-google');

    const solicitacao = repositorios.solicitacao.todos().find((item) => item.id === 'sol-rollback');
    expect(solicitacao).toMatchObject({ status: 'pendente' });
    expect(solicitacao?.pacienteId).toBeNull();
    expect(solicitacao?.consultaId).toBeNull();
    expect(solicitacao?.decididaEm).toBeNull();
    expect(solicitacao?.decididaPorUsuarioId).toBeNull();
    expect(repositorios.solicitacao.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'sol-rollback',
        status: 'processando',
        decididaPorUsuarioId: 'usuario-1'
      }),
      expect.objectContaining({
        status: 'pendente',
        decididaEm: null,
        decididaPorUsuarioId: null,
        pacienteId: null,
        consultaId: null
      })
    );
  });

  it('restaura a solicitacao para pendente se validarDisponibilidade falhar apos o claim', async () => {
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-conflito' })],
      consultas: [
        {
          id: 'consulta-conflitante',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-9',
          profissionalId: 'profissional-1',
          titulo: 'Consulta conflitante',
          inicioEm: new Date('2026-07-28T13:15:00.000Z'),
          fimEm: new Date('2026-07-28T13:45:00.000Z'),
          timezone: 'America/Sao_Paulo',
          status: 'agendada',
          notificacoes: {},
          payload: {},
          criadoEm: new Date('2026-07-26T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-26T12:00:00.000Z')
        }
      ]
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-conflito', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('Horario indisponivel.');

    const solicitacao = repositorios.solicitacao.todos().find((item) => item.id === 'sol-conflito');
    expect(servicoAgenda.criarConsulta).not.toHaveBeenCalled();
    expect(solicitacao).toMatchObject({ status: 'pendente' });
    expect(solicitacao?.decididaEm).toBeNull();
    expect(solicitacao?.decididaPorUsuarioId).toBeNull();
    expect(repositorios.solicitacao.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'sol-conflito',
        status: 'processando',
        decididaPorUsuarioId: 'usuario-1'
      }),
      expect.objectContaining({
        status: 'pendente',
        decididaEm: null,
        decididaPorUsuarioId: null,
        pacienteId: null,
        consultaId: null
      })
    );
  });

  it('cancela a consulta criada antes de restaurar pendente se a persistencia final falhar', async () => {
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-compensacao' })],
      falharAtualizacaoFinal: true
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-compensacao', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('falha-persistencia-final');

    expect(servicoAgenda.criarConsulta).toHaveBeenCalledTimes(1);
    expect(servicoAgenda.cancelarConsulta).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-1',
      {},
      usuarioProfissionalUm
    );
    const indiceRollback = (repositorios.solicitacao.update as jest.Mock).mock.calls.findIndex(
      ([, valores]) => valores.status === 'pendente'
    );
    expect((servicoAgenda.cancelarConsulta as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (repositorios.solicitacao.update as jest.Mock).mock.invocationCallOrder[indiceRollback]
    );
    expect(repositorios.solicitacao.todos().find((item) => item.id === 'sol-compensacao')).toMatchObject({
      status: 'pendente',
      pacienteId: null,
      consultaId: null,
      decididaEm: null,
      decididaPorUsuarioId: null
    });
  });

  it('mantem o claim processando se a compensacao da consulta falhar', async () => {
    const { servico, repositorios, servicoAgenda } = criarServico({
      profissionais: [criarProfissional()],
      solicitacoes: [criarSolicitacaoPendente({ id: 'sol-compensacao-falha' })],
      falharAtualizacaoFinal: true,
      cancelarConsultaImpl: async () => {
        throw new Error('falha-cancelamento');
      }
    });

    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-compensacao-falha', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('falha-persistencia-final');

    expect(servicoAgenda.criarConsulta).toHaveBeenCalledTimes(1);
    expect(servicoAgenda.cancelarConsulta).toHaveBeenCalledTimes(1);
    const solicitacao = repositorios.solicitacao.todos().find((item) => item.id === 'sol-compensacao-falha');
    expect(solicitacao).toMatchObject({
      status: 'processando',
      decididaPorUsuarioId: 'usuario-1'
    });
    expect(solicitacao?.pacienteId).toBeUndefined();
    expect(solicitacao?.consultaId).toBeUndefined();
    await expect(
      servico.aprovarSolicitacao('tenant-1', 'sol-compensacao-falha', { pacienteId: 'paciente-1' }, usuarioProfissionalUm)
    ).rejects.toThrow('Solicitacao em processamento.');
    expect(servicoAgenda.criarConsulta).toHaveBeenCalledTimes(1);
  });

  it('permite que SuperAdmin liste solicitacoes do tenant inteiro', async () => {
    const { servico } = criarServico({
      profissionais: [criarProfissional(), criarProfissionalDois()],
      solicitacoes: [
        criarSolicitacaoPendente({ id: 'sol-1', profissionalId: 'profissional-1' }),
        criarSolicitacaoPendente({ id: 'sol-2', profissionalId: 'profissional-2' })
      ]
    });

    const solicitacoes = await servico.listarSolicitacoes('tenant-1', usuarioSuperAdmin);

    expect(solicitacoes.map((item) => item.id)).toEqual(['sol-1', 'sol-2']);
  });
});
