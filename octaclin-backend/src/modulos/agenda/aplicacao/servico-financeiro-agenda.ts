import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { resolverProfissionalIdDoUsuario } from '../../../infraestrutura/seguranca/escopo-profissional';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import {
  calcularConsumoPacote,
  entraNoFaturamento,
  pacoteVencido,
  somarRecebimentos
} from '../dominio/financeiro-consulta';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { PacoteSessaoOrm } from '../infraestrutura/pacote-sessao.orm';
import {
  ConsultaAgendaRespostaDto,
  ConsultarRecebimentosDto,
  CriarPacoteSessaoDto,
  LinhaRecebimentoProfissionalDto,
  PacoteSessaoRespostaDto,
  RegistrarPagamentoConsultaDto,
  ResumoRecebimentosDto
} from './dtos';
import { ServicoAgenda } from './servico-agenda';

/** Periodo maximo consultavel de uma vez. Fecha o mes, o trimestre e o ano. */
const DIAS_MAXIMOS_PERIODO = 400;

/**
 * Financeiro da consulta: registro de pagamento, visao de recebimentos e pacote
 * de sessoes.
 *
 * **Todo caminho aqui respeita o escopo por profissional.** Valor e forma de
 * pagamento sao dados que nao podem cruzar tenant (garantido pela RLS) nem
 * escopo de profissional (garantido por `resolverProfissionalIdDoUsuario`, que
 * devolve sentinela inexistente para Professional sem cadastro em vez de abrir
 * a clinica inteira).
 */
