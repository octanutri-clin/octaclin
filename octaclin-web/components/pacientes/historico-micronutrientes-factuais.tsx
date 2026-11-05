'use client';
import { useCallback,useEffect,useId,useMemo,useRef,useState } from 'react';
import { ComparacaoRegistrosFactuais } from './comparacao-registros-factuais';
import { obterHistoricoMicronutrientesFactual } from '@/lib/calculo-combinado-planos-api';
import { ErroApiPlanoAlimentar } from '@/lib/plano-alimentar-api';
import type { CursorHistoricoMicronutrientesFactual,PontoHistoricoMicronutrienteFactual } from '@/lib/historico-micronutrientes-factuais';
import { CAMPOS_MICRONUTRIENTES_PLANO,formatarNutrientePlano } from '@/lib/micronutrientes-plano';
import type { CodigoMicronutrienteApi } from '@/lib/plano-alimentar-api';

interface Props { pacienteId:string; nomesPlanos:Record<string,string>; leituraPermitida:boolean; aoInvalidar:(status:number)=>void }
const DATA=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
const ROTULOS=new Map(CAMPOS_MICRONUTRIENTES_PLANO.map(c=>[c.codigo,c]));
function exibirValor(p:PontoHistoricoMicronutrienteFactual,codigo:CodigoMicronutrienteApi){
 const n=p.nutrientes[codigo],campo=ROTULOS.get(codigo)!;
 if(n.valor===undefined)return n.estado==='DESCONHECIDO'?'Composição desconhecida':n.estado==='PARCIAL'?'Subtotal indisponível':n.estado==='INCOMPATIVEL'?'Dados incompatíveis':'Cálculo indisponível';
 const numero=formatarNutrientePlano(codigo,n.valor);
 return n.estado==='COMPLETO'?`${numero} ${campo.unidade}`:`${numero} ${campo.unidade} contabilizados; total real desconhecido`;
}
function nomePlano(id:string,nomes:Record<string,string>){return nomes[id]??`Plano ${id.slice(0,8)}`;}
function textoEstadoComparacao(estado:PontoHistoricoMicronutrienteFactual['comparacaoAnterior']['planejamento']){
 if(estado==='IGUAL')return 'Igual';if(estado==='DIFERENTE')return 'Diferente';
 if(estado==='NAO_COMPARAVEL')return 'Não comparável';return 'Sem registro mais antigo';
}
function graficoPontos(itens:PontoHistoricoMicronutrienteFactual[],codigo:CodigoMicronutrienteApi){
 const pontos=itens.filter(p=>p.nutrientes[codigo].estado==='COMPLETO'&&p.nutrientes[codigo].valor!==undefined);
 if(!pontos.length)return null;
 const tempos=pontos.map(p=>Date.parse(p.registro.criadoEm)),min=Math.min(...tempos),max=Math.max(...tempos),valores=pontos.map(p=>p.nutrientes[codigo].valor!),maxValor=Math.max(...valores,1);
 return pontos.map((p,i)=>({p,x:timposX(tempos[i],min,max,i,pontos.length),y:112-(p.nutrientes[codigo].valor!/maxValor)*90}));
}
function timposX(t:number,min:number,max:number,i:number,total:number){return min===max?40+(total<=1?0:i*520/Math.max(1,total-1)):40+((t-min)/(max-min))*520;}

