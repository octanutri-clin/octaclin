import { projetarOrigemContribuicao } from './projecao-origem-contribuicao';
describe('FOOD06 metadados congelados mínimos',()=>{
 it('não projeta referência livre custom nem fonte indevida de um manual',()=>{
  expect(projetarOrigemContribuicao({origem:'custom',referencia:'CANARIO',contextoClinico:'CANARIO',fonte:{codigo:'X',nome:'X',versao:'X'}})).toEqual({origem:'custom'});
  expect(projetarOrigemContribuicao({origem:'manual',fonte:{codigo:'X',nome:'X',versao:'X'}})).toEqual({origem:'manual'});
 });
 it.each([null,[],42,{origem:'__proto__'},{origem:null}])('não infere metadados ausentes ou inválidos %j',v=>expect(projetarOrigemContribuicao(v)).toEqual({origem:'nao_informada'}));
 it('omite metadados malformados sem apagar nutrientes conhecidos',()=>{
  expect(projetarOrigemContribuicao({origem:'catalogo',preparacao:'x'.repeat(201),fonte:{codigo:42,nome:'X',versao:'X'},micronutrientes:{baseGramasOrigem:-1}})).toEqual({origem:'catalogo'});
 });
});
