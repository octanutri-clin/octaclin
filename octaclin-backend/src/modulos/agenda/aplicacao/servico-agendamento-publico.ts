import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, IsNull, LessThan, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { AgendaLinkPublicoOrm } from '../infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm, StatusAgendaSolicitacao } from '../infraestrutura/agenda-solicitacao.orm';
import {
  AprovarSolicitacaoAgendamentoDto,
  CriarSolicitacaoAgendamentoPublicoDto,
  RecusarSolicitacaoAgendamentoDto
} from './dtos';
import { ServicoAgenda } from './servico-agenda';

const POLITICA_PUBLICA_CONSULTA = {
  maxTentativas: 30,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 15 * 60 * 1000,
  mensagemBloqueio: 'Muitas tentativas de agendamento. Tente novamente em alguns minutos.'
} as const;

const POLITICA_PUBLICA_ENVIO = {
  maxTentativas: 10,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 30 * 60 * 1000,
  mensagemBloqueio: 'Muitas tentativas de agendamento. Tente novamente em alguns minutos.'
} as const;

const JANELA_DISPONIBILIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const DURACAO_PADRAO_LINK_MINUTOS = 50;
const TIMEZONE_PADRAO = 'America/Sao_Paulo';
const MENSAGEM_LINK_INDISPONIVEL = 'Link de agendamento indisponivel.';
const MENSAGEM_HORARIO_INDISPONIVEL = 'Horario indisponivel.';

interface LinkPublicoAtivo {
  tenantId: string;
  profissionalId: string;
  duracaoMinutos: number;
}

interface FaixaHorario {
  inicioEm: Date;
  fimEm: Date;
}

interface ContatoSolicitacao {
  email?: string;
  whatsapp?: string;
}

interface ContextoAprovacaoSolicitacao {
  solicitacao: AgendaSolicitacaoOrm;
  observacao?: string;
  claimedAt: Date;
}

export interface ResumoAgendaPublica {
  profissionalNome: string;
  timezone: string;
  duracaoMinutos: number;
  horariosLivres: string[];
}

export interface ResultadoSolicitacaoPublica {
  status: 'pendente';
}

export interface LinkAgendaPublicaAutenticado {
  id: string;
  profissionalId: string;
  duracaoMinutos: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface LinkAgendaPublicaRotacionado extends LinkAgendaPublicaAutenticado {
  token: string;
}

export interface SolicitacaoAgendaAutenticada {
  id: string;
  profissionalId: string;
  inicioEm: Date;
  fimEm: Date;
  nome: string;
  contato: ContatoSolicitacao;
  observacao?: string;
  status: StatusAgendaSolicitacao;
  expiraEm: Date;
  decididaEm?: Date | null;
  decididaPorUsuarioId?: string | null;
  pacienteId?: string | null;
  consultaId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

function dataValida(valor: string): Date {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new BadRequestException('Data de agendamento invalida.');
  return data;
}

function textoOpcional(valor?: string): string | undefined {
  const texto = valor?.trim();
  return texto ? texto : undefined;
}

function sobrepoe(janela: FaixaHorario, intervalo: FaixaHorario): boolean {
  return intervalo.inicioEm < janela.fimEm && intervalo.fimEm > janela.inicioEm;
}

export function solicitacaoPendenteExpirou(expiraEm: Date, agora = new Date()): boolean {
  return expiraEm.getTime() <= agora.getTime();
}

@Injectable()
export class ServicoAgendamentoPublico {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly fonteDados: DataSource,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly protecaoAbuso: ServicoProtecaoAbuso,
    private readonly servicoAgenda: ServicoAgenda
  ) {}

