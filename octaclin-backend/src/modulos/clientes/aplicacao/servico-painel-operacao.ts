import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { medianaIntervalosConsultaDias } from '../../pacientes/dominio/mediana-intervalo-consultas';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';

interface LinhaConsulta {
  profissional_id: string | null;
  status: string;
  inicio_em: Date;
  fim_em: Date;
}

interface LinhaExpediente {
  profissional_id: string;
  inicio_em: Date;
  fim_em: Date;
}

export interface PainelOperacaoCliente {
  mes: string;
  timezone: string;
  pacientes: { novos: number; ativos: number; emRisco: number };
  retorno: {
    pacientesElegiveis: number;
    pacientesSemProximaConsulta: number;
    percentualSemProximaConsulta: number | null;
    pacientesComHistorico: number;
    intervaloMedianoDias: number | null;
  };
  faltasPorHorario: {
    desfechos: number;
    faltas: number;
    taxaFalta: number | null;
    faixas: { inicioHora: number; fimHora: number; desfechos: number; faltas: number; taxaFalta: number }[];
    possuiFaixasSuprimidas: boolean;
  };
  respostaFormularios: { respostasValidas: number; medianaSegundos: number | null };
  consultasSemProfissional: number;
  profissionais: {
    id: string;
    nome: string;
    pacientesResponsaveis: number;
    consultas: number;
    concluidas: number;
    faltas: number;
    canceladas: number;
    taxaConclusao: number | null;
    taxaNoShow: number | null;
    arquivado: boolean;
    minutosDisponiveis: number | null;
    minutosOcupados: number | null;
    ocupacaoPercentual: number | null;
    consultasForaExpediente: number | null;
  }[];
}

const SQL_PACIENTES = `/* pb26-pacientes */ select
  count(*) filter (where paciente.criado_em >= ($2::date::timestamp at time zone $4)
    and paciente.criado_em < ($3::date::timestamp at time zone $4)) as novos,
  count(*) as ativos,
  count(*) filter (where (
    (prioridade.override_faixa = 'alta' and prioridade.override_expira_em > now())
    or (prioridade.faixa = 'alta'
      and (prioridade.override_expira_em is null or prioridade.override_expira_em <= now())
      and exists (
        select 1 from prioridades_acompanhamento_historico historico
        where historico.tenant_id = paciente.tenant_id
          and historico.paciente_id = paciente.id
          and historico.tipo_evento = 'calculo'
      ))
  )) as em_risco
from pacientes paciente
left join prioridades_acompanhamento_paciente prioridade
  on prioridade.tenant_id = paciente.tenant_id and prioridade.paciente_id = paciente.id
where paciente.tenant_id = $1 and paciente.arquivado_em is null and paciente.deleted_at is null
  and paciente.status_ciclo_vida = 'ACTIVE'`;

const SQL_PERIODO = `/* fase301-periodo */ select
  ($1::date::timestamp at time zone $3) as inicio_em,
  ($2::date::timestamp at time zone $3) as fim_em`;

const SQL_CONSULTAS = `/* pb26-consultas */ select profissional_id, status, inicio_em, fim_em
from agenda_consultas
where tenant_id = $1 and fim_em > ($2::date::timestamp at time zone $4)
  and inicio_em < ($3::date::timestamp at time zone $4)`;

const SQL_EXPEDIENTES = `/* pb26-expedientes */ select e.profissional_id,
  ((dias.dia::date + e.hora_inicio) at time zone $4) as inicio_em,
  ((dias.dia::date + e.hora_fim) at time zone $4) as fim_em
from expedientes_profissionais e
cross join generate_series($2::date, $3::date - interval '1 day', interval '1 day') as dias(dia)
where e.tenant_id = $1 and extract(dow from dias.dia) = e.dia_semana`;

const SQL_CARGA = `/* pb26-carga */ select profissional_responsavel_id, count(*) as total
from pacientes where tenant_id = $1 and arquivado_em is null and deleted_at is null
  and status_ciclo_vida = 'ACTIVE' group by profissional_responsavel_id`;

const SQL_INTERVALO_RETORNO = `/* fase306-intervalo-retorno */
with pacientes_coorte as (
  select distinct consulta.paciente_id
  from agenda_consultas consulta
  join pacientes paciente on paciente.tenant_id = consulta.tenant_id and paciente.id = consulta.paciente_id
  where consulta.tenant_id = $1 and consulta.status = 'concluida'
    and consulta.inicio_em >= ($2::date::timestamp at time zone $4)
    and consulta.inicio_em < ($3::date::timestamp at time zone $4)
    and paciente.status_ciclo_vida = 'ACTIVE' and paciente.arquivado_em is null
    and paciente.deleted_at is null and paciente.profissional_responsavel_id is not null
), historico as (
  select coorte.paciente_id, consultas.fim_em,
    row_number() over (partition by coorte.paciente_id order by consultas.fim_em desc) as posicao
  from pacientes_coorte coorte
  join lateral (
    select consulta.fim_em from agenda_consultas consulta
    where consulta.tenant_id = $1 and consulta.paciente_id = coorte.paciente_id
      and consulta.status = 'concluida'
      and consulta.fim_em < ($3::date::timestamp at time zone $4)
    order by consulta.fim_em desc limit 4
  ) consultas on true
)
select paciente_id, fim_em from historico order by paciente_id, posicao`;

