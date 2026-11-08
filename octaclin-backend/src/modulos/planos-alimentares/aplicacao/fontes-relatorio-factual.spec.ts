import {resumirFontesRegistro} from './fontes-relatorio-factual';
import type {RegistroAnaliseFactual} from './construtor-analise-factual';
const registro=(itens:unknown[],ativa=true)=>({versao:{estado:{ativo:true,selecionado:true,refeicoes:[{ativa,selecionada:true,itens}]}}}) as unknown as RegistroAnaliseFactual;
it('resume apenas fontes congeladas incluídas, sem identificadores e metadados livres',()=>{
 const r=resumirFontesRegistro(registro([{origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:'1',hashConteudo:'CANARIO'}},{origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:'1'}},{origem:'manual',fonte:{codigo:'PACIENTE_CANARIO'}}]));
 expect(r).toEqual({estado:'resumo_documentado',itensIncluidos:3,semReferencia:0,fontesNaoDetalhadas:0,fontes:[{tipo:'manual',quantidade:1},{tipo:'TACO',codigo:'taco_nepa_unicamp',versao:'1',quantidade:2}]});expect(JSON.stringify(r)).not.toContain('CANARIO');
});
it('não presume fonte/versão e não lê itens de refeições excluídas',()=>{
 expect(resumirFontesRegistro(registro([null,{origem:'catalogo',fonte:{baseCodigo:'NAO_VALIDADA',versao:'CANARIO'}}])).semReferencia).toBe(2);
 expect(resumirFontesRegistro(registro([{origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:'CANARIO <x>'}}])).fontes).toEqual([{tipo:'TACO',codigo:'taco_nepa_unicamp',quantidade:1}]);
 expect(resumirFontesRegistro(registro([{get origem(){throw new Error('não deve ler');}}],false)).itensIncluidos).toBe(0);
});
it('limita grupos sem ocultar a contagem de fontes adicionais',()=>{const r=resumirFontesRegistro(registro(Array.from({length:60},(_,n)=>({origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:String(n)}}))));expect(r.fontes).toHaveLength(50);expect(r.fontesNaoDetalhadas).toBe(10);expect(r.fontes.reduce((n,f)=>n+f.quantidade,0)+r.fontesNaoDetalhadas+r.semReferencia).toBe(r.itensIncluidos);});

it('R4C2-01 resumo global reconhece as fontes reais de produção e mantém versão livre do catálogo',()=>{
 const r=resumirFontesRegistro(registro([
  {origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:'taco-4a-cmvcol-taco3-v1'}},
  {origem:'catalogo',fonte:{codigo:'ibge_pof_2008_2009',baseCodigo:'pof-2008-2009-composicao',versao:'pof-2008-2009-v1'}},
  {origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'foundation-foods',versao:'1'}},
  {origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',baseCodigo:'cmvcol_taco3',versao:'CANARIO <x>'}}]));
 expect(r.semReferencia).toBe(1);
 expect(r.fontes).toEqual([{tipo:'IBGE',codigo:'ibge_pof_2008_2009',versao:'pof-2008-2009-v1',quantidade:1},{tipo:'TACO',codigo:'taco_nepa_unicamp',quantidade:1},{tipo:'TACO',codigo:'taco_nepa_unicamp',versao:'taco-4a-cmvcol-taco3-v1',quantidade:1}]);
 expect(JSON.stringify(r)).not.toContain('CANARIO');
});

it('resumo global separa USDA Foundation e SR Legacy mesmo com a mesma versão, como o resumo por nutriente',()=>{
 const r=resumirFontesRegistro(registro([
  {origem:'catalogo',fonte:{codigo:'usda_fdc_foundation',baseCodigo:'foundation-foods',versao:'2025-10-30'}},
  {origem:'catalogo',fonte:{codigo:'usda_fdc_sr_legacy',baseCodigo:'sr-legacy',versao:'2025-10-30'}}]));
 expect(r.fontes).toEqual([
  {tipo:'USDA',codigo:'usda_fdc_foundation',versao:'2025-10-30',quantidade:1},
  {tipo:'USDA',codigo:'usda_fdc_sr_legacy',versao:'2025-10-30',quantidade:1}]);
});
it('resumo global reconhece snapshot histórico sem baseCodigo',()=>{
 const r=resumirFontesRegistro(registro([{origem:'catalogo',fonte:{codigo:'taco_nepa_unicamp',versao:'taco-4a-cmvcol-taco3-v1'}}]));
 expect(r.semReferencia).toBe(0);expect(r.fontes).toEqual([{tipo:'TACO',codigo:'taco_nepa_unicamp',versao:'taco-4a-cmvcol-taco3-v1',quantidade:1}]);
});