  async obterAgendaPublica(token: string, ip: string): Promise<ResumoAgendaPublica> {
    const link = await this.resolverLinkAtivo(token, ip, 'consulta');
    return this.executorTenant.executar(link.tenantId, async (gerenciador) => {
      const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
        where: { id: link.profissionalId, tenantId: link.tenantId, arquivadoEm: IsNull() }
      });
      if (!profissional) throw new NotFoundException(MENSAGEM_LINK_INDISPONIVEL);

      const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE ?? TIMEZONE_PADRAO;
      const agora = new Date(Date.now());
      const fimJanela = new Date(agora.getTime() + JANELA_DISPONIBILIDADE_MS);
      const ocupacoes = await this.listarOcupacoes(gerenciador, link.tenantId, link.profissionalId, agora, fimJanela);

      return {
        profissionalNome: this.criptografia.descriptografar(profissional.nomeCriptografado),
        timezone,
        duracaoMinutos: link.duracaoMinutos,
        horariosLivres: this.calcularHorariosLivres(agora, fimJanela, link.duracaoMinutos, ocupacoes)
      };
    });
  }

  async criarSolicitacaoPublica(
    token: string,
    dados: CriarSolicitacaoAgendamentoPublicoDto,
    ip: string
  ): Promise<ResultadoSolicitacaoPublica> {
    const link = await this.resolverLinkAtivo(token, ip, 'solicitacao');
    const inicioEm = dataValida(dados.inicioEm);
    const fimEm = new Date(inicioEm.getTime() + link.duracaoMinutos * 60 * 1000);
    const agora = new Date(Date.now());
    const fimJanela = new Date(agora.getTime() + JANELA_DISPONIBILIDADE_MS);

    if (inicioEm < agora || fimEm > fimJanela) {
      throw new BadRequestException(MENSAGEM_HORARIO_INDISPONIVEL);
    }

    return this.executorTenant.executar(link.tenantId, async (gerenciador) => {
      const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
        where: { id: link.profissionalId, tenantId: link.tenantId, arquivadoEm: IsNull() }
      });
      if (!profissional) throw new NotFoundException(MENSAGEM_LINK_INDISPONIVEL);

      await this.validarDisponibilidade(gerenciador, link.tenantId, link.profissionalId, { inicioEm, fimEm });

      const repositorio = gerenciador.getRepository(AgendaSolicitacaoOrm);
      const observacao = textoOpcional(dados.observacao);

      await repositorio.save(
        repositorio.create({
          tenantId: link.tenantId,
          profissionalId: link.profissionalId,
          inicioEm,
          fimEm,
          nomeCriptografado: this.criptografia.criptografar(dados.nome.trim()),
          contatoCriptografado: this.criptografia.criptografar(this.serializarContato(dados)),
          observacaoCriptografada: observacao ? this.criptografia.criptografar(observacao) : undefined,
          status: 'pendente',
          expiraEm: inicioEm
        })
      );

      return { status: 'pendente' };
    });
  }

  async listarLinksPublicos(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId?: string
  ): Promise<LinkAgendaPublicaAutenticado[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await this.resolverProfissionalIdEscopo(gerenciador, tenantId, usuario, profissionalId);
      const links = await gerenciador.getRepository(AgendaLinkPublicoOrm).find({
        where: {
          tenantId,
          ativo: true,
          ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {})
        }
      });
      return links
        .slice()
        .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime())
        .map((link) => this.mapearLinkAutenticado(link));
    });
  }

  async rotacionarLinkPublico(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId?: string
  ): Promise<LinkAgendaPublicaRotacionado> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissional = await this.resolverProfissionalAlvo(gerenciador, tenantId, usuario, profissionalId);
      const repositorio = gerenciador.getRepository(AgendaLinkPublicoOrm);
      const ativos = await repositorio.find({
        where: { tenantId, profissionalId: profissional.id, ativo: true }
      });

      for (const link of ativos) {
        link.ativo = false;
        await repositorio.save(link);
      }

      const token = randomBytes(24).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const duracaoMinutos = ativos[0]?.duracaoMinutos ?? DURACAO_PADRAO_LINK_MINUTOS;
      const criado = await repositorio.save(
        repositorio.create({
          tenantId,
          profissionalId: profissional.id,
          tokenHash,
          ativo: true,
          duracaoMinutos
        })
      );

      return {
        ...this.mapearLinkAutenticado(criado),
        token
      };
    });
  }

  async listarSolicitacoes(
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId?: string
  ): Promise<SolicitacaoAgendaAutenticada[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await this.resolverProfissionalIdEscopo(gerenciador, tenantId, usuario, profissionalId);
      const solicitacoes = await gerenciador.getRepository(AgendaSolicitacaoOrm).find({
        where: {
          tenantId,
          ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {})
        }
      });

      return solicitacoes
        .slice()
        .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime())
        .map((solicitacao) => this.mapearSolicitacaoAutenticada(solicitacao));
    });
  }

  async aprovarSolicitacao(
    tenantId: string,
    solicitacaoId: string,
    dados: AprovarSolicitacaoAgendamentoDto,
    usuario: UsuarioAutenticado
  ): Promise<SolicitacaoAgendaAutenticada> {
    const contexto = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const now = new Date(Date.now());
      const solicitacao = await this.claimSolicitacaoParaAprovacao(gerenciador, tenantId, solicitacaoId, usuario, now);
      return {
        solicitacao,
        observacao: solicitacao.observacaoCriptografada
          ? this.criptografia.descriptografar(solicitacao.observacaoCriptografada)
          : undefined,
        claimedAt: now
      } satisfies ContextoAprovacaoSolicitacao;
    });

    let consultaCriadaId: string | undefined;
    let associacaoPersistida = false;

    try {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        await this.validarDisponibilidade(gerenciador, tenantId, contexto.solicitacao.profissionalId, {
          inicioEm: contexto.solicitacao.inicioEm,
          fimEm: contexto.solicitacao.fimEm
        });
      });

      const consulta = await this.servicoAgenda.criarConsulta(
        tenantId,
        {
          pacienteId: dados.pacienteId,
          profissionalId: contexto.solicitacao.profissionalId,
          inicioEm: contexto.solicitacao.inicioEm.toISOString(),
          fimEm: contexto.solicitacao.fimEm.toISOString(),
          ...(contexto.observacao ? { observacoes: contexto.observacao } : {})
        },
        usuario
      );
      consultaCriadaId = consulta.id;

      return await this.executorTenant.executar(tenantId, async (gerenciador) => {
        const repositorio = gerenciador.getRepository(AgendaSolicitacaoOrm);
        const affected = await repositorio.update(
          {
            id: solicitacaoId,
            tenantId,
            status: 'processando',
            decididaPorUsuarioId: usuario.usuarioId,
            decididaEm: contexto.claimedAt
          },
          {
            status: 'aprovada',
            decididaEm: new Date(Date.now()),
            decididaPorUsuarioId: usuario.usuarioId,
            pacienteId: dados.pacienteId,
            consultaId: consulta.id
          }
        );

        if (!affected.affected) {
          throw new BadRequestException('Solicitacao em processamento.');
        }
        associacaoPersistida = true;

        const salva = await repositorio.findOne({ where: { id: solicitacaoId, tenantId } });
        if (!salva) throw new NotFoundException('Solicitacao nao encontrada.');
        return this.mapearSolicitacaoAutenticada(salva);
      });
    } catch (erro) {
      if (consultaCriadaId && !associacaoPersistida) {
        try {
          await this.servicoAgenda.cancelarConsulta(tenantId, consultaCriadaId, {}, usuario);
        } catch {
          throw erro;
        }
      }

      if (!associacaoPersistida) {
        await this.restaurarSolicitacaoPendenteAposClaim(tenantId, solicitacaoId, usuario, contexto.claimedAt);
      }
      throw erro;
    }
  }

  async recusarSolicitacao(
    tenantId: string,
    solicitacaoId: string,
    _dados: RecusarSolicitacaoAgendamentoDto,
    usuario: UsuarioAutenticado
  ): Promise<SolicitacaoAgendaAutenticada> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const solicitacao = await this.obterSolicitacaoSobEscopo(gerenciador, tenantId, solicitacaoId, usuario);
      await this.garantirSolicitacaoPendente(gerenciador, solicitacao);

      solicitacao.status = 'recusada';
      solicitacao.decididaEm = new Date(Date.now());
      solicitacao.decididaPorUsuarioId = usuario.usuarioId;

      const salva = await gerenciador.getRepository(AgendaSolicitacaoOrm).save(solicitacao);
      return this.mapearSolicitacaoAutenticada(salva);
    });
  }

  private async resolverLinkAtivo(token: string, ip: string, escopo: 'consulta' | 'solicitacao'): Promise<LinkPublicoAtivo> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const chaveAbuso = `agenda_publica:${escopo}:${ip || 'ip-desconhecido'}:${tokenHash}`;
    const politica = escopo === 'consulta' ? POLITICA_PUBLICA_CONSULTA : POLITICA_PUBLICA_ENVIO;

    await this.protecaoAbuso.consumirTentativa(chaveAbuso, politica);

    const link = await this.fonteDados.getRepository(AgendaLinkPublicoOrm).findOne({
      where: { tokenHash, ativo: true }
    });
    if (!link?.ativo) throw new NotFoundException(MENSAGEM_LINK_INDISPONIVEL);

    return {
      tenantId: link.tenantId,
      profissionalId: link.profissionalId,
      duracaoMinutos: link.duracaoMinutos
    };
  }

  private async listarOcupacoes(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string,
    inicioJanela: Date,
    fimJanela: Date
  ): Promise<FaixaHorario[]> {
    const [consultas, bloqueios] = await Promise.all([
      gerenciador.getRepository(AgendaConsultaOrm).find({
        where: {
          tenantId,
          profissionalId,
          status: 'agendada',
          inicioEm: LessThan(fimJanela),
          fimEm: MoreThan(inicioJanela)
        }
      }),
      gerenciador.getRepository(AgendaBloqueioExternoOrm).find({
        where: {
          tenantId,
          profissionalId,
          inicioEm: LessThan(fimJanela),
          fimEm: MoreThan(inicioJanela)
        }
      })
    ]);

    return [...consultas, ...bloqueios]
      .map((item) => ({ inicioEm: item.inicioEm, fimEm: item.fimEm }))
      .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime());
  }

  private calcularHorariosLivres(
    agora: Date,
    fimJanela: Date,
    duracaoMinutos: number,
    ocupacoes: FaixaHorario[]
  ): string[] {
    const horarios: string[] = [];
    const passoMs = duracaoMinutos * 60 * 1000;
    let cursor = new Date(Math.ceil(agora.getTime() / passoMs) * passoMs);

    while (cursor.getTime() + passoMs <= fimJanela.getTime()) {
      const janela = {
        inicioEm: new Date(cursor),
        fimEm: new Date(cursor.getTime() + passoMs)
      };
      const ocupado = ocupacoes.some((ocupacao) => sobrepoe(janela, ocupacao));
      if (!ocupado) horarios.push(janela.inicioEm.toISOString());
      cursor = new Date(cursor.getTime() + passoMs);
    }

    return horarios;
  }

  private async validarDisponibilidade(
    gerenciador: EntityManager,
    tenantId: string,
    profissionalId: string,
    janela: FaixaHorario
  ): Promise<void> {
    const ocupacoes = await this.listarOcupacoes(gerenciador, tenantId, profissionalId, janela.inicioEm, janela.fimEm);
    if (ocupacoes.some((ocupacao) => sobrepoe(janela, ocupacao))) {
      throw new BadRequestException(MENSAGEM_HORARIO_INDISPONIVEL);
    }
  }

  private async resolverProfissionalIdEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId?: string
  ): Promise<string | undefined> {
    const profissionalIdDoUsuario = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    return profissionalIdDoUsuario ?? profissionalId;
  }

  private async resolverProfissionalAlvo(
    gerenciador: EntityManager,
    tenantId: string,
    usuario: UsuarioAutenticado,
    profissionalId?: string
  ): Promise<ProfissionalOrm> {
    const profissionalIdEscopo = await this.resolverProfissionalIdEscopo(gerenciador, tenantId, usuario, profissionalId);
    if (!profissionalIdEscopo) throw new BadRequestException('Profissional nao informado.');

    const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
      where: { id: profissionalIdEscopo, tenantId, arquivadoEm: IsNull() }
    });
    if (!profissional) throw new NotFoundException('Profissional nao encontrado.');
    return profissional;
  }

  private async obterSolicitacaoSobEscopo(
    gerenciador: EntityManager,
    tenantId: string,
    solicitacaoId: string,
    usuario: UsuarioAutenticado
  ): Promise<AgendaSolicitacaoOrm> {
    const profissionalId = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
    const solicitacao = await gerenciador.getRepository(AgendaSolicitacaoOrm).findOne({
      where: {
        id: solicitacaoId,
        tenantId,
        ...(profissionalId ? { profissionalId } : {})
      }
    });
    if (!solicitacao) throw new NotFoundException('Solicitacao nao encontrada.');
    return solicitacao;
  }

  private async garantirSolicitacaoPendente(
    gerenciador: EntityManager,
    solicitacao: AgendaSolicitacaoOrm
  ): Promise<void> {
    if (solicitacao.status !== 'pendente') {
      throw new BadRequestException('Solicitacao ja decidida.');
    }

    if (!solicitacaoPendenteExpirou(solicitacao.expiraEm, new Date(Date.now()))) return;

    solicitacao.status = 'expirada';
    solicitacao.decididaEm = new Date(Date.now());
    await gerenciador.getRepository(AgendaSolicitacaoOrm).save(solicitacao);
    throw new BadRequestException('Solicitacao expirada.');
  }

  private async claimSolicitacaoParaAprovacao(
    gerenciador: EntityManager,
    tenantId: string,
    solicitacaoId: string,
    usuario: UsuarioAutenticado,
    claimedAt: Date
  ): Promise<AgendaSolicitacaoOrm> {
    const solicitacao = await this.obterSolicitacaoSobEscopo(gerenciador, tenantId, solicitacaoId, usuario);
    if (solicitacaoPendenteExpirou(solicitacao.expiraEm, claimedAt)) {
      solicitacao.status = 'expirada';
      solicitacao.decididaEm = claimedAt;
      await gerenciador.getRepository(AgendaSolicitacaoOrm).save(solicitacao);
      throw new BadRequestException('Solicitacao expirada.');
    }

    const repositorio = gerenciador.getRepository(AgendaSolicitacaoOrm);
    const affected = await repositorio.update(
      {
        id: solicitacaoId,
        tenantId,
        status: 'pendente',
        expiraEm: MoreThan(claimedAt)
      },
      {
        status: 'processando',
        decididaEm: claimedAt,
        decididaPorUsuarioId: usuario.usuarioId
      }
    );

    if (affected.affected) {
      const claimed = await repositorio.findOne({ where: { id: solicitacaoId, tenantId } });
      if (!claimed) throw new NotFoundException('Solicitacao nao encontrada.');
      return claimed;
    }

    const atual = await this.obterSolicitacaoSobEscopo(gerenciador, tenantId, solicitacaoId, usuario);
    if (atual.status === 'processando') throw new BadRequestException('Solicitacao em processamento.');
    await this.garantirSolicitacaoPendente(gerenciador, atual);
    throw new BadRequestException('Solicitacao ja decidida.');
  }

  private async restaurarSolicitacaoPendenteAposClaim(
    tenantId: string,
    solicitacaoId: string,
    usuario: UsuarioAutenticado,
    claimedAt: Date
  ): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaSolicitacaoOrm);
      await repositorio.update(
        {
          id: solicitacaoId,
          tenantId,
          status: 'processando',
          decididaPorUsuarioId: usuario.usuarioId,
          decididaEm: claimedAt
        },
        {
          status: 'pendente',
          decididaEm: null,
          decididaPorUsuarioId: null,
          pacienteId: null,
          consultaId: null
        }
      );
    });
  }

  private serializarContato(dados: CriarSolicitacaoAgendamentoPublicoDto): string {
    const whatsapp = textoOpcional(dados.whatsapp);
    const contato = {
      email: dados.email.trim().toLowerCase(),
      ...(whatsapp ? { whatsapp } : {})
    };
    return JSON.stringify(contato);
  }

  private deserializarContato(contatoCriptografado: Buffer): ContatoSolicitacao {
    try {
      const contato = JSON.parse(this.criptografia.descriptografar(contatoCriptografado)) as {
        email?: unknown;
        whatsapp?: unknown;
      };
      return {
        ...(typeof contato.email === 'string' ? { email: contato.email } : {}),
        ...(typeof contato.whatsapp === 'string' ? { whatsapp: contato.whatsapp } : {})
      };
    } catch {
      return {};
    }
  }

  private mapearLinkAutenticado(link: AgendaLinkPublicoOrm): LinkAgendaPublicaAutenticado {
    return {
      id: link.id,
      profissionalId: link.profissionalId,
      duracaoMinutos: link.duracaoMinutos,
      ativo: link.ativo,
      criadoEm: link.criadoEm,
      atualizadoEm: link.atualizadoEm
    };
  }

  private mapearSolicitacaoAutenticada(solicitacao: AgendaSolicitacaoOrm): SolicitacaoAgendaAutenticada {
    return {
      id: solicitacao.id,
      profissionalId: solicitacao.profissionalId,
      inicioEm: solicitacao.inicioEm,
      fimEm: solicitacao.fimEm,
      nome: this.criptografia.descriptografar(solicitacao.nomeCriptografado),
      contato: this.deserializarContato(solicitacao.contatoCriptografado),
      observacao: solicitacao.observacaoCriptografada
        ? this.criptografia.descriptografar(solicitacao.observacaoCriptografada)
        : undefined,
      status:
        solicitacao.status === 'pendente' && solicitacaoPendenteExpirou(solicitacao.expiraEm, new Date(Date.now()))
          ? 'expirada'
          : solicitacao.status,
      expiraEm: solicitacao.expiraEm,
      decididaEm: solicitacao.decididaEm,
      decididaPorUsuarioId: solicitacao.decididaPorUsuarioId,
      pacienteId: solicitacao.pacienteId,
      consultaId: solicitacao.consultaId,
      criadoEm: solicitacao.criadoEm,
      atualizadoEm: solicitacao.atualizadoEm
    };
  }
}
