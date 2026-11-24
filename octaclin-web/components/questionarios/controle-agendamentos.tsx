'use client';

import { useEffect, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { comandarAgendamentoQuestionario, listarAgendamentosQuestionario, ErroApiQuestionarios, type AgendamentoQuestionarioApi } from '@/lib/questionarios-api';

type Acao='pausar'|'retomar'|'reconfirmar';
const rotulos:Record<Acao,string>={pausar:'Pausar',retomar:'Retomar',reconfirmar:'Reconfirmar autorização'};
function mensagemFalha(e:unknown){
  if(e instanceof ErroApiQuestionarios&&e.status===409)return 'O agendamento mudou. Atualize a lista e confirme novamente.';
  if(e instanceof ErroApiQuestionarios&&[401,403].includes(e.status))return 'Seu acesso mudou. Confira suas permissões e entre novamente, se necessário.';
  return 'Não foi possível concluir. Atualize a lista e tente novamente.';
}
const estados={ativo:'Ativo',pausado:'Pausado',encerrado:'Encerrado',inativo_legado:'Inativo anterior'};
function data(valor:string|null,fuso:string){
  return valor ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:fuso}).format(new Date(valor)) : 'Sem próxima ocorrência';
}
function frequencia(a:AgendamentoQuestionarioApi){
  if(!a.regraCron)return 'Envio único';
  const partes=/^(\d{1,2}) (\d{1,2}) \* \* (\*|[0-6])$/.exec(a.regraCron);
  if(!partes)return 'Recorrência personalizada';
  const dias=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  return `${partes[3]==='*'?'Todos os dias':`Toda semana: ${dias[Number(partes[3])]}`} às ${partes[2].padStart(2,'0')}:${partes[1].padStart(2,'0')}`;
}

