import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { resolverContextoDietetico } from '../dominio/contexto-dietetico';
import { carregarContextoConfirmado, validarConfirmacoesContexto } from './contexto-confirmado-registro';
const confirmacoes = {populacaoReferencia:'feminina' as const,populacaoConfirmada:true,gestacao:'nao' as const,
  lactacao:'nao' as const,aplicabilidade:'confirmada' as const,mesmoDiaPlanejado:true,tabagismo:'nao_informado' as const};
const tenant='10000000-0000-4000-8000-000000000001',paciente='20000000-0000-4000-8000-000000000001';
describe('confirmações de contexto do registro',()=>{
 afterEach(()=>jest.useRealTimers());
 it('valida e copia confirmações sem inferir estados desconhecidos',()=>{
  const r=validarConfirmacoesContexto(confirmacoes);expect(r).toEqual(confirmacoes);expect(r).not.toBe(confirmacoes);
  expect(validarConfirmacoesContexto({...confirmacoes,gestacao:'nao_informada',mesmoDiaPlanejado:false})).toMatchObject({gestacao:'nao_informada',mesmoDiaPlanejado:false});
 });
 it.each(['nascimento','dataAnalise','tenantId','elegivel','idadeAnos','__proto__','constructor'])('recusa campo não autorizado %s',campo=>{
  const e=JSON.parse(JSON.stringify(confirmacoes));Object.defineProperty(e,campo,{value:'2000-01-01',enumerable:true});
  expect(()=>validarConfirmacoesContexto(e)).toThrow(BadRequestException);
 });
 it.each([null,[],{}, {...confirmacoes,populacaoConfirmada:1},{...confirmacoes,mesmoDiaPlanejado:'true'},
  {...confirmacoes,tabagismo:null},{...confirmacoes,gestacao:false},{...confirmacoes,lactacao:'talvez'},
  {...confirmacoes,populacaoReferencia:'outro'},{...confirmacoes,aplicabilidade:true}])('recusa confirmação malformada %#',e=>{
  expect(()=>validarConfirmacoesContexto(e)).toThrow(BadRequestException);
 });
 it('recusa accessors sem executá-los e propriedades não enumeráveis',()=>{
  const get=jest.fn(()=>true),e={...confirmacoes};Object.defineProperty(e,'mesmoDiaPlanejado',{get,enumerable:true});
  expect(()=>validarConfirmacoesContexto(e)).toThrow(BadRequestException);expect(get).not.toHaveBeenCalled();
  expect(()=>validarConfirmacoesContexto(Object.defineProperty({...confirmacoes},'extra',{value:1}))).toThrow(BadRequestException);
 });
 it.each([['America/Sao_Paulo',18,'2026-11-05'],['Asia/Tokyo',19,'2026-11-06']])('obtém data clínica do tenant em %s',async(timezone,idade,data)=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-11-06T01:00:00Z'));
  const findOne=jest.fn(async()=>({dataNascimento:'2007-11-06'})),query=jest.fn(async()=>[{timezone}]),getRepository=jest.fn(()=>({findOne}));
  const r=await carregarContextoConfirmado({query,getRepository} as unknown as EntityManager,tenant,paciente,confirmacoes);
  expect(r.dataAnalise).toBe(data);expect(resolverContextoDietetico(r).idadeAnos).toBe(idade);
  expect(query.mock.calls[0]).toEqual([expect.stringContaining('tenant_configuracoes'),[tenant]]);
  expect(getRepository).toHaveBeenCalledWith(PacienteOrm);
  expect(findOne).toHaveBeenCalledWith(expect.objectContaining({select:{dataNascimento:true},where:expect.objectContaining({id:paciente,tenantId:tenant}),lock:{mode:'pessimistic_read'}}));
 });
 it('mantém nascimento ausente como desconhecido e recusa paciente indisponível',async()=>{
  const findOne=jest.fn().mockResolvedValueOnce({dataNascimento:null}).mockResolvedValueOnce(null),query=jest.fn(async()=>[{timezone:'America/Sao_Paulo'}]);
  const g={query,getRepository:()=>({findOne})} as unknown as EntityManager;
  const r=await carregarContextoConfirmado(g,tenant,paciente,confirmacoes);expect(r.nascimento).toBeUndefined();
  expect(resolverContextoDietetico(r).motivos).toContain('nascimento_nao_informado');
  await expect(carregarContextoConfirmado(g,tenant,paciente,confirmacoes)).rejects.toThrow(NotFoundException);
 });
});
