import { BadRequestException } from '@nestjs/common';
import { dentroHorarioPermitido, HorarioPermitidoComunicacao } from '../../comunicacoes/dominio/preferencias-comunicacao';

export type UnidadeFollowup = 'mes' | 'quinzena' | 'semana' | 'dia' | 'hora' | 'minuto';
export type CondicaoFollowup = 'sempre' | 'somente_se_nao_confirmada';
export interface EtapaFollowup {
  unidade: UnidadeFollowup;
  valor: number;
  condicao: CondicaoFollowup;
  /** HH:mm no fuso da consulta; apenas unidades de calendario. */
  horarioLocal?: string;
}

export const PADRAO_FOLLOWUPS: EtapaFollowup[] = [{ unidade: 'hora', valor: 24, condicao: 'sempre' }];
export const MAX_FOLLOWUPS_CONSULTA = 30;
const UNIDADES: UnidadeFollowup[] = ['mes', 'quinzena', 'semana', 'dia', 'hora', 'minuto'];

export function validarEtapas(etapas: EtapaFollowup[]): EtapaFollowup[] {
  if (!Array.isArray(etapas) || etapas.length > MAX_FOLLOWUPS_CONSULTA) {
    throw new BadRequestException('O calendario aceita no maximo 30 etapas.');
  }
  return etapas.map((etapa) => {
    if (!etapa || !UNIDADES.includes(etapa.unidade) || !Number.isSafeInteger(etapa.valor) || etapa.valor < 1 || etapa.valor > 365) {
      throw new BadRequestException('Antecedencia de follow-up invalida.');
    }
    if (etapa.condicao !== 'sempre' && etapa.condicao !== 'somente_se_nao_confirmada') {
      throw new BadRequestException('Condicao de follow-up invalida.');
    }
    if (etapa.horarioLocal && (!['mes', 'quinzena', 'semana', 'dia'].includes(etapa.unidade) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(etapa.horarioLocal))) {
      throw new BadRequestException('Horario local de follow-up invalido.');
    }
    return { unidade: etapa.unidade, valor: etapa.valor, condicao: etapa.condicao, ...(etapa.horarioLocal ? { horarioLocal: etapa.horarioLocal } : {}) };
  });
}

export function gerarCadencia(frequencia: 'mensal' | 'quinzenal' | 'semanal' | 'diaria', quantidade: number, primeiraAntecedencia: number, condicao: CondicaoFollowup = 'sempre'): EtapaFollowup[] {
  if (!Number.isSafeInteger(quantidade) || quantidade < 0 || quantidade > MAX_FOLLOWUPS_CONSULTA || !Number.isSafeInteger(primeiraAntecedencia) || primeiraAntecedencia < quantidade) {
    throw new BadRequestException('Cadencia de follow-up invalida.');
  }
  const unidade = { mensal: 'mes', quinzenal: 'quinzena', semanal: 'semana', diaria: 'dia' }[frequencia] as UnidadeFollowup | undefined;
  if (!unidade) throw new BadRequestException('Frequencia de follow-up invalida.');
  return validarEtapas(Array.from({ length: quantidade }, (_, indice) => ({ unidade, valor: primeiraAntecedencia - indice, condicao })));
}

function partes(data: Date, timezone: string) {
  let formatador: Intl.DateTimeFormat;
  try {
    formatador = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {
    throw new BadRequestException('Fuso horario da consulta invalido.');
  }
  const valores = Object.fromEntries(formatador.formatToParts(data).map((parte) => [parte.type, parte.value]));
  return { ano: Number(valores.year), mes: Number(valores.month), dia: Number(valores.day), hora: Number(valores.hour), minuto: Number(valores.minute) };
}

function instanteLocal(ano: number, mes: number, dia: number, hora: number, minuto: number, timezone: string): Date {
  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
  // Amostra os offsets nos dois lados da transicao; na dobra escolhe a
  // primeira ocorrencia e na lacuna avanca ao primeiro minuto valido.
  const offsets = new Set<number>();
  for (const horas of [-36, -12, 0, 12, 36]) {
    const amostra = new Date(alvo + horas * 3600000);
    const p = partes(amostra, timezone);
    offsets.add(Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - amostra.getTime());
  }
  for (let avanco = 0; avanco <= 180; avanco += 1) {
    const localAlvo = alvo + avanco * 60000;
    const validos = [...offsets].map((offset) => new Date(localAlvo - offset)).filter((candidato) => {
      const p = partes(candidato, timezone);
      return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) === localAlvo;
    });
    if (validos.length) return new Date(Math.min(...validos.map((data) => data.getTime())));
  }
  throw new BadRequestException('Horario local de follow-up indisponivel.');
}

