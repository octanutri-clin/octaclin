import { randomUUID } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { AlimentoPersonalizadoOrm } from '../infraestrutura/alimento-personalizado.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { normalizarComposicaoPersonalizada } from '../dominio/alimentos-personalizados';
const tenant=randomUUID(),p=randomUUID();
const e=(origem:'catalogo'|'custom'='catalogo')=>({id:randomUUID(),origem,alimentoId:randomUUID(),...(origem==='custom'?{revisao:1}:{}),quantidade:1,unidade:'porção',porcaoGramas:20});
function ambiente(){
  const crypto=new CriptografiaDadosSensiveis();
  const fonte:any={id:randomUUID(),situacao:'ativa',direitoUsoStatus:'aprovado',codigo:'sintetica',versao:'v1',hashConteudo:'a'.repeat(64),esquemaVersao:'1'};
  const alimento:any={id:randomUUID(),fonteId:fonte.id,nome:'Alimento sintético',baseGramas:'50',energiaKcal:'25',proteinasG:null,carboidratosG:'0',micronutrientes:{}};
  const composicao=normalizarComposicaoPersonalizada({nome:'Produto sintético',base:{tipo:'por100g'},nutrientes:{energiaKcal:100}});
  const custom:any={id:randomUUID(),tenantId:tenant,profissionalId:p,escopo:'pessoal',ativo:true,revisao:1,conteudoCriptografado:crypto.criptografar(JSON.stringify({schemaVersao:1,composicao}))};
  const g:any={getRepository:(tipo:any)=>({findOne:async({where}:any)=>{const row=tipo===AlimentoComposicaoOrm?alimento:tipo===FonteComposicaoAlimentoOrm?fonte:tipo===AlimentoPersonalizadoOrm?custom:null;return row&&Object.entries(where).every(([k,v])=>row[k]===v)?row:null;}})};
  return {g,fonte,alimento,custom,crypto,s:new FontesGruposSubstituicoes(crypto)};
}
describe('FOOD04 fontes autorizadas, não são equivalência',()=>{
  it('normaliza composição parcial, preserva ausências e zero sem confiar no cliente',async()=>{
    const a=ambiente(),r=await a.s.resolver(a.g,tenant,p,'pessoal',{...e(),alimentoId:a.alimento.id});
    expect(r.composicao.nutrientesPor100g).toEqual({energiaKcal:50,carboidratosG:0});
    expect(r.composicao.fonte).toMatchObject({versao:'v1',hashConteudo:'a'.repeat(64)});
  });
  it('nega fonte sem direitos aprovados ou suspensa',async()=>{
    const a=ambiente(),ref={...e(),alimentoId:a.alimento.id};
    a.fonte.direitoUsoStatus='pendente';await expect(a.s.resolver(a.g,tenant,p,'clinica',ref)).rejects.toBeInstanceOf(ConflictException);
    a.fonte.direitoUsoStatus='aprovado';a.fonte.situacao='suspensa';await expect(a.s.resolver(a.g,tenant,p,'clinica',ref)).rejects.toBeInstanceOf(ConflictException);
  });
  it('custom pessoal nunca atravessa grupo clínica, outro profissional, admin ou tenant',async()=>{
    const a=ambiente(),ref={...e('custom'),alimentoId:a.custom.id};
    expect((await a.s.resolver(a.g,tenant,p,'pessoal',ref)).composicao.descricao).toBe('Produto sintético');
    for(const prof of [p,randomUUID(),undefined]) await expect(a.s.resolver(a.g,tenant,prof,'clinica',ref)).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.s.resolver(a.g,randomUUID(),p,'pessoal',ref)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('admin só resolve custom clínica; revisão e estado atuais são obrigatórios',async()=>{
    const a=ambiente(),ref={...e('custom'),alimentoId:a.custom.id};a.custom.escopo='clinica';
    expect((await a.s.resolver(a.g,tenant,undefined,'clinica',ref)).composicao.nutrientesPor100g).toEqual({energiaKcal:100});
    a.custom.revisao=2;await expect(a.s.resolver(a.g,tenant,undefined,'clinica',ref)).rejects.toBeInstanceOf(ConflictException);
  });
});
