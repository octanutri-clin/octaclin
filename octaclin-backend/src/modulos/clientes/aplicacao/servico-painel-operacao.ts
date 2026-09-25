import { BadRequestException, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
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
  consultasSemProfissional: number;
  profissionais: {
    id: string;
    nome: string;
    pacientesResponsaveis: number;
    consultas: number;
    concluidas: number;
    faltas: number;
    taxaNoShow: number | null;
    minutosDisponiveis: number | null;
    minutosOcupados: number | null;
    ocupacaoPercentual: number | null;
    consultasForaExpediente: number | null;
  }[];
}

const SQL_PACIENTES = `/* pb26-pacientes */ select
  count(*) filter (where criado_em >= ($2::date::timestamp at time zone $4)
    and criado_em < ($3::date::timestamp at time zone $4)) as novos,
  count(*) as ativos,
  count(*) filter (where status_adesao = 'risco' or score_risco >= 70) as em_risco
from pacientes
where tenant_id = $1 and arquivado_em is null and deleted_at is null and status_ciclo_vida = 'ACTIVE'`;

const SQL_CONSULTAS = `/* pb26-consultas */ select profissional_id, status, inicio_em, fim_em
from agenda_consultas
where tenant_id = $1 and inicio_em >= ($2::date::timestamp at time zone $4)
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

function minutosSobrepostos(inicioA: Date, fimA: Date, inicioB: Date, fimB: Date): number {
  return Math.max(0, Math.min(fimA.getTime(), fimB.getTime()) - Math.max(inicioA.getTime(), inicioB.getTime())) / 60_000;
}

@Injectable()
export class ServicoPainelOperacao {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async obter(tenantId: string, mesSolicitado?: string): Promise<PainelOperacaoCliente> {
    if (mesSolicitado && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesSolicitado)
      || Number(mesSolicitado.slice(0, 4)) < 2000 || Number(mesSolicitado.slice(0, 4)) > 2100)) {
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
      const [pacientes, consultas, expedientes, carga, profissionais] = await Promise.all([
        gerenciador.query(SQL_PACIENTES, parametros) as Promise<{ novos: string; ativos: string; em_risco: string }[]>,
        gerenciador.query(SQL_CONSULTAS, parametros) as Promise<LinhaConsulta[]>,
        gerenciador.query(SQL_EXPEDIENTES, parametros) as Promise<LinhaExpediente[]>,
        gerenciador.query(SQL_CARGA, [tenantId]) as Promise<{ profissional_responsavel_id: string; total: string }[]>,
        gerenciador.getRepository(ProfissionalOrm).find({ where: { tenantId, arquivadoEm: IsNull() }, order: { criadoEm: 'ASC' } })
      ]);
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
      const dadosProfissionais = profissionais.map((profissional) => {
        const atendimentos = consultasPorProfissional.get(profissional.id) ?? [];
        const faixas = expedientesPorProfissional.get(profissional.id) ?? [];
        const validas = atendimentos.filter((consulta) => consulta.status !== 'cancelada');
        const concluidas = atendimentos.filter((consulta) => consulta.status === 'concluida').length;
        const faltas = atendimentos.filter((consulta) => consulta.status === 'falta').length;
        const minutosDisponiveis = faixas.length
          ? Math.round(faixas.reduce((soma, faixa) => soma + (new Date(faixa.fim_em).getTime() - new Date(faixa.inicio_em).getTime()) / 60_000, 0))
          : null;
        const minutosDentro = (consulta: LinhaConsulta) => faixas.reduce(
          (soma, faixa) => soma + minutosSobrepostos(new Date(consulta.inicio_em), new Date(consulta.fim_em), new Date(faixa.inicio_em), new Date(faixa.fim_em)), 0
        );
        const minutosOcupados = minutosDisponiveis === null ? null : Math.round(validas.reduce((soma, consulta) => soma + minutosDentro(consulta), 0));
        const consultasForaExpediente = minutosDisponiveis === null ? null : validas.filter((consulta) =>
          minutosDentro(consulta) < (new Date(consulta.fim_em).getTime() - new Date(consulta.inicio_em).getTime()) / 60_000
        ).length;
        return {
          id: profissional.id,
          nome: this.criptografia.descriptografar(profissional.nomeCriptografado),
          pacientesResponsaveis: cargaPorProfissional.get(profissional.id) ?? 0,
          consultas: validas.length,
          concluidas,
          faltas,
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
        consultasSemProfissional: consultas.filter((consulta) => !consulta.profissional_id && consulta.status !== 'cancelada').length,
        profissionais: dadosProfissionais
      };
    });
  }
}