export function calcularEtapas(inicio: Date, timezone: string, etapas: EtapaFollowup[], exigirIntervalo = true): Array<{ indice: number; etapa: EtapaFollowup; envioEm: Date }> {
  if (!(inicio instanceof Date) || !Number.isFinite(inicio.getTime())) throw new BadRequestException('Inicio da consulta invalido.');
  const normalizadas = validarEtapas(etapas);
  const p = partes(inicio, timezone);
  const resultado = normalizadas.map((etapa, indice) => {
    let envioEm: Date;
    if (etapa.unidade === 'hora' || etapa.unidade === 'minuto') {
      envioEm = new Date(inicio.getTime() - etapa.valor * (etapa.unidade === 'hora' ? 3600000 : 60000));
    } else {
      const dias = etapa.valor * ({ dia: 1, semana: 7, quinzena: 14 } as Partial<Record<UnidadeFollowup, number>>)[etapa.unidade]!;
      let local: Date;
      if (etapa.unidade === 'mes') {
        const primeiro = new Date(Date.UTC(p.ano, p.mes - 1 - etapa.valor, 1));
        const ultimoDia = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate();
        local = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth(), Math.min(p.dia, ultimoDia)));
      } else {
        local = new Date(Date.UTC(p.ano, p.mes - 1, p.dia - dias));
      }
      const [hora, minuto] = etapa.horarioLocal ? etapa.horarioLocal.split(':').map(Number) : [p.hora, p.minuto];
      envioEm = instanteLocal(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), hora, minuto, timezone);
    }
    if (envioEm >= inicio) throw new BadRequestException('Follow-up precisa ocorrer antes da consulta.');
    return { indice, etapa, envioEm };
  }).sort((a, b) => a.envioEm.getTime() - b.envioEm.getTime());
  for (let indice = 1; exigirIntervalo && indice < resultado.length; indice += 1) {
    if (resultado[indice].envioEm.getTime() - resultado[indice - 1].envioEm.getTime() < 30 * 60000) {
      throw new BadRequestException('Mantenha ao menos 30 minutos entre follow-ups.');
    }
  }
  return resultado;
}

/** Em uma dobra de DST, preserva os avisos mais proximos da consulta. */
export function selecionarSemColisao<T extends { envioEm: Date }>(etapas: T[]): T[] {
  const escolhidas: T[] = [];
  for (const etapa of [...etapas].sort((a, b) => b.envioEm.getTime() - a.envioEm.getTime())) {
    if (escolhidas.every((item) => Math.abs(item.envioEm.getTime() - etapa.envioEm.getTime()) >= 30 * 60000)) escolhidas.push(etapa);
  }
  return escolhidas.sort((a, b) => a.envioEm.getTime() - b.envioEm.getTime());
}

/** Proximo minuto permitido, sempre antes da consulta; fora dele a etapa e suprimida. */
export function proximaJanelaPermitida(agora: Date, inicio: Date, horario: HorarioPermitidoComunicacao): Date | undefined {
  let instante = new Date(Math.ceil(agora.getTime() / 60000) * 60000);
  while (instante < inicio && instante.getTime() - agora.getTime() <= 48 * 3600000) {
    if (dentroHorarioPermitido(instante, horario)) return instante;
    instante = new Date(instante.getTime() + 60000);
  }
  return undefined;
}