export function HistoricoMicronutrientesFactuais({pacienteId,nomesPlanos,leituraPermitida,aoInvalidar}:Props){
 const id=useId(),[aberto,setAberto]=useState(false),[codigo,setCodigo]=useState<CodigoMicronutrienteApi>('ferroMg');
 const [itens,setItens]=useState<PontoHistoricoMicronutrienteFactual[]>([]),[cursor,setCursor]=useState<CursorHistoricoMicronutrientesFactual>(),[temMais,setTemMais]=useState(false);
 const [carregando,setCarregando]=useState(false),[erro,setErro]=useState(false),controle=useRef<AbortController|null>(null),geracao=useRef(0);
 const cancelar=useCallback(()=>{geracao.current++;controle.current?.abort();controle.current=null;setCarregando(false);},[]);
 const carregar=useCallback(async(proximo?:CursorHistoricoMicronutrientesFactual)=>{
  if(!leituraPermitida||carregando)return;
  cancelar();const atual=geracao.current,controller=new AbortController();controle.current=controller;setCarregando(true);setErro(false);
  try{
   const pagina=await obterHistoricoMicronutrientesFactual(pacienteId,proximo,controller.signal);
   if(controller.signal.aborted||atual!==geracao.current)return;
   setItens(v=>proximo?[...v,...pagina.itens]:pagina.itens);setTemMais(pagina.temMais);setCursor(pagina.proximoCursor);setErro(false);
  }catch(e){if(controller.signal.aborted||atual!==geracao.current)return;setErro(true);if(e instanceof ErroApiPlanoAlimentar&&(e.status===403||e.status===404)){setItens([]);aoInvalidar(e.status);}}
  finally{if(!controller.signal.aborted&&atual===geracao.current){setCarregando(false);controle.current=null;}}
 },[aoInvalidar,cancelar,carregando,leituraPermitida,pacienteId]);
 useEffect(()=>{if(!leituraPermitida){geracao.current++;controle.current?.abort();controle.current=null;}},[leituraPermitida]);
 useEffect(()=>()=>{controle.current?.abort();},[]);
 const pontos=useMemo(()=>graficoPontos(itens,codigo),[itens,codigo]);
 return <section aria-label="Histórico de micronutrientes planejados" className="grid min-w-0 gap-2 rounded border border-linha p-3">
  <button type="button" aria-expanded={aberto} aria-controls={id} disabled={!leituraPermitida} className="min-h-11 text-left font-semibold text-primaria underline disabled:text-texto-suave" onClick={()=>{const proximo=!aberto;setAberto(proximo);if(proximo&&!itens.length)void carregar();}}>
   {aberto?'Fechar histórico de micronutrientes':'Ver histórico de micronutrientes'}
  </button>
  <div id={id} hidden={!aberto}>
   {aberto?<div className="grid min-w-0 gap-3">
    <p className="text-sm text-texto-suave">Registros de composição planejada, não de consumo real. Cada ponto corresponde a uma análise salva; não há interpolação entre datas. RDA/AI/UL permanecem indisponíveis.</p>
    <label className="grid gap-1 text-sm">Nutriente no histórico<select className="min-h-11 rounded border border-linha bg-white px-2" value={codigo} onChange={e=>setCodigo(e.target.value as CodigoMicronutrienteApi)}>{CAMPOS_MICRONUTRIENTES_PLANO.map(c=><option key={c.codigo} value={c.codigo}>{c.rotulo} ({c.unidade})</option>)}</select></label>
    {leituraPermitida&&carregando&&!itens.length?<p role="status">Carregando registros autorizados…</p>:null}
    {leituraPermitida&&erro?<div role="alert" className="grid gap-1"><p>Não foi possível carregar o histórico. O acesso e os registros não foram alterados.</p><button type="button" className="min-h-11 text-left text-primaria underline" onClick={()=>void carregar(cursor)}>Tentar novamente</button></div>:null}
    {leituraPermitida&&!carregando&&!erro&&!itens.length?<p role="status">Ainda não há análises factuais salvas para este paciente.</p>:null}
    {leituraPermitida&&itens.length?<>
     <ComparacaoRegistrosFactuais pacienteId={pacienteId} itens={itens} nomesPlanos={nomesPlanos} leituraPermitida={leituraPermitida} aoInvalidar={aoInvalidar}/>
     {pontos?.length?<figure className="grid min-w-0 gap-1"><figcaption className="text-sm font-medium">Valores completos registrados de {ROTULOS.get(codigo)?.rotulo}. Os pontos não são ligados nem representam evolução clínica.</figcaption><svg role="img" aria-labelledby={`${id}-titulo ${id}-descricao`} viewBox="0 0 600 140" className="h-36 w-full" preserveAspectRatio="none"><title id={`${id}-titulo`}>Registros de {ROTULOS.get(codigo)?.rotulo}</title><desc id={`${id}-descricao`}>{pontos.length} pontos completos em análises factuais distintas, sem linha de tendência ou interpolação.</desc><line x1="32" y1="116" x2="580" y2="116" stroke="currentColor" strokeWidth="1" />{pontos.map(({p,x,y})=><circle key={p.registro.id} cx={x} cy={y} r="5" fill="currentColor"><title>{DATA.format(new Date(p.registro.criadoEm))}: {exibirValor(p,codigo)}</title></circle>)}</svg><p className="text-xs text-texto-suave">O eixo horizontal representa a data do registro; a tabela abaixo preserva versões, cobertura e lacunas. Diferença de composição não estabelece a causa.</p></figure>:<p className="text-sm text-texto-suave">Não há valores completos para desenhar pontos. Registros parciais e desconhecidos continuam visíveis na tabela.</p>}
     <div tabIndex={0} role="region" aria-label="Tabela acessível do histórico de micronutrientes" className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria"><table className="w-full min-w-[58rem] border-collapse text-left text-sm"><caption className="sr-only">Análises factuais salvas, por data, plano e versão</caption><thead><tr>{['Data do registro','Plano e versão','Estado da versão','Micronutriente','Cobertura','Base documentada','Comparação documental com a análise mais antiga seguinte'].map(t=><th key={t} scope="col" className="border-b border-linha p-2">{t}</th>)}</tr></thead><tbody>{itens.map((p,indice)=>{const n=p.nutrientes[codigo],c=p.comparacaoAnterior;return <tr key={p.registro.id}><th scope="row" className="border-b border-linha p-2">Análise {indice+1} · {DATA.format(new Date(p.registro.criadoEm))}</th><td className="border-b border-linha p-2">{nomePlano(p.origem.planoId,nomesPlanos)} · versão {p.origem.numero}</td><td className="border-b border-linha p-2">{p.origem.status==='publicada'?'Publicada':'Rascunho'}{p.origem.rascunhoRevisao?` · revisão ${p.origem.rascunhoRevisao}`:''}</td><td className="border-b border-linha p-2 tabular-nums">{exibirValor(p,codigo)}</td><td className="border-b border-linha p-2">{n.estado==='COMPLETO'?'Completa':n.estado==='PARCIAL'?`Parcial · ${n.contagens.conhecidos}/${n.contagens.incluidos} conhecidos`:n.estado==='DESCONHECIDO'?'Desconhecida':n.estado==='INCOMPATIVEL'?'Incompatível':'Indisponível'}</td><td className="border-b border-linha p-2">Planejamento {p.bases.planejamentoDocumentado?'documentado':'não documentado'}; composição {p.bases.composicaoDocumentada?'documentada':'não documentada'}; motor {p.motorVersao}</td><td className="border-b border-linha p-2"><details><summary className="cursor-pointer">Ver dimensões</summary><dl className="mt-2 grid gap-1"><div><dt className="inline font-medium">Planejamento: </dt><dd className="inline">{textoEstadoComparacao(c.planejamento)}</dd></div><div><dt className="inline font-medium">Composição e fonte: </dt><dd className="inline">{textoEstadoComparacao(c.composicaoFonte)}{c.composicaoFonte==='DIFERENTE'?' (a causa não é determinada)':''}</dd></div><div><dt className="inline font-medium">Referência: </dt><dd className="inline">{textoEstadoComparacao(c.referencia)}</dd></div><div><dt className="inline font-medium">Contexto: </dt><dd className="inline">{textoEstadoComparacao(c.contexto)}</dd></div><div><dt className="inline font-medium">Cobertura de {ROTULOS.get(codigo)?.rotulo}: </dt><dd className="inline">{textoEstadoComparacao(c.cobertura[codigo])}</dd></div></dl><p className="mt-2 text-xs text-texto-suave">A comparação só verifica se os registros documentais coincidem; o contexto inclui data e confirmações registradas. Diferenças não identificam causa clínica nem comprovam mudança de consumo.</p></details></td></tr>;})}</tbody></table></div>
     {temMais?<button type="button" className="min-h-11 text-left text-primaria underline disabled:text-texto-suave" disabled={carregando||!cursor} onClick={()=>cursor&&void carregar(cursor)}>{carregando?'Carregando…':'Carregar registros anteriores'}</button>:<p role="status">Fim do histórico disponível.</p>}
    </>:null}
   </div>:null}
  </div>
 </section>;
}
