'use client';
import { useState } from 'react';
import { confirmacoesContextoIniciais,type ConfirmacoesContextoFactual } from '@/lib/registro-analise-factual';
const CAMPO='min-h-11 rounded border border-linha bg-white px-2';
export function ConfirmacoesContextoFactual({desabilitado,aoConferir}:{desabilitado:boolean;aoConferir:(c?:ConfirmacoesContextoFactual)=>void}){
 const [incluir,setIncluir]=useState(false),[c,setC]=useState(confirmacoesContextoIniciais);
 return <fieldset disabled={desabilitado} className="grid gap-2"><legend className="sr-only">Contexto opcional da análise</legend>
  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={incluir} onChange={e=>{setIncluir(e.target.checked);setC(confirmacoesContextoIniciais());}}/>Registrar contexto desta análise</label>
  <p className="text-sm text-texto-suave">Opcional: você pode salvar somente os valores factuais. A comparação com referências é pedida na tabela; aqui só se registra o contexto. As confirmações não alteram o cadastro do paciente.</p>
  {incluir?<div className="grid gap-2 rounded border border-linha p-3">
   <p className="text-sm">A idade usa o nascimento cadastrado e a data local da clínica. Informações desconhecidas continuam desconhecidas; não estimamos condições clínicas.</p>
   <label className="grid gap-1">População de referência<select className={CAMPO} value={c.populacaoReferencia} onChange={e=>setC(v=>({...v,populacaoReferencia:e.target.value as ConfirmacoesContextoFactual['populacaoReferencia'],populacaoConfirmada:false}))}><option value="nao_informada">Não informada</option><option value="masculina">Masculina</option><option value="feminina">Feminina</option></select></label>
   <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={c.populacaoReferencia==='nao_informada'} checked={c.populacaoConfirmada} onChange={e=>setC(v=>({...v,populacaoConfirmada:e.target.checked}))}/>Conferi a população de referência para esta análise</label>
   {(['gestacao','lactacao'] as const).map(campo=><label key={campo} className="grid gap-1">{campo==='gestacao'?'Gestação':'Lactação'}<select className={CAMPO} value={c[campo]} onChange={e=>setC(v=>({...v,[campo]:e.target.value as ConfirmacoesContextoFactual[typeof campo]}))}><option value="nao_informada">Não informada</option><option value="nao">Não</option><option value="sim">Sim</option></select></label>)}
   <p className="text-sm">População prevista: 19 anos ou mais, sem gestação ou lactação. Fora desse escopo, os valores factuais ainda podem ser registrados.</p>
   <label className="grid gap-1">Aplicabilidade da população<select className={CAMPO} value={c.aplicabilidade} onChange={e=>setC(v=>({...v,aplicabilidade:e.target.value as ConfirmacoesContextoFactual['aplicabilidade']}))}><option value="nao_informada">Não informada</option><option value="confirmada">Confirmada para esta análise</option><option value="nao_aplicavel">Não aplicável</option></select></label>
   <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={c.mesmoDiaPlanejado} onChange={e=>setC(v=>({...v,mesmoDiaPlanejado:e.target.checked}))}/>As refeições selecionadas representam o mesmo dia planejado</label>
   <label className="grid gap-1">Tabagismo<select className={CAMPO} value={c.tabagismo} onChange={e=>setC(v=>({...v,tabagismo:e.target.value as ConfirmacoesContextoFactual['tabagismo']}))}><option value="nao_informado">Não informado</option><option value="nao">Não fuma</option><option value="sim">Fuma</option></select></label>
  </div>:null}
  <button type="button" className="min-h-11 text-left text-primaria underline disabled:text-texto-suave" onClick={()=>aoConferir(incluir?c:undefined)}>Conferir análise antes de salvar</button>
 </fieldset>;
}
const FISIOLOGIA={sim:'sim',nao:'não',nao_informada:'não informada'};
export function ResumoContextoFactual({confirmacoes:c}:{confirmacoes?:ConfirmacoesContextoFactual}){
 if(!c)return <p className="text-sm">Sem contexto informado nesta análise. Somente valores factuais serão registrados.</p>;
 return <div role="region" aria-label="Contexto a registrar" className="grid gap-1 text-sm">
  <p>População: {c.populacaoReferencia==='nao_informada'?'não informada':c.populacaoReferencia} · {c.populacaoConfirmada?'escolha conferida':'escolha não conferida'}</p>
  <p>Gestação: {FISIOLOGIA[c.gestacao]}. Lactação: {FISIOLOGIA[c.lactacao]}.</p>
  <p>Aplicabilidade: {c.aplicabilidade==='confirmada'?'confirmada':c.aplicabilidade==='nao_aplicavel'?'não aplicável':'não informada'}.</p>
  <p>Mesmo dia planejado: {c.mesmoDiaPlanejado?'confirmado':'não confirmado'}.</p>
  <p>Tabagismo: {c.tabagismo==='nao_informado'?'não informado':c.tabagismo==='sim'?'fuma':'não fuma'}.</p>
  <p>O registro guarda este contexto e a versão da referência. Cancelar a conferência descarta este preenchimento.</p>
 </div>;
}
