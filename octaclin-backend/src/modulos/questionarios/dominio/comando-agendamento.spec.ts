import { planejarComandoAgendamento } from './estado-agendamento';

const agora = new Date('2026-11-24T12:00:00Z');
const base = { ativo:true, revisao:1, autorizadoPorUsuarioId:null, timezone:'America/Sao_Paulo', regraCron:'0 8 * * *' };
describe('comandos de recorrência', () => {
  it('pausa somente futuras gerações, sem exigir autoria legada', () => {
    expect(planejarComandoAgendamento(base,'pausar',1,'ator',agora)).toMatchObject({ativo:false,pausadoEm:agora,revisao:2,autorizadoPorUsuarioId:null});
    expect(base.ativo).toBe(true);
  });
  it('reconfirmar não desfaz pausa nem reabre execução única encerrada', () => {
    const pausado = {...base,ativo:false,pausadoEm:agora};
    expect(planejarComandoAgendamento(pausado,'reconfirmar',1,'ator',agora)).toMatchObject({ativo:false,pausadoEm:agora,autorizadoPorUsuarioId:'ator'});
    const unico = {...base,ativo:false,regraCron:undefined,ultimaExecucaoEm:agora};
    expect(planejarComandoAgendamento(unico,'reconfirmar',1,'ator',agora)).toMatchObject({ativo:false,ultimaExecucaoEm:agora});
  });
  it('reconfirmação ativa cron descarta ocorrências perdidas e fixa somente futuro', () => {
    expect(planejarComandoAgendamento({...base,proximaExecucaoEm:new Date('2020-01-01')},'reconfirmar',1,'ator',agora).proximaExecucaoEm).toEqual(new Date('2026-11-25T11:00:00Z'));
  });
  it('reconfirmação não gera envio único vencido', () => {
    expect(planejarComandoAgendamento({...base,regraCron:undefined,dataFixa:new Date('2020-01-01')},'reconfirmar',1,'ator',agora)).toMatchObject({ativo:false,proximaExecucaoEm:null});
  });
  it('retomada exige reconfirmação separada para legado, e apenas pausa explícita', () => {
    expect(()=>planejarComandoAgendamento({...base,ativo:false,pausadoEm:agora},'retomar',1,'ator',agora)).toThrow('Reconfirme');
    expect(()=>planejarComandoAgendamento({...base,autorizadoPorUsuarioId:'ator'},'retomar',1,'ator',agora)).toThrow('pausa');
  });
  it('retomada confirmada não executa catch-up e atribui autorização atual', () => {
    expect(planejarComandoAgendamento({...base,ativo:false,pausadoEm:agora,autorizadoPorUsuarioId:'outro'},'retomar',1,'ator',agora))
      .toMatchObject({ativo:true,pausadoEm:null,revisao:2,autorizadoPorUsuarioId:'ator',proximaExecucaoEm:new Date('2026-11-25T11:00:00Z')});
  });
  it.each([0,-1,1.5,2,NaN,Infinity])('rejeita revisão inválida ou obsoleta %s', revisao => {
    expect(()=>planejarComandoAgendamento(base,'reconfirmar',revisao,'ator',agora)).toThrow();
  });
  it('reenvio da revisão já aplicada retorna conflito sem novo efeito', () => {
    const atualizado = planejarComandoAgendamento(base,'pausar',1,'ator',agora);
    expect(()=>planejarComandoAgendamento(atualizado,'pausar',1,'ator',agora)).toThrow('alterado');
  });
});
