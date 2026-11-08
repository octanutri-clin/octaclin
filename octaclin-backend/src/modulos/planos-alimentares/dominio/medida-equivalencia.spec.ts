import { projetarMedidaEquivalente } from './medida-equivalencia';
describe('FOOD05 medidas equivalentes factuais',()=>{
 it('converte usando referência exata sem inventar colher ou densidade',()=>{expect(projetarMedidaEquivalente('250',{nome:'Colher',quantidadeReferencia:1,pesoReferenciaGramas:20})).toMatchObject({nome:'Colher',quantidade:'12.5',aproximada:false,podeAplicarQuantidade:true,gramasAposMedida:'250'});});
 it('registra aproximação e peso real se o profissional aplicar a quantidade caseira',()=>{expect(projetarMedidaEquivalente('100',{nome:'Unidade',quantidadeReferencia:1,pesoReferenciaGramas:3})).toMatchObject({quantidade:'33.333',aproximada:true,gramasAposMedida:'99.999'});});
 it('uma unidade ml só funciona com peso cadastrado explícito',()=>{expect(projetarMedidaEquivalente('50',{nome:'ml',quantidadeReferencia:100,pesoReferenciaGramas:90}).quantidade).toBe('55.556');expect(()=>projetarMedidaEquivalente('50',{nome:'ml',quantidadeReferencia:100,pesoReferenciaGramas:0})).toThrow();});
 it('não força quantidade doméstica abaixo do mínimo para um mínimo falso',()=>{expect(projetarMedidaEquivalente('0.001',{nome:'Unidade',quantidadeReferencia:1,pesoReferenciaGramas:10000})).toMatchObject({quantidade:'0',aproximada:true,podeAplicarQuantidade:false});});
});