/** Montar com key(questionário,paciente): não transportar ACK/seleção ao trocar contexto. */
export function ControleAgendamentos({questionarioId,titulo,pacienteId,pacienteNome}:{questionarioId:string;titulo:string;pacienteId:string;pacienteNome:string}){
  const [lista,setLista]=useState<AgendamentoQuestionarioApi[]|null>(null);
  const [pagina,setPagina]=useState(1),[temMais,setTemMais]=useState(false);
  const [ocupado,setOcupado]=useState(false),[erro,setErro]=useState(''),[aviso,setAviso]=useState('');
  const [previa,setPrevia]=useState<{a:AgendamentoQuestionarioApi;acao:Acao}|null>(null);
  const geracao=useRef(0),ativo=useRef(true),atualizarRef=useRef<HTMLButtonElement>(null),confirmarRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{ativo.current=true;return()=>{ativo.current=false;};},[]);
  useEffect(()=>{if(previa)confirmarRef.current?.focus();},[previa]);
  async function carregar(proxima=1){
    const g=++geracao.current;setOcupado(true);setErro('');setPrevia(null);setAviso('');
    try{
      const r=await listarAgendamentosQuestionario(questionarioId,pacienteId,proxima);
      if(!ativo.current||g!==geracao.current)return;
      setLista(r.itens);setPagina(r.pagina);setTemMais(r.temMais);
    }catch(e){if(ativo.current&&g===geracao.current){setErro(mensagemFalha(e));setLista(null);}}
    finally{if(ativo.current&&g===geracao.current){setOcupado(false);atualizarRef.current?.focus();}}
  }
  async function confirmar(){
    if(!previa||ocupado)return;
    const g=++geracao.current;const {a,acao}=previa;setOcupado(true);setErro('');setAviso('');
    try{
      const ack=await comandarAgendamentoQuestionario(questionarioId,a,acao);
      if(!ativo.current||g!==geracao.current)return;
      setLista(anterior=>anterior?.map(item=>item.id===ack.id?ack:item)??null);
      setPrevia(null);setAviso('Agendamento atualizado. Envios e links anteriores foram preservados.');
    }catch(e){if(ativo.current&&g===geracao.current){setPrevia(null);setLista(null);setErro(mensagemFalha(e));}}
    finally{if(ativo.current&&g===geracao.current){setOcupado(false);atualizarRef.current?.focus();}}
  }
  return <section aria-label="Gerenciar retornos recorrentes" className="min-w-0 border-t border-linha p-4 space-y-3 [overflow-wrap:anywhere] [&_button]:max-w-full [&_button]:whitespace-normal">
    <h3 className="font-semibold text-tinta">Agendamentos deste paciente</h3>
    <p className="text-sm text-texto-suave">Pausar impede novos envios. Os links e as respostas existentes não serão alterados; os prazos de validade continuam os mesmos.</p>
    <Botao ref={atualizarRef} type="button" variante="secundario" disabled={ocupado} onClick={()=>void carregar(pagina)}>Atualizar agendamentos</Botao>
    {ocupado?<p role="status">Aguarde a confirmação do servidor…</p>:null}
    {erro?<p role="alert">{erro}</p>:null}{aviso?<p role="status">{aviso}</p>:null}
    {lista?.length===0?<p>Nenhum agendamento para este paciente e formulário.</p>:null}
    {lista?.map(a=><article key={a.id} className="border border-linha rounded-md p-3 space-y-2" aria-label={`Agendamento: ${frequencia(a)}`}>
      <h4 className="font-medium">{frequencia(a)}</h4>
      <p>{estados[a.estado]}{a.reconfirmacaoNecessaria?' · Reconfirmação necessária':''}</p>
      <p className="text-sm">Próxima execução: {data(a.proximaExecucaoEm,a.timezone)} ({a.timezone})</p>
      {a.reconfirmacaoNecessaria?<p className="text-sm">Novos envios estão bloqueados até uma pessoa autorizada reconfirmar. Isso não retoma uma pausa.</p>:null}
      {a.estado==='pausado'&&!a.proximaOcorrenciaFutura?<p>Sem próxima ocorrência. Crie um novo agendamento para outro dia.</p>:null}
      <div className="flex flex-wrap gap-2">
        {a.estado==='ativo'?<Botao type="button" variante="secundario" disabled={ocupado||!!previa} onClick={()=>setPrevia({a,acao:'pausar'})}>Pausar</Botao>:null}
        {a.estado==='pausado'?<Botao type="button" variante="secundario" disabled={ocupado||!!previa||a.reconfirmacaoNecessaria||!a.proximaOcorrenciaFutura} onClick={()=>setPrevia({a,acao:'retomar'})}>Retomar</Botao>:null}
        <Botao type="button" variante="secundario" disabled={ocupado||!!previa} onClick={()=>setPrevia({a,acao:'reconfirmar'})}>Reconfirmar autorização</Botao>
      </div>
    </article>)}
    {lista?<nav aria-label="Páginas dos agendamentos" className="flex flex-wrap items-center gap-2">
      <Botao type="button" variante="secundario" disabled={ocupado||pagina===1} onClick={()=>void carregar(pagina-1)}>Agendamentos anteriores</Botao>
      <span>Página {pagina}</span>
      <Botao type="button" variante="secundario" disabled={ocupado||!temMais} onClick={()=>void carregar(pagina+1)}>Próximos agendamentos</Botao>
    </nav>:null}
    {previa?<fieldset className="min-w-0 border border-linha rounded-md p-3 space-y-2" disabled={ocupado}>
      <legend className="font-semibold">Conferir alteração do agendamento</legend>
      <p>Formulário: {titulo}. Paciente: {pacienteNome}.</p>
      <p>{frequencia(previa.a)}. Fuso: {previa.a.timezone}.</p>
      <p>Ação: {rotulos[previa.acao]}.</p>
      {previa.acao!=='pausar'?<p>Próxima ocorrência prevista: {data(previa.a.proximaOcorrenciaFutura,previa.a.timezone)}. A data será conferida novamente ao confirmar.</p>:null}
      {previa.acao==='pausar'?<p>Somente os novos envios serão interrompidos.</p>:previa.acao==='reconfirmar'&&previa.a.estado!=='ativo'?<p>A autorização será registrada. O agendamento continuará {estados[previa.a.estado].toLocaleLowerCase('pt-BR')}.</p>:<p>A próxima ocorrência será calculada ao confirmar, sempre no futuro. Ocorrências atrasadas não serão recuperadas.</p>}
      <div className="flex flex-wrap gap-2">
        <Botao ref={confirmarRef} type="button" onClick={()=>void confirmar()}>Confirmar alteração</Botao>
        <Botao type="button" variante="secundario" onClick={()=>{setPrevia(null);atualizarRef.current?.focus();}}>Cancelar alteração</Botao>
      </div>
    </fieldset>:null}
  </section>;
}
