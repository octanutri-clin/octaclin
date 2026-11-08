import { randomUUID } from 'crypto';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ServicoPreferenciasEquivalencia } from './servico-preferencias-equivalencia';
import { PREFERENCIAS_EQUIVALENCIA_PADRAO } from '../dominio/preferencias-equivalencia';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
function ambiente(){
 const u:UsuarioAutenticado={tenantId:randomUUID(),usuarioId:randomUUID(),papel:'Professional',emailHash:'sintetico',permissoes:['planos_alimentares.ler','planos_alimentares.gerenciar']};
 const profissional:any={id:randomUUID(),tenantId:u.tenantId,usuarioId:u.usuarioId,arquivadoEm:null,preferenciasEquivalencia:{...PREFERENCIAS_EQUIVALENCIA_PADRAO},preferenciasEquivalenciaRevisao:0};
 const corresponde=(w:any)=>Object.entries(w).every(([k,v]:any)=>v?._type==='isNull'?profissional[k]==null:profissional[k]===v);
 const repo={findOne:jest.fn(async({where}:any)=>corresponde(where)?{...profissional}:null),update:jest.fn(async(where:any,patch:any)=>{if(!corresponde(where))return {affected:0};Object.assign(profissional,patch);return {affected:1};})};
 const executor:any={executar:async(t:string,f:any)=>{expect(t).toBe(u.tenantId);return f({getRepository:(tipo:any)=>{expect(tipo).toBe(ProfissionalOrm);return repo;}});}};
 return {s:new ServicoPreferenciasEquivalencia(executor),u,profissional,repo};
}
describe('FOOD05 preferências apenas do próprio vínculo',()=>{
 it('lê projeção mínima, salva CAS e não afeta cálculos',async()=>{const a=ambiente();expect(await a.s.obter(a.u)).toEqual({preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO,revisao:0});const r=await a.s.salvar(a.u,{revisaoEsperada:0,preferencias:{...PREFERENCIAS_EQUIVALENCIA_PADRAO,casasGramas:1}});expect(r).toMatchObject({revisao:1,preferencias:{casasGramas:1}});expect(JSON.stringify(r)).not.toMatch(/usuarioId|tenantId|profissionalId/);});
 it('concorrência com mesma revisão produz uma única atualização',async()=>{const a=ambiente(),p={revisaoEsperada:0,preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO};const r=await Promise.allSettled([a.s.salvar(a.u,p),a.s.salvar(a.u,p)]);expect(r.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((r.find(x=>x.status==='rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);});
 it('nega outro usuário, tenant e profissional arquivado',async()=>{for(const campo of ['usuarioId','tenantId','arquivadoEm']){const a=ambiente();a.profissional[campo]=campo==='arquivadoEm'?new Date():randomUUID();await expect(a.s.obter(a.u)).rejects.toBeInstanceOf(ForbiddenException);expect(a.repo.update).not.toHaveBeenCalled();}});
 it.each(['Patient','Collaborator','Client','SuperAdmin'])('nega papel %s mesmo com permissões',async papel=>{const a=ambiente();await expect(a.s.obter({...a.u,papel} as UsuarioAutenticado)).rejects.toBeInstanceOf(ForbiddenException);});
 it('valida backend e não aceita id/PHI no corpo, permissão revogada ou revisão esgotada',async()=>{const a=ambiente();await expect(a.s.salvar(a.u,{revisaoEsperada:0,preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO,pacienteId:randomUUID()})).rejects.toBeInstanceOf(BadRequestException);await expect(a.s.salvar({...a.u,permissoes:[]},{revisaoEsperada:0,preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO})).rejects.toBeInstanceOf(ForbiddenException);a.profissional.preferenciasEquivalenciaRevisao=2147483647;await expect(a.s.salvar(a.u,{revisaoEsperada:2147483647,preferencias:PREFERENCIAS_EQUIVALENCIA_PADRAO})).rejects.toBeInstanceOf(ConflictException);});
});
