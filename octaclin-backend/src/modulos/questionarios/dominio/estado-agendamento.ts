import { BadRequestException, ConflictException } from '@nestjs/common';
import { resolverProximaExecucao } from './proxima-execucao';
export interface AgendamentoParaRetomada {ativo:boolean;pausadoEm?:Date|null;regraCron?:string|null;dataFixa?:Date|null;ultimaExecucaoEm?:Date|null;proximaExecucaoEm?:Date|null;timezone:string}
export type EstadoAgendamento = 'ativo'|'pausado'|'encerrado'|'inativo_legado';
const dataValida=(v:unknown):v is Date=>v instanceof Date && Number.isFinite(v.getTime());
export function estadoAgendamento(a:AgendamentoParaRetomada):EstadoAgendamento {
  if(typeof a.ativo!=='boolean'||(a.pausadoEm!=null&&!dataValida(a.pausadoEm))||(a.ultimaExecucaoEm!=null&&!dataValida(a.ultimaExecucaoEm))||(a.ativo&&a.pausadoEm!=null))throw new ConflictException('Agendamento inconsistente. Atualize a lista.');
  if(a.ativo)return 'ativo';
  if(a.pausadoEm)return 'pausado';
  if(!a.regraCron&&a.ultimaExecucaoEm)return 'encerrado';
  return 'inativo_legado';
}
export function planejarRetomadaAgendamento(a:AgendamentoParaRetomada,agora:Date):Date {
  if(estadoAgendamento(a)!=='pausado')throw new ConflictException('Somente uma pausa explícita pode ser retomada.');
  if(!dataValida(agora)||(a.dataFixa!=null&&!dataValida(a.dataFixa)))throw new BadRequestException('Data de execução inválida.');
  const proxima=resolverProximaExecucao(a.regraCron??undefined,a.dataFixa?.toISOString(),a.timezone,agora);
  if(!dataValida(proxima)||proxima.getTime()<=agora.getTime())throw new BadRequestException('Não há ocorrência futura. Crie um novo agendamento.');
  return proxima;
}

export type AcaoAgendamento = 'pausar' | 'retomar' | 'reconfirmar';
export interface AgendamentoControlado extends AgendamentoParaRetomada {
  revisao: number;
  autorizadoPorUsuarioId?: string | null;
}

/** Plano puro; o chamador autoriza e aplica sob lock/CAS na mesma transação. */
export function planejarComandoAgendamento<T extends AgendamentoControlado>(
  a: T, acao: AcaoAgendamento, revisaoEsperada: number, atorId: string, agora: Date,
): T {
  if (!Number.isSafeInteger(revisaoEsperada) || revisaoEsperada < 1 || revisaoEsperada >= 2147483647 || a.revisao !== revisaoEsperada) {
    throw new ConflictException('Agendamento alterado. Atualize a lista e confirme novamente.');
  }
  if (!dataValida(agora) || !atorId) throw new BadRequestException('Comando inválido.');
  const estado = estadoAgendamento(a);
  const novo = { ...a, revisao: a.revisao + 1 };
  if (acao === 'pausar') {
    if (estado !== 'ativo') throw new ConflictException('Somente agendamentos ativos podem ser pausados.');
    return { ...novo, ativo: false, pausadoEm: agora };
  }
  if (acao === 'retomar') {
    if (!a.autorizadoPorUsuarioId) throw new ConflictException('Reconfirme a autorização antes de retomar.');
    return { ...novo, ativo: true, pausadoEm: null, autorizadoPorUsuarioId: atorId,
      proximaExecucaoEm: planejarRetomadaAgendamento(a, agora) };
  }
  if (acao !== 'reconfirmar') throw new BadRequestException('Ação inválida.');
  novo.autorizadoPorUsuarioId = atorId;
  // Reconfirmar registra autorização atual, nunca a autoria original nem uma retomada.
  if (estado === 'ativo') {
    const proxima = resolverProximaExecucao(a.regraCron ?? undefined, a.dataFixa?.toISOString(), a.timezone, agora);
    if (!dataValida(proxima)) throw new BadRequestException('Data de execução inválida.');
    novo.proximaExecucaoEm = proxima.getTime() > agora.getTime() ? proxima : null;
    novo.ativo = novo.proximaExecucaoEm !== null;
  }
  return novo;
}
