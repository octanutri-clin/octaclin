import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, IsNull, LessThan, MoreThan } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { CriarSolicitacaoAgendamentoPublicoDto } from './dtos';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { AgendaLinkPublicoOrm } from '../infraestrutura/agenda-link-publico.orm';
import { AgendaSolicitacaoOrm } from '../infraestrutura/agenda-solicitacao.orm';

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

export interface ResumoAgendaPublica {
  profissionalNome: string;
  timezone: string;
  duracaoMinutos: number;
  horariosLivres: string[];
}

export interface ResultadoSolicitacaoPublica {
  status: 'pendente';
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
    private readonly protecaoAbuso: ServicoProtecaoAbuso
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

  private serializarContato(dados: CriarSolicitacaoAgendamentoPublicoDto): string {
    const whatsapp = textoOpcional(dados.whatsapp);
    const contato = {
      email: dados.email.trim().toLowerCase(),
      ...(whatsapp ? { whatsapp } : {})
    };
    return JSON.stringify(contato);
  }
}
