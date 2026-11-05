import 'reflect-metadata';
import { GUARDS_METADATA, HEADERS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ControladorEquivalenciasPlano, ControladorPreferenciasEquivalencia } from './controlador-equivalencias-plano';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SalvarPreferenciasEquivalenciaDto } from '../aplicacao/dtos-preferencias-equivalencia';
import { PREFERENCIAS_EQUIVALENCIA_PADRAO } from '../dominio/preferencias-equivalencia';
describe('FOOD05 fronteiras HTTP',()=>{
 it.each([ControladorEquivalenciasPlano,ControladorPreferenciasEquivalencia])('exige Professional e três guardas em %p',c=>{expect(Reflect.getMetadata(CHAVE_PAPEIS,c)).toEqual(['Professional']);expect(Reflect.getMetadata(GUARDS_METADATA,c)).toHaveLength(3);});
 it('fixa rotas/escopo pela sessão e não aceita tenant no caminho',async()=>{
  expect(Reflect.getMetadata(PATH_METADATA,ControladorEquivalenciasPlano)).toBe('pacientes/:pacienteId/planos-alimentares/:planoId/equivalencias');
  const u:any={tenantId:'sessao'},s:any={prever:jest.fn(async()=>({fingerprint:'f',rascunhoRevisao:1,nutriente:'energiaKcal',principal:{descricao:'Sintético',baseGramas:'100',nutrientes:{energiaKcal:'100'},identidade:'PRIVADO'},alternativas:[{chaveCliente:'a',resultado:{estado:'indisponivel',motivo:'alvo_ausente',nutriente:'energiaKcal',segredo:'PRIVADO'},interno:'PRIVADO'}],segredo:'PRIVADO'}))};
  const c=new ControladorEquivalenciasPlano(s);const r=await c.prever(u,'paciente','plano',{} as any);expect(s.prever).toHaveBeenCalledWith('sessao','paciente','plano',u,{});expect(JSON.stringify(r)).not.toContain('PRIVADO');
 });
 it.each([[ControladorEquivalenciasPlano,'prever','planos_alimentares.gerenciar'],[ControladorPreferenciasEquivalencia,'obter','planos_alimentares.ler'],[ControladorPreferenciasEquivalencia,'salvar','planos_alimentares.gerenciar']] as const)('no-store e permissão em %p/%s',(c,m,p)=>{const fn=(c.prototype as any)[m];expect(Reflect.getMetadata(CHAVE_PERMISSOES,fn)).toEqual([p]);expect(Reflect.getMetadata(HEADERS_METADATA,fn)).toContainEqual({name:'Cache-Control',value:'private, no-store'});});
 it('preferência DTO transformado valida contrato completo sem aceitar id ou PHI',()=>{const entrada={revisaoEsperada:0,preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO};expect(validateSync(plainToInstance(SalvarPreferenciasEquivalenciaDto,entrada),{whitelist:true,forbidNonWhitelisted:true})).toHaveLength(0);for(const e of [{...entrada,usuarioId:'outro'},{...entrada,preferencias:{...PREFERENCIAS_EQUIVALENCIA_PADRAO,paciente:'privado'}}])expect(validateSync(plainToInstance(SalvarPreferenciasEquivalenciaDto,e),{whitelist:true,forbidNonWhitelisted:true}).length).toBeGreaterThan(0);});
});
