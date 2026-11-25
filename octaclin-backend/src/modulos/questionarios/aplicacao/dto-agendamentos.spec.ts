import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ComandarAgendamentoQuestionarioDto, CriarAgendamentoQuestionarioDto, ListarAgendamentosQuestionarioDto } from './dtos';
const id='00000000-0000-4000-8000-000000000001';
const erros=(tipo:new()=>object,dados:object)=>validateSync(plainToInstance(tipo,dados),{whitelist:true,forbidNonWhitelisted:true});
describe('contratos de controle de agendamentos',()=>{
  it('aceita comando explícito e paginação limitada',()=>{
    expect(erros(ComandarAgendamentoQuestionarioDto,{pacienteId:id,acao:'pausar',revisaoEsperada:1,confirmar:true})).toHaveLength(0);
    expect(erros(ListarAgendamentosQuestionarioDto,{pacienteId:id,pagina:'2'})).toHaveLength(0);
  });
  it.each([false,'true',1,null,undefined])('confirmação %s não é consentimento explícito',confirmar=>{
    expect(erros(ComandarAgendamentoQuestionarioDto,{pacienteId:id,acao:'reconfirmar',revisaoEsperada:1,confirmar})).not.toHaveLength(0);
  });
  it.each([0,-1,1.5,2147483647,'1'])('revisão manipulada %s é rejeitada',revisaoEsperada=>{
    expect(erros(ComandarAgendamentoQuestionarioDto,{pacienteId:id,acao:'pausar',revisaoEsperada,confirmar:true})).not.toHaveLength(0);
  });
  it('não aceita tenant, ator ou campos desconhecidos no comando',()=>{
    expect(erros(ComandarAgendamentoQuestionarioDto,{pacienteId:id,acao:'retomar',revisaoEsperada:1,confirmar:true,tenantId:id,autorizadoPorUsuarioId:id})).toHaveLength(2);
  });
  it('criação valida todos os campos fornecidos mesmo com as duas bases presentes',()=>{
    expect(erros(CriarAgendamentoQuestionarioDto,{questionarioId:id,pacienteId:id,regraCron:{invalido:true},dataFixa:'2030-01-01T12:00:00Z'})).not.toHaveLength(0);
  });
  it('limita cron/fuso e rejeita timezone inexistente',()=>{
    expect(erros(CriarAgendamentoQuestionarioDto,{questionarioId:id,pacienteId:id,regraCron:'*'.repeat(121),timezone:'Fuso/Inexistente'})).toHaveLength(2);
  });
});
