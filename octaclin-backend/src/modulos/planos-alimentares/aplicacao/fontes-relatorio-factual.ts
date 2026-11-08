import type {RegistroAnaliseFactual} from './construtor-analise-factual';
import {identificarFonteCatalogo} from '../dominio/fonte-catalogo';
type Fonte={tipo:'TACO'|'USDA'|'IBGE'|'manual'|'custom';codigo?:string;versao?:string;quantidade:number};
/** Resumo de proveniência congelada; não atesta cobertura de nutrientes nem direitos. */
export function resumirFontesRegistro(r:RegistroAnaliseFactual){
 const fontes=new Map<string,Fonte>();let itensIncluidos=0,semReferencia=0;
 if(r.versao.estado.ativo&&r.versao.estado.selecionado)for(const refeicao of r.versao.estado.refeicoes){
  if(!refeicao.ativa||!refeicao.selecionada)continue;
  for(const item of refeicao.itens){itensIncluidos++;if(!item||typeof item!=='object'){semReferencia++;continue;}
   const s=item as Record<string,unknown>,f=s.fonte as Record<string,unknown>|undefined;
   const catalogo=s.origem==='catalogo'?identificarFonteCatalogo(f):undefined;
   const tipo=s.origem==='manual'?'manual':s.origem==='custom'?'custom':catalogo?.tipo;
   if(!tipo){semReferencia++;continue;}
   const versao=catalogo?.versao;
   const codigo=catalogo?.codigo;
   const chave=JSON.stringify([tipo,codigo,versao]);const anterior=fontes.get(chave);if(anterior)anterior.quantidade++;else fontes.set(chave,{tipo,...(codigo?{codigo}:{}),...(versao?{versao}:{}),quantidade:1});
  }
 }
 const ordenadas=[...fontes.values()].sort((a,b)=>a.tipo.localeCompare(b.tipo,'pt-BR')||(a.codigo??'').localeCompare(b.codigo??'')||(a.versao??'').localeCompare(b.versao??''));
 return {estado:'resumo_documentado' as const,itensIncluidos,semReferencia,fontesNaoDetalhadas:ordenadas.slice(50).reduce((n,f)=>n+f.quantidade,0),fontes:ordenadas.slice(0,50)};
}
