import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { MAPEAMENTO_MICRONUTRIENTES } from '../dominio/micronutrientes';
import { ConsultaTeorCatalogoDto, validarConsultaTeorCatalogo } from './dto-consulta-teor-catalogo';
import { ServicoConsultaTeorCatalogo } from './servico-consulta-teor-catalogo';
const tenant='10000000-0000-4000-8000-000000000001';
const usuario:UsuarioAutenticado={tenantId:tenant,usuarioId:'20000000-0000-4000-8000-000000000001',papel:'Professional',permissoes:['planos_alimentares.ler'],emailHash:'sintetico'};
const consulta:ConsultaTeorCatalogoDto={codigo:'ferroMg',porcaoGramas:50,busca:'arroz',pagina:1,limite:2};
const row=(n:number,valor=2)=>({id:`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`,nome:'Arroz sintético',preparacao:null,baseGramas:'100.000',micronutrientes:{mapeamentoVersao:MAPEAMENTO_MICRONUTRIENTES,nutrientes:{ferroMg:{estado:'conhecido',valor}}},fonteId:'40000000-0000-4000-8000-000000000001',fonteCodigo:'taco_nepa_unicamp',fonteVersao:'4a',baseCodigo:'TACO',esquemaVersao:'octaclin-composicao-v2-micros1',situacao:'ativa',direitoUsoStatus:'aprovado',segredo:'CANARIO_NAO_PROJETAR'});
function setup(rows= [row(1),row(2,4),row(3)]) {
 const qb:any={};for(const method of ['innerJoin','select','addSelect','where','andWhere','orderBy','addOrderBy','offset','limit'])qb[method]=jest.fn().mockReturnValue(qb);
 qb.getRawMany=jest.fn().mockResolvedValue(rows);
 const findOne=jest.fn().mockResolvedValue({id:'50000000-0000-4000-8000-000000000001'});
 const g={getRepository:jest.fn((tipo)=>{if(tipo!==ProfissionalOrm)throw new Error('Repositório inesperado');return {findOne};}),createQueryBuilder:jest.fn().mockReturnValue(qb)} as unknown as EntityManager;
 const executar=jest.fn(async(t,fn)=>fn(g));return {servico:new ServicoConsultaTeorCatalogo({executar} as unknown as ExecutorTenant),qb,findOne,executar};
}
describe('M11 consulta factual autorizada e paginada',()=>{
 it('resolve vínculo, fontes e lote no executor do tenant, sem campos livres',async()=>{const s=setup();const r=await s.servico.consultar(tenant,usuario,consulta);expect(s.executar.mock.calls[0][0]).toBe(tenant);expect(s.findOne).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tenantId:tenant,usuarioId:usuario.usuarioId}),lock:{mode:'pessimistic_read'}}));expect(r.itens.map((i:any)=>i.nutriente.valorPorcao)).toEqual([2,1]);expect(r.itens[0].alimento).not.toHaveProperty('preparacao');expect(JSON.stringify(r)).not.toContain('CANARIO');expect(r.paginacao).toEqual({pagina:1,limite:2,temProxima:true,ordemSelecao:'nome_identificador',ordenacaoTeor:'somente_pagina',visao:'catalogo_atual_sem_snapshot'});});
 it('filtra fonte ativa e direito aprovado na mesma consulta parametrizada',async()=>{const s=setup();await s.servico.consultar(tenant,usuario,{...consulta,busca:'ar%_\\',pagina:2,fonteCodigo:'taco_nepa_unicamp'});expect(s.qb.andWhere).toHaveBeenCalledWith('fonte.situacao = :situacao AND fonte.direito_uso_status = :direito',{situacao:'ativa',direito:'aprovado'});expect(s.qb.where).toHaveBeenCalledWith(expect.stringContaining('LIKE'),{busca:'%ar\\%\\_\\\\%'});expect(s.qb.andWhere).toHaveBeenCalledWith('fonte.codigo = :fonteCodigo',{fonteCodigo:'taco_nepa_unicamp'});expect(s.qb.offset).toHaveBeenCalledWith(2);expect(s.qb.limit).toHaveBeenCalledWith(3);expect(s.qb.addOrderBy).toHaveBeenCalledWith('alimento.id','ASC');});
 it('retorna fim da paginação e desconhecidos sem inventar zero',async()=>{const a=row(1);a.micronutrientes.nutrientes={} as any;const r=await setup([a]).servico.consultar(tenant,usuario,consulta);expect(r.paginacao.temProxima).toBe(false);expect(r.itens[0].nutriente.estado).toBe('ausente');expect(r.itens[0].nutriente).not.toHaveProperty('valorPorcao');expect(r.individualizacao.estado).toBe('bloqueada');});
 it.each(['SuperAdmin','Collaborator','Client','Patient'] as const)('recusa papel %s antes de consultar catálogo',async papel=>{const s=setup();await expect(s.servico.consultar(tenant,{...usuario,papel},consulta)).rejects.toBeInstanceOf(ForbiddenException);expect(s.executar).not.toHaveBeenCalled();});
 it('recusa tenant divergente e permissão removida',async()=>{for(const u of [{...usuario,tenantId:'outro'},{...usuario,permissoes:[]}]){const s=setup();await expect(s.servico.consultar(tenant,u,consulta)).rejects.toBeInstanceOf(ForbiddenException);expect(s.executar).not.toHaveBeenCalled();}});
 it('recusa vínculo arquivado/ausente sem consultar catálogo',async()=>{const s=setup();s.findOne.mockResolvedValue(null);await expect(s.servico.consultar(tenant,usuario,consulta)).rejects.toBeInstanceOf(ForbiddenException);expect(s.qb.getRawMany).not.toHaveBeenCalled();});
 it('revalida fonte defensivamente sem expor alimento devolvido incorretamente',async()=>{const a=row(1);a.direitoUsoStatus='revogado';const r=await setup([a]).servico.consultar(tenant,usuario,consulta);expect(r.itens).toEqual([]);});
 it('rejeita payload manipulado também no serviço',async()=>{const s=setup();await expect(s.servico.consultar(tenant,usuario,{...consulta,pacienteId:'canario'} as any)).rejects.toBeInstanceOf(BadRequestException);expect(s.executar).not.toHaveBeenCalled();});
});
describe('DTO da consulta factual',()=>{
 it('aceita somente contrato profissional genérico',()=>expect(validarConsultaTeorCatalogo(consulta)).toEqual(consulta));
 it.each([{codigo:'invalido'},{porcaoGramas:0},{porcaoGramas:1.2345},{porcaoGramas:'50'},{pagina:0},{pagina:10001},{limite:101},{limite:null},{busca:'  '},{busca:'x'.repeat(121)},{fonteCodigo:null},{versao:''},{baseCodigo:' '},{personalizar:true},{pacienteId:'canario'},{micronutrientes:{ferroMg:10}},{porcaoGramas:Infinity}])('recusa entrada fora do contrato %#',delta=>expect(()=>validarConsultaTeorCatalogo({...consulta,...delta})).toThrow(BadRequestException));
 it('recusa chaves especiais, símbolos e accessors sem executá-los',()=>{
   const getter=jest.fn(()=>consulta.codigo);const accessor={...consulta};Object.defineProperty(accessor,'codigo',{get:getter,enumerable:true});
   for(const v of [accessor,{...consulta,[Symbol('extra')]:true},Object.assign(Object.create({extra:true}),consulta),JSON.parse(JSON.stringify(consulta).slice(0,-1)+',"__proto__":{"extra":true}}'),{...consulta,constructor:{}}])expect(()=>validarConsultaTeorCatalogo(v)).toThrow(BadRequestException);
   expect(getter).not.toHaveBeenCalled();expect(({} as any).extra).toBeUndefined();
 });

});
