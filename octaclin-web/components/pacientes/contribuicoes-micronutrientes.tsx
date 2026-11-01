'use client';
import { useEffect, useId, useState } from 'react';
import { obterContribuicoesMicronutrientes } from '@/lib/calculo-combinado-planos-api';
import { mesmaCoberturaFactual, type PaginaContribuicoes } from '@/lib/contribuicoes-micronutrientes';
import { ErroApiPlanoAlimentar, type CalcularCombinadoEntradaApi } from '@/lib/plano-alimentar-api';
import type { LinhaMicronutrienteFactual } from '@/lib/micronutrientes-factuais';
import { formatarNutrientePlano } from '@/lib/micronutrientes-plano';
interface Props {pacienteId:string;entrada:CalcularCombinadoEntradaApi;linha:LinhaMicronutrienteFactual;nomesPlanos:Record<string,string>;aoInvalidar:(status:number)=>void}
function valor(l:LinhaMicronutrienteFactual){return l.valor===undefined?'Composição desconhecida':`${formatarNutrientePlano(l.codigo,l.valor)} ${l.unidade}${l.estado==='COMPLETO'?'':' contabilizados; total real desconhecido'}`;}
export function ContribuicoesMicronutrientes({pacienteId,entrada,linha,nomesPlanos,aoInvalidar}:Props){
  const id=useId(),[aberto,setAberto]=useState(false),[pagina,setPagina]=useState(1),[tentativa,setTentativa]=useState(0);
  const [armazenado,setArmazenado]=useState<{chave:string;dados:PaginaContribuicoes}|null>(null),[falha,setFalha]=useState<string|null>(null);
  const corpo=JSON.stringify({...entrada,codigo:linha.codigo,pagina,limite:25});
  const chave=JSON.stringify([pacienteId,corpo,tentativa]);
  const dados=armazenado?.chave===chave?armazenado.dados:null;
  useEffect(()=>{
    if(!aberto)return;
    const controller=new AbortController();
    void obterContribuicoesMicronutrientes(pacienteId,JSON.parse(corpo),controller.signal).then(d=>{
      if(!controller.signal.aborted){
        if(!mesmaCoberturaFactual(d.cobertura,linha)){setFalha(chave);return;}
        setArmazenado({chave,dados:d});
      }
    }).catch((e:unknown)=>{
      if(controller.signal.aborted)return;
      if(e instanceof ErroApiPlanoAlimentar&&(e.status===403||e.status===404||e.status===409)){aoInvalidar(e.status);return;}
      setFalha(chave);
    });
    return()=>controller.abort();
  },[aberto,pacienteId,corpo,chave,linha,aoInvalidar]);
  const numero=(v:string)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(v));
  return <div className="grid gap-2">
    <button type="button" aria-expanded={aberto} aria-controls={id} className="min-h-11 text-left text-primaria underline" onClick={()=>{setAberto(!aberto);setTentativa(v=>v+1);}}>{aberto?'Fechar':'Ver'} alimentos de {linha.rotulo}</button>
    {aberto?<section id={id} aria-label={`Alimentos de ${linha.rotulo}`} className="grid gap-3 border-l border-linha pl-2">
      <p>Seleção planejada: {valor(linha)}. Quantidades já ajustadas à porção salva.</p>
      <p className="text-xs text-texto-suave">Ordem do plano publicado. Uma página pode conter parte de uma refeição; seu subtotal considera todos os alimentos selecionados daquela refeição. A composição conhecida não indica adequação clínica.</p>
      {falha===chave?<><p role="alert">Não foi possível carregar contribuições válidas.</p><button type="button" className="min-h-11 text-left text-primaria underline" onClick={()=>setTentativa(v=>v+1)}>Tentar alimentos de {linha.rotulo} novamente</button></>:!dados?<p role="status">Carregando alimentos…</p>:null}
      {dados&&falha!==chave?<>
        <p role="status">Página {dados.pagina} de {Math.max(1,Math.ceil(dados.total/dados.limite))}: {dados.total} alimentos na seleção inteira. {dados.total?`Mostrando ${(pagina-1)*dados.limite+1}–${Math.min(pagina*dados.limite,dados.total)} de ${dados.total}.`:null}</p>
        {dados.refeicoes.map(r=><details open key={`${r.planoId}:${r.id}`}><summary className="min-h-11 cursor-pointer py-2 font-medium">{nomesPlanos[r.planoId]??'Plano da seleção'} — {r.nome}: {valor(r.cobertura)}</summary><ul className="grid gap-3">{r.itens.map(i=><li key={i.id} className="grid gap-1 border-b border-linha py-2"><strong>{i.descricao}</strong><p>{numero(i.quantidade)} {i.unidade} · peso já considerado no cálculo: {numero(i.gramas)} g</p><p>{linha.rotulo}: {valor(i.cobertura)}</p></li>)}</ul></details>)}
        {!dados.total?<p>Nenhum alimento ativo incluído.</p>:null}
        <nav aria-label={`Páginas de alimentos de ${linha.rotulo}`} className="flex flex-wrap gap-3">
          <button type="button" className="min-h-11 text-primaria underline disabled:text-texto-suave" aria-label={`Página anterior de ${linha.rotulo}`} disabled={pagina<=1} onClick={()=>setPagina(v=>v-1)}>Anterior</button>
          <button type="button" className="min-h-11 text-primaria underline disabled:text-texto-suave" aria-label={`Próxima página de ${linha.rotulo}`} disabled={pagina*dados.limite>=dados.total} onClick={()=>setPagina(v=>v+1)}>Próxima</button>
        </nav>
      </>:null}
    </section>:null}
  </div>;
}