@Injectable()
export class ServicoFinanceiroAgenda {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly servicoAgenda: ServicoAgenda
  ) {}

  async registrarPagamento(
    tenantId: string,
    consultaId: string,
    dados: RegistrarPagamentoConsultaDto,
    usuario: UsuarioAutenticado
  ): Promise<ConsultaAgendaRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({
        where: {
          id: consultaId,
          tenantId,
          ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {})
        },
        lock: { mode: 'pessimistic_write' }
      });
      if (!consulta) throw new NotFoundException('Consulta nao encontrada.');

      // Criterio de aceite: consulta cancelada nao entra no faturamento. Marcar
      // como paga o que a clinica cancelou e cobranca indevida.
      if (!entraNoFaturamento(consulta.status)) {
        throw new BadRequestException('Consulta cancelada nao recebe pagamento.');
      }
      if (consulta.pacoteId) {
        throw new BadRequestException(
          'Consulta de pacote e paga no pacote, nao na sessao. Registre o pagamento no pacote de sessoes.'
        );
      }

      if (dados.valorCentavos !== undefined) consulta.valorCentavos = dados.valorCentavos;
      if (dados.formaPagamento !== undefined) consulta.formaPagamento = dados.formaPagamento;
      consulta.statusPagamento = dados.statusPagamento;

      if (dados.statusPagamento === 'pago') {
        if (consulta.valorCentavos <= 0) {
          throw new BadRequestException('Informe o valor da consulta antes de marcar como paga.');
        }
        if (!consulta.formaPagamento) {
          throw new BadRequestException('Informe a forma de pagamento antes de marcar como paga.');
        }
        consulta.pagoEm = dados.pagoEm ? this.dataValida(dados.pagoEm) : new Date();
      } else {
        // O `check` do banco exige que pago_em exista **somente** quando pago.
        consulta.pagoEm = undefined;
      }

      consulta.payload = {
        ...(consulta.payload ?? {}),
        historicoFinanceiro: [
          ...(Array.isArray(consulta.payload?.historicoFinanceiro)
            ? (consulta.payload.historicoFinanceiro as unknown[])
            : []),
          {
            statusPagamento: consulta.statusPagamento,
            valorCentavos: consulta.valorCentavos,
            formaPagamento: consulta.formaPagamento,
            registradoPor: usuario.usuarioId,
            registradoEm: new Date().toISOString()
          }
        ].slice(-20)
      };

      return this.servicoAgenda.mapearRespostaPublica(await repositorio.save(consulta));
    });
  }

  /**
   * Fecha o periodo: total recebido, total pendente e quebra por profissional.
   * Pacote entra em linha separada porque o dinheiro dele nao esta na consulta —
   * somar os dois no mesmo numero contaria o atendimento duas vezes.
   */
  async resumoRecebimentos(
    tenantId: string,
    filtro: ConsultarRecebimentosDto,
    usuario: UsuarioAutenticado
  ): Promise<ResumoRecebimentosDto> {
    const inicioEm = this.dataValida(filtro.inicioEm);
    const fimEm = this.dataValida(filtro.fimEm);
    if (fimEm <= inicioEm) throw new BadRequestException('Fim do periodo deve ser posterior ao inicio.');
    if (fimEm.getTime() - inicioEm.getTime() > DIAS_MAXIMOS_PERIODO * 86_400_000) {
      throw new BadRequestException(`Periodo maximo de consulta e de ${DIAS_MAXIMOS_PERIODO} dias.`);
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const profissionalId = profissionalIdEscopo ?? filtro.profissionalId;

      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
        where: {
          tenantId,
          inicioEm: Between(inicioEm, fimEm),
          ...(profissionalId ? { profissionalId } : {}),
          ...(filtro.pacienteId ? { pacienteId: filtro.pacienteId } : {})
        },
        order: { inicioEm: 'ASC' },
        take: 5000
      });

      const totais = somarRecebimentos(
        consultas.map((consulta) => ({
          status: consulta.status,
          statusPagamento: consulta.statusPagamento ?? 'pendente',
          valorCentavos: consulta.valorCentavos ?? 0
        }))
      );

      const pacotes = await gerenciador.getRepository(PacoteSessaoOrm).find({
        where: {
          tenantId,
          criadoEm: Between(inicioEm, fimEm),
          canceladoEm: IsNull(),
          ...(profissionalId ? { profissionalId } : {}),
          ...(filtro.pacienteId ? { pacienteId: filtro.pacienteId } : {})
        },
        take: 2000
      });

      return {
        inicioEm: inicioEm.toISOString(),
        fimEm: fimEm.toISOString(),
        ...totais,
        pacotesRecebidoCentavos: this.somarPacotes(pacotes, 'pago'),
        pacotesPendenteCentavos: this.somarPacotes(pacotes, 'pendente'),
        porProfissional: await this.quebrarPorProfissional(gerenciador, tenantId, consultas)
      };
    });
  }

  async criarPacote(
    tenantId: string,
    dados: CriarPacoteSessaoDto,
    usuario: UsuarioAutenticado
  ): Promise<PacoteSessaoRespostaDto> {
    const statusPagamento = dados.statusPagamento ?? 'pendente';
    const validadeEm = dados.validadeEm ? this.dataValida(dados.validadeEm) : undefined;
    if (validadeEm && pacoteVencido(validadeEm, new Date())) {
      throw new BadRequestException('Validade do pacote nao pode estar no passado.');
    }
    if (statusPagamento === 'pago' && !(dados.valorTotalCentavos ?? 0)) {
      throw new BadRequestException('Pacote marcado como pago precisa de valor total.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
        where: {
          id: dados.pacienteId,
          tenantId,
          arquivadoEm: IsNull(),
          ...(profissionalIdEscopo ? { profissionalResponsavelId: profissionalIdEscopo } : {})
        }
      });
      if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

      const repositorio = gerenciador.getRepository(PacoteSessaoOrm);
      const pacote = await repositorio.save(
        repositorio.create({
          tenantId,
          pacienteId: paciente.id,
          profissionalId: profissionalIdEscopo ?? dados.profissionalId ?? paciente.profissionalResponsavelId,
          titulo: dados.titulo.trim(),
          sessoesContratadas: dados.sessoesContratadas,
          valorTotalCentavos: dados.valorTotalCentavos ?? 0,
          formaPagamento: dados.formaPagamento,
          statusPagamento,
          pagoEm: statusPagamento === 'pago' ? new Date() : undefined,
          validadeEm
        })
      );

      return this.mapearPacote(pacote, [], this.nomeDoPaciente(paciente));
    });
  }

  async listarPacotes(
    tenantId: string,
    usuario: UsuarioAutenticado,
    pacienteId?: string
  ): Promise<PacoteSessaoRespostaDto[]> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const pacotes = await gerenciador.getRepository(PacoteSessaoOrm).find({
        where: {
          tenantId,
          ...(pacienteId ? { pacienteId } : {}),
          ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {})
        },
        order: { criadoEm: 'DESC' },
        take: 200
      });
      if (!pacotes.length) return [];

      const consultas = await gerenciador.getRepository(AgendaConsultaOrm).find({
        where: pacotes.map((pacote) => ({ tenantId, pacoteId: pacote.id })),
        select: { pacoteId: true, status: true },
        take: 5000
      });
      const nomes = await this.nomesDosPacientes(
        gerenciador,
        tenantId,
        pacotes.map((pacote) => pacote.pacienteId)
      );

      return pacotes.map((pacote) =>
        this.mapearPacote(
          pacote,
          consultas.filter((consulta) => consulta.pacoteId === pacote.id).map((consulta) => consulta.status),
          nomes.get(pacote.pacienteId)
        )
      );
    });
  }

  async cancelarPacote(
    tenantId: string,
    pacoteId: string,
    usuario: UsuarioAutenticado
  ): Promise<PacoteSessaoRespostaDto> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionalIdEscopo = await resolverProfissionalIdDoUsuario(gerenciador, tenantId, usuario);
      const repositorio = gerenciador.getRepository(PacoteSessaoOrm);
      const pacote = await repositorio.findOne({
        where: {
          id: pacoteId,
          tenantId,
          ...(profissionalIdEscopo ? { profissionalId: profissionalIdEscopo } : {})
        }
      });
      if (!pacote) throw new NotFoundException('Pacote nao encontrado.');
      if (pacote.canceladoEm) throw new BadRequestException('Pacote ja cancelado.');

      pacote.canceladoEm = new Date();
      return this.mapearPacote(await repositorio.save(pacote), []);
    });
  }

  private somarPacotes(pacotes: PacoteSessaoOrm[], status: 'pago' | 'pendente'): number {
    return pacotes
      .filter((pacote) => (pacote.statusPagamento ?? 'pendente') === status)
      .reduce((total, pacote) => total + (pacote.valorTotalCentavos ?? 0), 0);
  }

  /**
   * Quebra por profissional. O nome sai descriptografado uma vez por
   * profissional, nao uma vez por consulta: a agenda de um mes cheio tem
   * centenas de linhas e dezenas de profissionais.
   */
  private async quebrarPorProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    consultas: AgendaConsultaOrm[]
  ): Promise<LinhaRecebimentoProfissionalDto[]> {
    const porProfissional = new Map<string, AgendaConsultaOrm[]>();
    for (const consulta of consultas) {
      const chave = consulta.profissionalId ?? '';
      porProfissional.set(chave, [...(porProfissional.get(chave) ?? []), consulta]);
    }

    const identificadores = [...porProfissional.keys()].filter(Boolean);
    const profissionais = identificadores.length
      ? await gerenciador.getRepository(ProfissionalOrm).find({
          where: identificadores.map((id) => ({ id, tenantId })),
          select: { id: true, nomeCriptografado: true }
        })
      : [];
    const nomes = new Map(
      profissionais.map((profissional) => [
        profissional.id,
        this.descriptografarOuRotulo(profissional.nomeCriptografado, 'Profissional')
      ])
    );

    return [...porProfissional.entries()]
      .map(([profissionalId, linhas]) => {
        const totais = somarRecebimentos(
          linhas.map((consulta) => ({
            status: consulta.status,
            statusPagamento: consulta.statusPagamento ?? 'pendente',
            valorCentavos: consulta.valorCentavos ?? 0
          }))
        );
        return {
          profissionalId: profissionalId || undefined,
          profissionalNome: profissionalId ? (nomes.get(profissionalId) ?? 'Profissional') : 'Sem profissional',
          consultas: totais.consultas,
          recebidoCentavos: totais.recebidoCentavos,
          pendenteCentavos: totais.pendenteCentavos,
          isentas: totais.isentas
        };
      })
      .filter((linha) => linha.consultas > 0)
      .sort((a, b) => b.recebidoCentavos - a.recebidoCentavos);
  }

  private async nomesDosPacientes(
    gerenciador: EntityManager,
    tenantId: string,
    pacienteIds: string[]
  ): Promise<Map<string, string>> {
    const unicos = [...new Set(pacienteIds)];
    if (!unicos.length) return new Map();
    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      where: unicos.map((id) => ({ id, tenantId })),
      select: { id: true, nomeCriptografado: true }
    });
    return new Map(pacientes.map((paciente) => [paciente.id, this.nomeDoPaciente(paciente)]));
  }

  private nomeDoPaciente(paciente: Pick<PacienteOrm, 'nomeCriptografado'>): string {
    return this.descriptografarOuRotulo(paciente.nomeCriptografado, 'Paciente');
  }

  /** Registro ilegivel nao derruba a lista inteira: aparece rotulado. */
  private descriptografarOuRotulo(valor: Buffer | undefined, rotulo: string): string {
    if (!valor) return rotulo;
    try {
      return this.criptografia.descriptografar(valor);
    } catch {
      return rotulo;
    }
  }

  private mapearPacote(
    pacote: PacoteSessaoOrm,
    statusDasConsultas: string[],
    pacienteNome?: string
  ): PacoteSessaoRespostaDto {
    const consumo = calcularConsumoPacote(pacote.sessoesContratadas, statusDasConsultas);
    const validadeEm = pacote.validadeEm ? new Date(pacote.validadeEm) : undefined;

    return {
      id: pacote.id,
      pacienteId: pacote.pacienteId,
      pacienteNome,
      profissionalId: pacote.profissionalId,
      titulo: pacote.titulo,
      sessoesContratadas: consumo.contratadas,
      sessoesConsumidas: consumo.consumidas,
      sessoesReservadas: consumo.reservadas,
      sessoesDisponiveis: consumo.disponiveis,
      valorTotalCentavos: pacote.valorTotalCentavos ?? 0,
      formaPagamento: pacote.formaPagamento,
      statusPagamento: pacote.statusPagamento ?? 'pendente',
      pagoEm: pacote.pagoEm,
      validadeEm: validadeEm?.toISOString().slice(0, 10),
      vencido: pacoteVencido(validadeEm, new Date()),
      canceladoEm: pacote.canceladoEm,
      criadoEm: pacote.criadoEm
    };
  }

  private dataValida(valor: string): Date {
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) throw new BadRequestException('Data invalida.');
    return data;
  }
}
