import {resumirFontesRegistro} from './fontes-relatorio-factual';
import type {RegistroAnaliseFactual} from './construtor-analise-factual';
const registro=(itens:unknown[],ativa=true)=>({versao:{estado:{ativo:true,selecionado:true,refeicoes:[{ativa,selecionada:true,itens}]}}}) as unknown as RegistroAnaliseFactual;
it('resume apenas fontes congeladas incluídas, sem identificadores e metadados livres',()=>{
 const r=resumirFontesRegistro(registro([{origem:'catalogo',fonte:{baseCodigo:'TACO',versao:'1',hashConteudo:'CANARIO'}},{origem:'catalogo',fonte:{baseCodigo:'TACO',versao:'1'}},{origem:'manual',fonte:{codigo:'PACIENTE_CANARIO'}}]));
 expect(r).toEqual({estado:'resumo_documentado',itensIncluidos:3,semReferencia:0,fontesNaoDetalhadas:0,fontes:[{tipo:'manual',quantidade:1},{tipo:'TACO',versao:'1',quantidade:2}]});expect(JSON.stringify(r)).not.toContain('CANARIO');
});
it('não presume fonte/versão e não lê itens de refeições excluídas',()=>{
 expect(resumirFontesRegistro(registro([null,{origem:'catalogo',fonte:{baseCodigo:'NAO_VALIDADA',versao:'CANARIO'}}])).semReferencia).toBe(2);
 expect(resumirFontesRegistro(registro([{origem:'catalogo',fonte:{baseCodigo:'TACO',versao:'CANARIO'}}])).fontes).toEqual([{tipo:'TACO',quantidade:1}]);
 expect(resumirFontesRegistro(registro([{get origem(){throw new Error('não deve ler');}}],false)).itensIncluidos).toBe(0);
});
it('limita grupos sem ocultar a contagem de fontes adicionais',()=>{const r=resumirFontesRegistro(registro(Array.from({length:60},(_,n)=>({origem:'catalogo',fonte:{baseCodigo:'TACO',versao:String(n)}}))));expect(r.fontes).toHaveLength(50);expect(r.fontesNaoDetalhadas).toBe(10);expect(r.fontes.reduce((n,f)=>n+f.quantidade,0)+r.fontesNaoDetalhadas+r.semReferencia).toBe(r.itensIncluidos);});
