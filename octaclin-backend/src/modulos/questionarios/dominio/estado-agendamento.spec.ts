import { estadoAgendamento,planejarRetomadaAgendamento,AgendamentoParaRetomada } from './estado-agendamento';
const agora=new Date('2026-11-23T12:00:00Z');
const base:AgendamentoParaRetomada={ativo:false,pausadoEm:new Date('2026-11-01T12:00Z'),regraCron:'0 8 * * *',timezone:'America/Sao_Paulo',proximaExecucaoEm:new Date('2026-11-02T11:00Z')};
describe('QST10-09 estados factuais e próxima ocorrência futura',()=>{
 it('diferencia ativo, pausado, legado e envio único encerrado sem inventar execução',()=>{
  expect(estadoAgendamento({...base,ativo:true,pausadoEm:null})).toBe('ativo');
  expect(estadoAgendamento(base)).toBe('pausado');
  expect(estadoAgendamento({...base,pausadoEm:null,ultimaExecucaoEm:agora})).toBe('inativo_legado');
  expect(estadoAgendamento({...base,regraCron:null,pausadoEm:null,ultimaExecucaoEm:agora})).toBe('encerrado');
  expect(estadoAgendamento({...base,regraCron:null,pausadoEm:null,dataFixa:new Date('2026-11-01T00:00Z')})).toBe('inativo_legado');
 });
 it('falha fechado para marcadores contraditórios ou inválidos',()=>{
  expect(()=>estadoAgendamento({...base,ativo:true})).toThrow();
  expect(()=>estadoAgendamento({...base,pausadoEm:new Date('inválida')})).toThrow();
 });
 it('retoma recorrência só após agora sem recuperar ocorrências perdidas',()=>{
  expect(planejarRetomadaAgendamento(base,agora).toISOString()).toBe('2026-11-24T11:00:00.000Z');
  expect(base.proximaExecucaoEm?.toISOString()).toBe('2026-11-02T11:00:00.000Z');
  expect(base.pausadoEm?.toISOString()).toBe('2026-11-01T12:00:00.000Z');
 });
 it('preserva data única futura e não cria catch-up para data passada',()=>{
  const futuro=new Date('2026-12-01T12:00Z');
  expect(planejarRetomadaAgendamento({...base,regraCron:null,dataFixa:futuro},agora)).toEqual(futuro);
  expect(()=>planejarRetomadaAgendamento({...base,regraCron:null,dataFixa:agora},agora)).toThrow();
  expect(()=>planejarRetomadaAgendamento({...base,regraCron:null,dataFixa:new Date('2026-11-01T12:00Z')},agora)).toThrow();
 });
 it('não transforma inativo legado ou encerrado em pausa explícita',()=>{
  expect(()=>planejarRetomadaAgendamento({...base,pausadoEm:null},agora)).toThrow();
  expect(()=>planejarRetomadaAgendamento({...base,ativo:true,pausadoEm:null},agora)).toThrow();
 });
 it.each([{regraCron:'inválida'},{timezone:'fuso-inválido'},{regraCron:null,dataFixa:null}])('rejeita parâmetros sem próxima ocorrência válida %j',dados=>{
  expect(()=>planejarRetomadaAgendamento({...base,...dados},agora)).toThrow();
 });
 it('rejeita relógio inválido',()=>expect(()=>planejarRetomadaAgendamento(base,new Date('inválida'))).toThrow());
});
