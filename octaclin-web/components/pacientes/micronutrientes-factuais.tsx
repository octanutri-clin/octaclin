'use client';
import { useEffect, useId, useState } from 'react';
import { analisarMicronutrientesPlanejados } from '@/lib/calculo-combinado-planos-api';
import { ErroApiPlanoAlimentar, type CalcularCombinadoEntradaApi } from '@/lib/plano-alimentar-api';
import { CAUSAS_COBERTURA_FACTUAL, filtrarMicronutrientesFactuais, type AnaliseMicronutrientesFactual, type EstadoCoberturaFactual, type FiltrosMicronutrientesFactuais } from '@/lib/micronutrientes-factuais';
import { formatarNutrientePlano } from '@/lib/micronutrientes-plano';
const ESTADOS: Record<EstadoCoberturaFactual,string> = {
  COMPLETO:'Dados completos', PARCIAL:'Dados parciais', DESCONHECIDO:'Composição desconhecida', INCOMPATIVEL:'Dados incompatíveis', INDISPONIVEL:'Cálculo indisponível'
};
const FILTROS_INICIAIS: FiltrosMicronutrientesFactuais = {grupo:'todos',cobertura:'todas',ordem:'nome'};
interface Props { pacienteId: string; entrada: CalcularCombinadoEntradaApi; chaveContexto: string; aoAtualizarSelecao: () => Promise<boolean>; atualizando: boolean; leituraPermitida: boolean }
export function MicronutrientesFactuais({pacienteId,entrada,chaveContexto,aoAtualizarSelecao,atualizando,leituraPermitida}:Props) {
  const id=useId();
  const [aberta,setAberta]=useState(false),[tentativa,setTentativa]=useState(0);
  const [armazenado,setArmazenado]=useState<{chave:string;dados:AnaliseMicronutrientesFactual}|null>(null);
  const [falha,setFalha]=useState<{chave:string;mensagem:string;conflito:boolean}|null>(null);
  const [filtros,setFiltros]=useState<FiltrosMicronutrientesFactuais>(FILTROS_INICIAIS);
  const corpo=JSON.stringify(entrada);
  const chave=JSON.stringify({pacienteId,corpo,chaveContexto,tentativa});
  const dados=leituraPermitida&&armazenado?.chave===chave?armazenado.dados:null;
  const falhaAtual=leituraPermitida&&falha?.chave===chave?falha:null;
  const erro=falhaAtual?.mensagem;
  useEffect(()=>{
    if(!aberta||!leituraPermitida)return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      void analisarMicronutrientesPlanejados(pacienteId,JSON.parse(corpo) as CalcularCombinadoEntradaApi,controller.signal).then(dados=>{
        if(!controller.signal.aborted)setArmazenado({chave,dados});
      }).catch((e:unknown)=>{
        if(!controller.signal.aborted)setFalha({chave,conflito:e instanceof ErroApiPlanoAlimentar&&e.status===409,mensagem:e instanceof ErroApiPlanoAlimentar&&e.status===409
          ?'A publicação ou a ativação mudou. Atualize a seleção antes de tentar novamente.'
          :'Não foi possível carregar uma análise válida. Confira a seleção e tente novamente.'});
      });
    },300);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[aberta,pacienteId,corpo,chave,leituraPermitida]);
  const linhas=dados?filtrarMicronutrientesFactuais(dados.linhas,filtros):[];
  return <section aria-label="Micronutrientes da seleção" className="grid min-w-0 gap-3 rounded-md border border-linha p-3">
    <button type="button" aria-expanded={aberta} aria-controls={id} className="min-h-11 text-left font-semibold text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" onClick={()=>{setAberta(!aberta);if(!aberta)setTentativa(v=>v+1);}}>
      {aberta?'Fechar micronutrientes e cobertura':'Ver micronutrientes e cobertura'}
    </button>
    <div id={id} hidden={!aberta}>
      {aberta?<div className="grid min-w-0 gap-3">
        <p className="text-sm text-texto-suave">Composição da seleção planejada, não do consumo real. Dados ausentes não equivalem a zero.</p>
        <p className="text-sm text-texto-suave">Comparações RDA/AI/UL e seus percentuais estão indisponíveis para esta análise. Cobertura informa presença de dados, não confiança científica.</p>
        {!leituraPermitida?<p role="status">Resultado oculto: confira os avisos e atualize ou recalcule a seleção no painel acima.</p>:!dados&&!erro?<p role="status">Carregando composição e cobertura…</p>:null}
        {erro?<div className="grid gap-2"><p role="alert">{erro}</p>{falhaAtual?.conflito?<button type="button" disabled={atualizando} className="min-h-11 text-left text-primaria underline" onClick={()=>{void aoAtualizarSelecao().then(sucesso=>{if(sucesso)setTentativa(v=>v+1);});}}>Atualizar seleção</button>:<button type="button" className="min-h-11 text-left text-primaria underline" onClick={()=>setTentativa(v=>v+1)}>Tentar novamente</button>}</div>:null}
        {dados?<>
          <p className="text-xs text-texto-suave">Análise factual em {new Date(dados.calculadoEm).toLocaleString('pt-BR')}. {dados.linhas[0]?.contagens.incluidos===0?'Nenhum alimento ativo incluído.':null}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">Grupo de nutrientes<select value={filtros.grupo} onChange={e=>setFiltros(v=>({...v,grupo:e.target.value as FiltrosMicronutrientesFactuais['grupo']}))} className="min-h-11 min-w-0 rounded border border-linha bg-white px-2"><option value="todos">Vitaminas e minerais</option><option value="vitaminas">Vitaminas</option><option value="minerais">Minerais</option></select></label>
            <label className="grid gap-1 text-sm">Cobertura dos dados<select value={filtros.cobertura} onChange={e=>setFiltros(v=>({...v,cobertura:e.target.value as FiltrosMicronutrientesFactuais['cobertura']}))} className="min-h-11 min-w-0 rounded border border-linha bg-white px-2"><option value="todas">Todas as coberturas</option>{Object.entries(ESTADOS).map(([valor,rotulo])=><option key={valor} value={valor}>{rotulo}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Ordenar nutrientes<select value={filtros.ordem} onChange={e=>setFiltros(v=>({...v,ordem:e.target.value as FiltrosMicronutrientesFactuais['ordem']}))} className="min-h-11 min-w-0 rounded border border-linha bg-white px-2"><option value="nome">Nome</option><option value="quantidade">Quantidade por unidade</option><option value="cobertura">Cobertura</option></select></label>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm"><p role="status">{linhas.length} de {dados.linhas.length} nutrientes exibidos.</p><button type="button" className="min-h-11 text-primaria underline" onClick={()=>setFiltros(FILTROS_INICIAIS)}>Limpar filtros</button></div>
          {filtros.ordem==='quantidade'?<p className="text-xs text-texto-suave">Quantidades agrupadas por unidade; dados sem valor vêm por último. A ordem não indica adequação nutricional.</p>:null}
          <div tabIndex={0} role="region" aria-label="Tabela de micronutrientes, role horizontalmente se necessário" className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              <caption className="sr-only">Quantidades conhecidas e cobertura da seleção de planos publicados</caption>
              <thead><tr>{['Nutriente','Quantidade conhecida','Cobertura e detalhes','Referência'].map(c=><th key={c} scope="col" className="border-b border-linha p-2 align-top">{c}</th>)}</tr></thead>
              <tbody>{linhas.map(l=><tr key={l.codigo}>
                <th scope="row" className="border-b border-linha p-2 align-top font-medium">{l.rotulo}</th>
                <td className="border-b border-linha p-2 align-top tabular-nums">{l.valor===undefined?'—':`${formatarNutrientePlano(l.codigo,l.valor)} ${l.unidade}${l.estado==='COMPLETO'?'':' contabilizados'}`}{l.valor!==undefined&&l.estado!=='COMPLETO'?<p className="text-xs text-texto-suave">total real desconhecido</p>:null}</td>
                <td className="border-b border-linha p-2 align-top"><p>{ESTADOS[l.estado]}</p><p className="text-xs text-texto-suave">{l.contagens.conhecidos}/{l.contagens.incluidos} alimentos com composição conhecida</p><details><summary className="min-h-11 cursor-pointer py-2 text-primaria underline">Detalhes de {l.rotulo}</summary><p>Sem composição: {l.contagens.semComposicao}. Incompatíveis: {l.contagens.incompativeis}. Não resolvidos: {l.contagens.naoResolvidos}.</p>{l.causas.length?<ul>{l.causas.map(c=><li key={c.codigo}>{CAUSAS_COBERTURA_FACTUAL[c.codigo]}: {c.quantidade}</li>)}</ul>:<p>Todos os alimentos incluídos possuem composição conhecida para este nutriente.</p>}</details></td>
                <td className="border-b border-linha p-2 align-top">Indisponível</td>
              </tr>)}</tbody>
            </table>
          </div>
          {!linhas.length?<p>Nenhum nutriente corresponde aos filtros.</p>:null}
        </>:null}
      </div>:null}
    </div>
  </section>;
}