const SQL_SEM_PROXIMA_CONSULTA = `/* fase306-sem-proxima-consulta */
with pacientes_elegiveis as (
  select paciente.id,
    exists (
      select 1 from agenda_consultas futura
      where futura.tenant_id = paciente.tenant_id and futura.paciente_id = paciente.id
        and futura.status in ('agendada', 'reagendada') and futura.inicio_em >= now()
    ) as possui_proxima
  from pacientes paciente
  where paciente.tenant_id = $1 and paciente.status_ciclo_vida = 'ACTIVE'
    and paciente.arquivado_em is null and paciente.deleted_at is null
    and paciente.profissional_responsavel_id is not null
    and exists (
      select 1 from agenda_consultas anterior
      where anterior.tenant_id = paciente.tenant_id and anterior.paciente_id = paciente.id
        and anterior.status = 'concluida'
        and anterior.inicio_em >= now() - interval '90 days' and anterior.inicio_em <= now()
    )
)
select count(*)::int as pacientes_elegiveis,
  count(*) filter (where not possui_proxima)::int as sem_proxima_consulta
from pacientes_elegiveis`;

const SQL_FALTAS_HORARIO = `/* fase306-faltas-horario */
select (floor(extract(hour from (consulta.inicio_em at time zone $4)) / 2) * 2)::int as hora_inicio,
  count(*)::int as desfechos,
  count(*) filter (where consulta.status = 'falta')::int as faltas
from agenda_consultas consulta
where consulta.tenant_id = $1 and consulta.inicio_em >= ($2::date::timestamp at time zone $4)
  and consulta.inicio_em < ($3::date::timestamp at time zone $4)
  and consulta.status in ('concluida', 'falta')
group by hora_inicio order by hora_inicio`;

const SQL_RESPOSTA_FORMULARIOS = `/* fase306-resposta-formulario */
select count(*)::int as respostas_validas,
  percentile_cont(0.5) within group (order by extract(epoch from (envio.respondido_em - envio.enviado_em))) as mediana_segundos
from envios_questionario envio
where envio.tenant_id = $1 and envio.status = 'respondido'
  and envio.enviado_em >= ($2::date::timestamp at time zone $4)
  and envio.enviado_em < ($3::date::timestamp at time zone $4)
  and envio.respondido_em >= envio.enviado_em`;

