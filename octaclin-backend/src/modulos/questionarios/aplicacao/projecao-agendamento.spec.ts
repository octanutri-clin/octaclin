import { projetarAgendamento } from './acesso-agendamento';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
describe('próxima ocorrência informativa para conferência',()=>{
  const a=()=>Object.assign(new AgendamentoQuestionarioOrm(),{ativo:false,pausadoEm:new Date(),timezone:'America/Sao_Paulo',revisao:1,regraCron:'0 8 * * *'});
  it('mostra somente ocorrência futura calculada pelo mesmo motor',()=>{
    const p=projetarAgendamento(a()) as ReturnType<typeof projetarAgendamento>&{proximaOcorrenciaFutura:Date|null};
    expect(p.proximaOcorrenciaFutura).toBeInstanceOf(Date);expect(p.proximaOcorrenciaFutura!.getTime()).toBeGreaterThan(Date.now());
    expect(p.proximaOcorrenciaFutura!.getUTCHours()).toBe(11);
  });
  it('envio único vencido não recebe data inventada',()=>{
    const p=projetarAgendamento(Object.assign(a(),{regraCron:null,dataFixa:new Date('2000-01-01')}));
    expect(p).toHaveProperty('proximaOcorrenciaFutura',null);
  });
  it('encerrado não recebe prévia de reativação',()=>{
    const p=projetarAgendamento(Object.assign(a(),{pausadoEm:null,regraCron:null,ultimaExecucaoEm:new Date()}));
    expect(p).toHaveProperty('proximaOcorrenciaFutura',null);
  });
});
