'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { obterVersaoPlanoAlimentar, ErroApiPlanoAlimentar } from '@/lib/plano-alimentar-api';
import { lerOrigemContribuicao, type OrigemContribuicao, type ReferenciaOrigemContribuicao } from '@/lib/origem-contribuicao';
interface Props {pacienteId:string;planoId:string;referencia:ReferenciaOrigemContribuicao;aoFechar:()=>void;aoInvalidar:(status:number)=>void}
export function OrigemContribuicaoPublicada({pacienteId,planoId,referencia,aoFechar,aoInvalidar}:Props){
 const [estado,setEstado]=useState<{dados?:OrigemContribuicao;falha?:boolean}>({});
 const corpo=JSON.stringify(referencia);
 useEffect(()=>{
  const controller=new AbortController(),ref=JSON.parse(corpo) as ReferenciaOrigemContribuicao;
  void obterVersaoPlanoAlimentar(pacienteId,planoId,ref.versaoNumero,controller.signal).then(v=>{
   if(!controller.signal.aborted)setEstado({dados:lerOrigemContribuicao(v,ref)});
  }).catch((e:unknown)=>{
   if(controller.signal.aborted)return;
   if(e instanceof ErroApiPlanoAlimentar&&[403,404,409].includes(e.status)){aoInvalidar(e.status);return;}
   setEstado({falha:true});
  });
  return()=>controller.abort();
 },[pacienteId,planoId,corpo,aoInvalidar]);
 const numero=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(v);
 return <Modal aberto aoFechar={aoFechar} titulo="Origem publicada" descricao="Consulta da refeição original. Seu rascunho e as quantidades salvas permanecem preservados.">
  {estado.falha?<p role="alert">Não foi possível confirmar a origem publicada. Feche e tente novamente.</p>:estado.dados?<div className="grid gap-3"><p>Versão {estado.dados.numero} — {estado.dados.nome}</p><ul className="grid gap-3">{estado.dados.itens.map(i=><li key={i.id} className="border-b border-linha pb-2"><strong>{i.descricao}</strong>{i.id===referencia.itemId?<p>Alimento consultado</p>:null}<p>{numero(i.quantidade)} {i.unidade} · {numero(i.gramas)} g já considerados</p></li>)}</ul></div>:<p role="status">Carregando origem publicada…</p>}
 </Modal>;
}