function mesAtual(timezone: string): string {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${partes.find((parte) => parte.type === 'year')?.value}-${partes.find((parte) => parte.type === 'month')?.value}`;
}

function timezoneSeguro(valor: unknown): string {
  if (typeof valor !== 'string') return 'America/Sao_Paulo';
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: valor });
    return valor;
  } catch {
    return 'America/Sao_Paulo';
  }
}

type Intervalo = [number, number];

function unirIntervalos(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos.filter(([inicio, fim]) => Number.isFinite(inicio) && Number.isFinite(fim) && fim > inicio)
    .sort((a, b) => a[0] - b[0]);
  const unidos: Intervalo[] = [];
  for (const [inicio, fim] of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim);
    else unidos.push([inicio, fim]);
  }
  return unidos;
}

function limitarIntervalo(inicio: Date, fim: Date, periodo: Intervalo): Intervalo {
  return [Math.max(new Date(inicio).getTime(), periodo[0]), Math.min(new Date(fim).getTime(), periodo[1])];
}

function duracao(intervalos: Intervalo[]): number {
  return intervalos.reduce((total, [inicio, fim]) => total + fim - inicio, 0);
}

function medianaValores(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return Math.round(ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2);
}

function intersecoes(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const resultado: Intervalo[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const inicio = Math.max(a[i][0], b[j][0]);
    const fim = Math.min(a[i][1], b[j][1]);
    if (fim > inicio) resultado.push([inicio, fim]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return resultado;
}

@Injectable()
export class ServicoPainelOperacao {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obter(tenantId: string, mesSolicitado?: string | string[]): Promise<PainelOperacaoCliente> {
    if (mesSolicitado !== undefined && (
      typeof mesSolicitado !== 'string'
      || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesSolicitado)
      || Number(mesSolicitado.slice(0, 4)) < 2000
      || Number(mesSolicitado.slice(0, 4)) > 2100
    )) {
      throw new BadRequestException('Informe o mes no formato AAAA-MM.');
    }

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const configuracao = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
        where: { tenantId, chave: 'conta_cliente' }
      });
      const timezone = timezoneSeguro(configuracao?.valor?.timezone);
      const mes = mesSolicitado ?? mesAtual(timezone);
      const [ano, numeroMes] = mes.split('-').map(Number);
      const inicio = `${mes}-01`;
      const fim = new Date(Date.UTC(ano, numeroMes, 1)).toISOString().slice(0, 10);
      const parametros = [tenantId, inicio, fim, timezone];
      const [pacientes, consultas, expedientes, carga, profissionais, periodos, intervalos, semProximaConsulta, faltasHorario, respostasFormulario] = await Promise.all([
        gerenciador.query(SQL_PACIENTES, parametros) as Promise<{ novos: string; ativos: string; em_risco: string }[]>,
        gerenciador.query(SQL_CONSULTAS, parametros) as Promise<LinhaConsulta[]>,
        gerenciador.query(SQL_EXPEDIENTES, parametros) as Promise<LinhaExpediente[]>,
        gerenciador.query(SQL_CARGA, [tenantId]) as Promise<{ profissional_responsavel_id: string; total: string }[]>,
        gerenciador.getRepository(ProfissionalOrm).find({
          select: { id: true, nomeCriptografado: true, arquivadoEm: true },
          where: { tenantId },
          order: { criadoEm: 'ASC' }
        }),
        gerenciador.query(SQL_PERIODO, [inicio, fim, timezone]) as Promise<{ inicio_em: Date; fim_em: Date }[]>,
        gerenciador.query(SQL_INTERVALO_RETORNO, parametros) as Promise<{ paciente_id: string; fim_em: Date | string }[]>,
        gerenciador.query(SQL_SEM_PROXIMA_CONSULTA, [tenantId]) as Promise<{ pacientes_elegiveis: string | number; sem_proxima_consulta: string | number }[]>,
        gerenciador.query(SQL_FALTAS_HORARIO, parametros) as Promise<{ hora_inicio: string | number; desfechos: string | number; faltas: string | number }[]>,
        gerenciador.query(SQL_RESPOSTA_FORMULARIOS, [tenantId, inicio, fim, timezone]) as Promise<{ respostas_validas: string | number; mediana_segundos: string | number | null }[]>
      ]);
      const pacientesElegiveis = Number(semProximaConsulta[0]?.pacientes_elegiveis ?? 0);
      const pacientesSemProximaConsulta = Number(semProximaConsulta[0]?.sem_proxima_consulta ?? 0);
      const desfechosHorario = faltasHorario.reduce((total, faixa) => total + Number(faixa.desfechos), 0);
      const faltasNoPeriodo = faltasHorario.reduce((total, faixa) => total + Number(faixa.faltas), 0);
      const periodo: Intervalo = [new Date(periodos[0].inicio_em).getTime(), new Date(periodos[0].fim_em).getTime()];
      const intervalosPorPaciente = new Map<string, Date[]>();
      for (const consulta of intervalos) {
        intervalosPorPaciente.set(consulta.paciente_id, [
          ...(intervalosPorPaciente.get(consulta.paciente_id) ?? []),
          new Date(consulta.fim_em)
        ]);
      }
      const medianasIndividuais = [...intervalosPorPaciente.values()]
        .map((historico) => medianaIntervalosConsultaDias(historico, timezone))
        .filter((mediana): mediana is number => mediana !== null);
      const iniciouNoMes = (consulta: LinhaConsulta) => {
        const inicioConsulta = new Date(consulta.inicio_em).getTime();
        return inicioConsulta >= periodo[0] && inicioConsulta < periodo[1];
      };
      const cargaPorProfissional = new Map(carga.map((linha) => [linha.profissional_responsavel_id, Number(linha.total)]));
      const consultasPorProfissional = new Map<string, LinhaConsulta[]>();
      for (const consulta of consultas) {
        if (!consulta.profissional_id) continue;
        const grupo = consultasPorProfissional.get(consulta.profissional_id) ?? [];
        grupo.push(consulta);
        consultasPorProfissional.set(consulta.profissional_id, grupo);
      }
      const expedientesPorProfissional = new Map<string, LinhaExpediente[]>();
      for (const faixa of expedientes) {
        const grupo = expedientesPorProfissional.get(faixa.profissional_id) ?? [];
        grupo.push(faixa);
        expedientesPorProfissional.set(faixa.profissional_id, grupo);
      }
      const dadosProfissionais = profissionais.filter((profissional) => {
        if (!profissional.arquivadoEm) return true;
        const atendimentos = consultasPorProfissional.get(profissional.id) ?? [];
        return (cargaPorProfissional.get(profissional.id) ?? 0) > 0
          || atendimentos.some((consulta) => iniciouNoMes(consulta) || consulta.status !== 'cancelada');
      }).map((profissional) => {
        const atendimentos = consultasPorProfissional.get(profissional.id) ?? [];
        const faixas = expedientesPorProfissional.get(profissional.id) ?? [];
        const validas = atendimentos.filter((consulta) => consulta.status !== 'cancelada');
        const iniciadas = atendimentos.filter(iniciouNoMes);
        const concluidas = iniciadas.filter((consulta) => consulta.status === 'concluida').length;
        const faltas = iniciadas.filter((consulta) => consulta.status === 'falta').length;
        const canceladas = iniciadas.filter((consulta) => consulta.status === 'cancelada').length;
        const expediente = unirIntervalos(faixas.map((faixa) => limitarIntervalo(faixa.inicio_em, faixa.fim_em, periodo)));
        const ocupadas = unirIntervalos(validas.map((consulta) => limitarIntervalo(consulta.inicio_em, consulta.fim_em, periodo)));
        const minutosDisponiveis = expediente.length ? Math.round(duracao(expediente) / 60_000) : null;
        const minutosOcupados = minutosDisponiveis === null ? null : Math.round(duracao(intersecoes(ocupadas, expediente)) / 60_000);
        const consultasForaExpediente = minutosDisponiveis === null ? null : validas.filter(iniciouNoMes).filter((consulta) => {
          const intervalo = unirIntervalos([limitarIntervalo(consulta.inicio_em, consulta.fim_em, periodo)]);
          return intervalo.length > 0 && duracao(intersecoes(intervalo, expediente)) < duracao(intervalo);
        }).length;
        return {
          id: profissional.id,
          nome: this.criptografia.descriptografar(profissional.nomeCriptografado),
          arquivado: Boolean(profissional.arquivadoEm),
          pacientesResponsaveis: cargaPorProfissional.get(profissional.id) ?? 0,
          consultas: iniciadas.length - canceladas,
          concluidas,
          faltas,
          canceladas,
          taxaConclusao: concluidas + faltas ? Math.round((concluidas / (concluidas + faltas)) * 100) : null,
          taxaNoShow: concluidas + faltas ? Math.round((faltas / (concluidas + faltas)) * 100) : null,
          minutosDisponiveis,
          minutosOcupados,
          ocupacaoPercentual: minutosDisponiveis ? Math.round(((minutosOcupados ?? 0) / minutosDisponiveis) * 100) : null,
          consultasForaExpediente
        };
      });
      return {
        mes,
        timezone,
        pacientes: {
          novos: Number(pacientes[0]?.novos ?? 0),
          ativos: Number(pacientes[0]?.ativos ?? 0),
          emRisco: Number(pacientes[0]?.em_risco ?? 0)
        },
        retorno: {
          pacientesElegiveis,
          pacientesSemProximaConsulta,
          percentualSemProximaConsulta: pacientesElegiveis
            ? Math.round((pacientesSemProximaConsulta / pacientesElegiveis) * 100)
            : null,
          pacientesComHistorico: medianasIndividuais.length,
          intervaloMedianoDias: medianaValores(medianasIndividuais)
        },
        faltasPorHorario: {
          desfechos: desfechosHorario,
          faltas: faltasNoPeriodo,
          taxaFalta: desfechosHorario ? Math.round((faltasNoPeriodo / desfechosHorario) * 100) : null,
          faixas: faltasHorario.filter((faixa) => Number(faixa.desfechos) >= 5).map((faixa) => {
            const inicioHora = Number(faixa.hora_inicio);
            const desfechos = Number(faixa.desfechos);
            const faltas = Number(faixa.faltas);
            return { inicioHora, fimHora: inicioHora + 2, desfechos, faltas, taxaFalta: Math.round((faltas / desfechos) * 100) };
          }),
          possuiFaixasSuprimidas: faltasHorario.some((faixa) => Number(faixa.desfechos) < 5)
        },
        respostaFormularios: {
          respostasValidas: Number(respostasFormulario[0]?.respostas_validas ?? 0),
          medianaSegundos: respostasFormulario[0]?.mediana_segundos == null
            ? null
            : Math.round(Number(respostasFormulario[0].mediana_segundos))
        },
        consultasSemProfissional: consultas.filter((consulta) => iniciouNoMes(consulta) && !consulta.profissional_id && consulta.status !== 'cancelada').length,
        profissionais: dadosProfissionais
      };
    });
  }
}
