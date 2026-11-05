'use client';
import { useEffect,useRef,useState } from 'react';
import { compararRegistrosFactuais,type ComparacaoRegistrosFactual } from '@/lib/comparacao-versoes-factuais';
import { ErroApiPlanoAlimentar } from '@/lib/plano-alimentar-api';
import type { PontoHistoricoMicronutrienteFactual } from '@/lib/historico-micronutrientes-factuais';
import { formatarNutrientePlano } from '@/lib/micronutrientes-plano';
import type { CodigoMicronutrienteApi } from '@/lib/plano-alimentar-api';
interface Props { pacienteId:string; itens:PontoHistoricoMicronutrienteFactual[]; nomesPlanos:Record<string,string>; leituraPermitida:boolean; aoInvalidar:(status:number)=>void }
const DATA=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const DIMENSOES={planejamento:'Planejamento',composicao_fonte:'Composição e fonte',referencia:'Referência',contexto:'Contexto'} as const;
const ESTADOS={igual:'Igual',alterada:'Diferente',nao_documentada:'Não documentada',incompativel:'Incompatível'} as const;
function numero(valor:number,casas:number){const limiar=10**-casas,fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:casas});return valor!==0&&Math.abs(valor)<limiar?`${valor<0?'>−':'<'}${fmt.format(limiar)}`:fmt.format(valor);}
export function ComparacaoRegistrosFactuais({pacienteId,itens,nomesPlanos,leituraPermitida,aoInvalidar}:Props){
 const [antes,setAntes]=useState(''),[depois,setDepois]=useState(''),[resultado,setResultado]=useState<ComparacaoRegistrosFactual|null>(null),[carregando,setCarregando]=useState(false),[erro,setErro]=useState(false);
 const controle=useRef<AbortController|null>(null),geracao=useRef(0);
 function limpar(){geracao.current++;controle.current?.abort();controle.current=null;setResultado(null);setErro(false);setCarregando(false);}
 useEffect(()=>()=>{geracao.current++;controle.current?.abort();},[]);
 async function comparar(){
  if(!leituraPermitida||!antes||!depois||antes===depois||carregando)return;
  limpar();const atual=geracao.current,controller=new AbortController();controle.current=controller;setCarregando(true);
  try{const resposta=await compararRegistrosFactuais(pacienteId,{antesId:antes,depoisId:depois},controller.signal);if(!controller.signal.aborted&&atual===geracao.current)setResultado(resposta);}
  catch(e){if(controller.signal.aborted||atual!==geracao.current)return;setErro(true);if(e instanceof ErroApiPlanoAlimentar&&(e.status===401||e.status===403||e.status===404))aoInvalidar(e.status);}
  finally{if(!controller.signal.aborted&&atual===geracao.current){controle.current=null;setCarregando(false);}}
 }
 const rotulo=(p:PontoHistoricoMicronutrienteFactual)=>`${DATA.format(new Date(p.registro.criadoEm))} · ${nomesPlanos[p.origem.planoId]??'Plano'} · versão ${p.origem.numero}${p.origem.status==='rascunho'?` · rascunho revisão ${p.origem.rascunhoRevisao}`:' · publicada'}`;
 const valor=(n:{estado:string;valor?:number},codigo:string,unidade:string)=>n.valor===undefined?'Indisponível':`${codigo==='energiaKcal'||codigo.endsWith('G')?numero(n.valor,4):formatarNutrientePlano(codigo as CodigoMicronutrienteApi,n.valor)} ${unidade}${n.estado==='COMPLETO'?' · cobertura completa':' contabilizados; total desconhecido'}`;
 return <section aria-label="Comparar análises salvas" className="grid gap-2 rounded border border-linha p-3">
  <h3 className="font-semibold">Comparar duas análises salvas</h3><p className="text-sm text-texto-suave">Selecione registros carregados no histórico. A comparação descreve o planejamento, não o consumo real nem uma mudança clínica.</p>
  <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1">Antes<select value={antes} disabled={!leituraPermitida} className="min-h-11 rounded border border-linha bg-white px-2" onChange={e=>{limpar();setAntes(e.target.value);}}><option value="">Selecione uma análise</option>{itens.map(p=><option value={p.registro.id} key={p.registro.id}>{rotulo(p)}</option>)}</select></label><label className="grid gap-1">Depois<select value={depois} disabled={!leituraPermitida} className="min-h-11 rounded border border-linha bg-white px-2" onChange={e=>{limpar();setDepois(e.target.value);}}><option value="">Selecione uma análise</option>{itens.map(p=><option value={p.registro.id} key={p.registro.id}>{rotulo(p)}</option>)}</select></label></div>
  {antes&&antes===depois?<p role="status">Escolha duas análises diferentes.</p>:null}<button type="button" disabled={!leituraPermitida||!antes||!depois||antes===depois||carregando} className="min-h-11 text-left text-primaria underline disabled:text-texto-suave" onClick={()=>void comparar()}>{carregando?'Comparando…':'Comparar análises'}</button>
  {erro?<p role="alert">Não foi possível comparar as análises. Confira o acesso e tente novamente.</p>:null}
  {resultado&&leituraPermitida?<><p className="text-sm text-texto-suave">Diferenças documentais não estabelecem causa. Referências RDA/AI/UL não estão disponíveis.</p><dl className="grid gap-1 text-sm">{Object.entries(DIMENSOES).map(([k,nome])=><div key={k}><dt className="inline font-medium">{nome}: </dt><dd className="inline">{ESTADOS[resultado.bases[k as keyof typeof DIMENSOES]]}</dd></div>)}</dl><div tabIndex={0} role="region" aria-label="Tabela de comparação das análises" className="max-w-full overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><caption className="sr-only">Valores planejados e diferenças por nutriente</caption><thead><tr>{['Nutriente','Antes','Depois','Diferença','Cobertura'].map(x=><th scope="col" className="border-b border-linha p-2" key={x}>{x}</th>)}</tr></thead><tbody>{resultado.linhas.map(l=><tr key={l.codigo}><th scope="row" className="border-b border-linha p-2">{l.rotulo}</th><td className="border-b border-linha p-2">{valor(l.antes,l.codigo,l.unidade)}</td><td className="border-b border-linha p-2">{valor(l.depois,l.codigo,l.unidade)}</td><td className="border-b border-linha p-2">{l.delta?`${numero(l.delta.valor,4)} ${l.unidade}${l.delta.percentual!==undefined?` (${numero(l.delta.percentual,2)}%)`:''}`:'Indisponível'}</td><td className="border-b border-linha p-2">{resultado.cobertura[l.codigo as CodigoMicronutrienteApi]==='igual'?'Igual':resultado.cobertura[l.codigo as CodigoMicronutrienteApi]==='alterada'?'Diferente':'—'}</td></tr>)}</tbody></table></div></>:null}
 </section>;
}
