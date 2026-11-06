'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Botao} from '@/components/ui/botao';
import {preverMicronutrientesPlano,type PedidoPreviaReceita,type PreviaMicronutrientes} from '@/lib/previa-micronutrientes-plano';
import {ComparacaoPreviaAlimentar} from './comparacao-previa-alimentar';
interface Props {
 pacienteId:string;planoId:string;contexto:string;receitaNome:string;refeicaoNome:string;pedido:PedidoPreviaReceita;
 podeEditar:boolean;bloqueio?:string;conferirBase:()=>boolean;
 aoConfirmar:(p:PedidoPreviaReceita,fingerprint:string,signal:AbortSignal)=>Promise<boolean>;
 aoInvalidar:(status:number)=>void;aoAtivar:(ativo:boolean)=>void;aoConfirmando:(confirmando:boolean)=>void;aoConcluir:()=>void;
}
export function PreviaReceitaPlano({pacienteId,planoId,contexto,receitaNome,refeicaoNome,pedido,podeEditar,bloqueio,conferirBase,aoConfirmar,aoInvalidar,aoAtivar,aoConfirmando,aoConcluir}:Props){
 const [dados,setDados]=useState<PreviaMicronutrientes|null>(null),[erro,setErro]=useState<string|null>(null),[ocupado,setOcupado]=useState<'previa'|'confirmando'|null>(null);
 const controle=useRef<AbortController|null>(null),geracao=useRef(0),podeRef=useRef(podeEditar);
 useLayoutEffect(()=>{podeRef.current=podeEditar;});
 useEffect(()=>()=>{geracao.current++;controle.current?.abort();},[contexto]);
 function descartar(){if(ocupado==='confirmando')return;geracao.current++;controle.current?.abort();controle.current=null;setDados(null);setErro(null);setOcupado(null);aoAtivar(false);}
 async function calcular(){
  if(ocupado||bloqueio||!podeRef.current||!conferirBase())return;
  const c=new AbortController();controle.current?.abort();controle.current=c;const seq=++geracao.current;
  setDados(null);setErro(null);setOcupado('previa');aoAtivar(true);
  try{const r=await preverMicronutrientesPlano(pacienteId,planoId,pedido,c.signal);if(!c.signal.aborted&&seq===geracao.current&&podeRef.current&&conferirBase())setDados(r);}
  catch(e){if(!c.signal.aborted&&seq===geracao.current){setErro('Não foi possível conferir o impacto. Confira o acesso, a receita e a versão salva antes de tentar novamente.');const status=typeof e==='object'&&e?Reflect.get(e,'status'):0;if([401,403,404,409].includes(status))aoInvalidar(status);}}
  finally{if(seq===geracao.current)setOcupado(null);}
 }
 async function confirmar(){
  if(!dados||ocupado||bloqueio||!podeRef.current||!conferirBase())return;
  // O pai mantém comando e dreno PA07; fechar/desmontar não cancela gravação recebida.
  const c=new AbortController();const seq=++geracao.current;setOcupado('confirmando');setErro(null);aoConfirmando(true);
  try{const salvo=await aoConfirmar(pedido,dados.fingerprint,c.signal);if(salvo)aoConcluir();else if(seq===geracao.current){setDados(null);setErro('O impacto não foi confirmado. Confira o rascunho antes de simular novamente.');}}
  catch{if(seq===geracao.current){setDados(null);setErro('Não foi possível confirmar a inserção. Confira o rascunho antes de tentar novamente.');}}
  finally{aoConfirmando(false);if(seq===geracao.current)setOcupado(null);}
 }
 return <section aria-label="Impacto da receita no planejamento" className="grid min-w-0 gap-3 border-t border-linha pt-3">
  <h3 className="font-semibold">Impacto no rascunho salvo</h3>
  <p className="text-sm">{receitaNome} · versão {pedido.operacao.receitaVersaoEsperada} · {new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(pedido.operacao.porcoesDesejadas)} porções · destino: {refeicaoNome}.</p>
  <p className="text-xs text-texto-suave">A comparação acrescenta a receita uma vez às refeições ativas. A biblioteca é preservada; a publicação exige outra confirmação.</p>
  {bloqueio?<p role="status" className="text-sm">{bloqueio}</p>:null}
  {!podeEditar?<p role="status" className="text-sm">Retome a edição nesta aba antes de simular.</p>:null}
  <Botao type="button" variante="secundario" onClick={()=>void calcular()} disabled={!podeEditar||Boolean(bloqueio)||Boolean(ocupado)}>Calcular impacto no rascunho</Botao>
  {ocupado?<p role="status">{ocupado==='previa'?'Calculando impacto…':'Confirmando a inserção. Aguarde antes de sair.'}</p>:null}
  {erro?<p role="alert" className="text-sm">{erro}</p>:null}
  {dados&&!bloqueio&&podeEditar?<><ComparacaoPreviaAlimentar dados={dados}/><Botao type="button" onClick={()=>void confirmar()} disabled={Boolean(ocupado)}>Confirmar impacto e inserir no rascunho</Botao></>:null}
  <Botao type="button" variante="secundario" onClick={descartar} disabled={ocupado==='confirmando'}>Descartar comparação</Botao>
 </section>;
}
