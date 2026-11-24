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
