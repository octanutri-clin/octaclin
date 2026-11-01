'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Botao} from '@/components/ui/botao';
import {Campo,Selecao} from '@/components/ui/campo';
import {Modal} from '@/components/ui/modal';
import {buscarAlimentosPlanoAlimentar,type AlimentoComposicaoApi} from '@/lib/plano-alimentar-api';
import {preverMicronutrientesPlano,type PedidoPreviaMicronutrientes,type PreviaMicronutrientes} from '@/lib/previa-micronutrientes-plano';
import {ComparacaoPreviaAlimentar} from './comparacao-previa-alimentar';
interface Props {
 pacienteId:string;planoId:string;contexto:string;descricao:string;refeicaoNome:string;
 pedido:PedidoPreviaMicronutrientes;podeEditar:boolean;bloqueio?:string;
 conferirBase:()=>boolean;
 aoConfirmar:(p:PedidoPreviaMicronutrientes,fingerprint:string,signal:AbortSignal)=>Promise<boolean>;
 aoInvalidar:(status:number)=>void;
}
function numero(v:string){return /^\d+(?:[.,]\d{1,3})?$/.test(v.trim())?Number(v.trim().replace(',','.')):NaN;}
export function PreviaAlteracaoAlimentar({pacienteId,planoId,contexto,descricao,refeicaoNome,pedido,podeEditar,bloqueio,conferirBase,aoConfirmar,aoInvalidar}:Props){
 const id=useId();
 const [aberto,setAberto]=useState(false),[tipo,setTipo]=useState<'definir_porcao_manual'|'substituir_catalogo'>('definir_porcao_manual');
 const [gramas,setGramas]=useState(String(pedido.operacao.porcaoGramas).replace('.',',')),[quantidade,setQuantidade]=useState(String(pedido.operacao.quantidade).replace('.',',')),[unidade,setUnidade]=useState(pedido.operacao.unidade);
 const [busca,setBusca]=useState(''),[resultados,setResultados]=useState<AlimentoComposicaoApi[]>([]),[alimento,setAlimento]=useState<AlimentoComposicaoApi|null>(null);
 const [previa,setPrevia]=useState<{dados:PreviaMicronutrientes;pedido:PedidoPreviaMicronutrientes}|null>(null),[erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState<'previa'|'confirmando'|null>(null);
 const controle=useRef<AbortController|null>(null),geracao=useRef(0);
 const podeRef=useRef(podeEditar);useLayoutEffect(()=>{podeRef.current=podeEditar;});
 function invalidar(){geracao.current++;controle.current?.abort();controle.current=null;setPrevia(null);setOcupado(null);}
 function fechar(){if(ocupado==='confirmando')return;invalidar();setErro(null);setAberto(false);}
 useEffect(()=>()=>{geracao.current++;controle.current?.abort();},[contexto]);
 useEffect(()=>{if(!aberto||tipo!=='substituir_catalogo'||busca.trim().length<2)return;
  const c=new AbortController();const t=setTimeout(()=>{void buscarAlimentosPlanoAlimentar(pacienteId,{busca:busca.trim(),pagina:1,limite:20},c.signal).then(r=>{if(!c.signal.aborted)setResultados(r.itens);}).catch(()=>{if(!c.signal.aborted)setErro('Não foi possível consultar o catálogo.');});},350);
  return()=>{clearTimeout(t);c.abort();};
 },[aberto,tipo,busca,pacienteId]);
 function alterar(tarefa:()=>void){invalidar();setErro(null);tarefa();}
 async function calcular(){
  if(!podeRef.current||bloqueio||!conferirBase())return;
  invalidar();setErro(null);
  const q=numero(quantidade),g=numero(gramas);
  if(!Number.isFinite(q)||!Number.isFinite(g)||q<0.001||g<0.001||q>10000||g>10000||!unidade.trim()||unidade.length>40||(tipo==='substituir_catalogo'&&!alimento)) {setErro('Informe quantidade e peso entre 0,001 e 10.000, com até três casas decimais, uma unidade e o alimento de destino.');return;}
  const p:PedidoPreviaMicronutrientes={...pedido,operacao:{...pedido.operacao,tipo,quantidade:q,porcaoGramas:g,unidade:unidade.trim(),...(tipo==='substituir_catalogo'?{alimentoComposicaoId:alimento!.id}:{})}};
  const c=new AbortController();controle.current=c;const seq=++geracao.current;setOcupado('previa');
  try{const dados=await preverMicronutrientesPlano(pacienteId,planoId,p,c.signal);if(!c.signal.aborted&&seq===geracao.current&&podeRef.current)setPrevia({dados,pedido:p});}
  catch(e){if(!c.signal.aborted&&seq===geracao.current){setErro('Não foi possível conferir a prévia. Confira o acesso, a fonte e a versão salva antes de tentar novamente.');const status=typeof e==='object'&&e?Reflect.get(e,'status'):0;if([401,403,404,409].includes(status))aoInvalidar(status);}}
  finally{if(seq===geracao.current)setOcupado(null);}
 }
 async function confirmar(){
  if(!previa||ocupado||bloqueio||!podeRef.current||!conferirBase())return;
  // Comando confirmado pertence ao pai e ao dreno PA07. Desmontar a prévia
  // não cancela o transporte nem promete desfazer a gravação recebida.
  const c=new AbortController();const seq=++geracao.current;setOcupado('confirmando');setErro(null);
  try{const salvo=await aoConfirmar(previa.pedido,previa.dados.fingerprint,c.signal);if(!c.signal.aborted&&seq===geracao.current){if(salvo){setPrevia(null);setAberto(false);}else{setPrevia(null);setErro('A alteração não foi confirmada. Confira o rascunho antes de simular novamente.');}}}
  catch{if(!c.signal.aborted&&seq===geracao.current){setPrevia(null);setErro('A confirmação não pôde ser concluída. Confira o rascunho antes de tentar novamente.');}}
  finally{if(seq===geracao.current)setOcupado(null);}
 }
 return <div className="grid gap-1">
  <Botao type="button" variante="secundario" tamanho="sm" disabled={!podeEditar||Boolean(bloqueio)} aria-label={`Simular alteração de ${descricao}`} onClick={()=>{invalidar();setErro(null);setAberto(true);}}>Simular alteração</Botao>
  {bloqueio?<p className="text-xs text-texto-suave">{bloqueio}</p>:null}
  <Modal aberto={aberto&&podeEditar} aoFechar={fechar} titulo="Simular alteração alimentar" descricao="Compare a alimentação planejada antes de confirmar. A simulação não altera o plano." className="max-w-3xl">
   <div className="grid min-w-0 gap-3">
    {bloqueio?<p role="status" className="text-sm">{bloqueio}</p>:null}
    <p className="text-sm">{refeicaoNome} · Origem: {descricao} · Rascunho salvo, revisão {pedido.rascunhoRevisaoEsperada}.</p>
    <p className="text-sm">Porção atual: {new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(pedido.operacao.quantidade)} {pedido.operacao.unidade} · {new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(pedido.operacao.porcaoGramas)} g.</p>
    <fieldset disabled={ocupado==='confirmando'} className="grid gap-3">
     <div className="grid gap-1 text-sm"><label htmlFor={`${id}-tipo`}>Operação</label><Selecao id={`${id}-tipo`} value={tipo} onChange={e=>alterar(()=>{setTipo(e.target.value as typeof tipo);setResultados([]);})}><option value="definir_porcao_manual">Alterar porção em gramas</option><option value="substituir_catalogo">Trocar por alimento do catálogo</option></Selecao></div>
     {tipo==='substituir_catalogo'?<div className="grid gap-2">
      <label className="grid gap-1 text-sm">Buscar alimento de destino<Campo value={busca} onChange={e=>alterar(()=>{setBusca(e.target.value);setResultados([]);setAlimento(null);})} maxLength={100}/></label>
      <p className="text-xs text-texto-suave">Até 20 resultados por busca. Confira o preparo e a fonte; refine o nome para localizar outros alimentos.</p>
      <ul className="grid gap-1">{resultados.map(a=><li key={a.id}><Botao type="button" variante="secundario" disabled={!a.disponivelParaCalculo} onClick={()=>alterar(()=>{setAlimento(a);setResultados([]);})}>{a.nome}{a.preparacao?` · ${a.preparacao}`:''}{a.fonte?` · ${a.fonte.nome} ${a.fonte.versao}`:''}</Botao></li>)}</ul>
      {alimento?<p className="text-sm">Destino: {alimento.nome}{alimento.preparacao?` · ${alimento.preparacao}`:''}</p>:null}
     </div>:null}
     <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">Quantidade proposta<Campo inputMode="decimal" value={quantidade} onChange={e=>alterar(()=>setQuantidade(e.target.value))} maxLength={16}/></label>
      <label className="grid gap-1 text-sm">Unidade proposta<Campo value={unidade} onChange={e=>alterar(()=>setUnidade(e.target.value))} maxLength={40}/></label>
      <label className="grid gap-1 text-sm">Peso proposto (g)<Campo inputMode="decimal" value={gramas} onChange={e=>alterar(()=>setGramas(e.target.value))} maxLength={16}/></label>
     </div>
     <p className="text-xs text-texto-suave">Peso em gramas explícito. Esta operação desvincula a medida caseira do item; não calcula conversões automaticamente.</p>
     <Botao type="button" onClick={()=>void calcular()} disabled={Boolean(ocupado)||Boolean(bloqueio)}>{ocupado==='previa'?'Calculando prévia…':'Calcular prévia'}</Botao>
    </fieldset>
    {erro?<p role="alert" className="text-sm">{erro}</p>:null}
    {previa&&!bloqueio?<>
     <p className="text-sm">Proposta: {quantidade} {unidade} · {gramas} g{alimento&&tipo==='substituir_catalogo'?` de ${alimento.nome}`:''}. Apenas refeições e plano ativos entram nos totais.</p>
     <ComparacaoPreviaAlimentar dados={previa.dados}/>
     <Botao type="button" onClick={()=>void confirmar()} disabled={Boolean(ocupado)||Boolean(bloqueio)}>Confirmar alteração no rascunho</Botao>
    </>:null}
    {ocupado==='confirmando'?<p role="status">Confirmando e conferindo o rascunho. Aguarde antes de sair.</p>:null}
    <Botao type="button" variante="secundario" onClick={fechar} disabled={ocupado==='confirmando'}>Cancelar</Botao>
   </div>
  </Modal>
 </div>;
}
