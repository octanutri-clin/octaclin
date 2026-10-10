'use client';
import { useState } from 'react';
import { motivoGestacional, fonteGestacional } from '@/lib/linguagem-gestacional';
import { Selecao } from '@/components/ui/campo';
import type { AvaliacaoGestacaoApi, SerieReferenciaGestacaoApi } from '@/lib/gestacoes-paciente-api';
const f = (n?: number) => n == null ? '—' : n.toLocaleString('pt-BR',{ maximumFractionDigits: 2 });
export function GraficoGestacional({ avaliacoes,parcial,series = [] }: { avaliacoes: AvaliacaoGestacaoApi[]; parcial: boolean; series?: SerieReferenciaGestacaoApi[] }) {
  const versoes = [...new Set(avaliacoes.map(a => a.referenciaNumero))].sort((a,b) => a-b);
  const [escolha,setEscolha] = useState('');
  const versao = versoes.includes(Number(escolha)) ? Number(escolha) : versoes[0];
  const rows = avaliacoes.filter(a => a.referenciaNumero === versao);
  const pontos = rows.filter(a => typeof a.gestacional?.ganhoKg === 'number' && typeof a.gestacional.contexto?.semanas === 'number');
  const faixaSerie = series.find(s => s.numero === versao)?.faixas ?? [];
  const valores = [...faixaSerie.flatMap(f => [f.minimo,f.maximo]),...pontos.flatMap(a => [a.gestacional!.ganhoKg!,...(a.gestacional?.faixa ? [a.gestacional.faixa.minimo,a.gestacional.faixa.maximo] : [])])];
  const min = Math.min(-1,...valores)-1, max = Math.max(1,...valores)+1;
  const x = (semana: number) => 48+(semana/45)*570;
  const y = (valor: number) => 205-(valor-min)/(max-min)*165;
  return <div className="grid gap-3">
    <label>Versão da referência<Selecao value={versao ?? ''} onChange={e => setEscolha(e.target.value)}>{versoes.map(v => <option key={v} value={v}>Referência {v}</option>)}</Selecao></label>
    <p className="text-sm">{parcial ? 'Cobertura parcial: carregue mais avaliações para completar o acompanhamento.' : 'Todas as avaliações disponíveis desta gestação foram carregadas.'} Cada versão usa sua própria base de peso e altura.</p>
    {pontos.length ? <svg role="img" aria-label="Ganho de peso por semana gestacional. Valores e faixas disponíveis na tabela abaixo." viewBox="0 0 660 245" className="w-full max-w-3xl">
      <line x1="48" x2="620" y1="205" y2="205" stroke="currentColor"/><line x1="48" x2="48" y1="30" y2="205" stroke="currentColor"/>
      {[0,10,20,30,40].map(s => <text key={s} x={x(s)} y="226" fontSize="12">{s}s</text>)}
      <text x="5" y="26" fontSize="12">kg</text><text x="5" y="45" fontSize="11">{f(max)}</text><text x="5" y="204" fontSize="11">{f(min)}</text>
      {faixaSerie.map(faixa => <line key={faixa.semana} x1={x(faixa.semana)} x2={x(faixa.semana)} y1={y(faixa.minimo)} y2={y(faixa.maximo)} stroke="currentColor" strokeWidth="8" opacity="0.15"/>)}
      {pontos.map(a => { const g = a.gestacional!,semana = g.contexto!.semanas!+(g.contexto?.dias ?? 0)/7;return <g key={a.id}>
        {g.faixa ? <line x1={x(g.semanaCurva ?? semana)} x2={x(g.semanaCurva ?? semana)} y1={y(g.faixa.minimo)} y2={y(g.faixa.maximo)} stroke="currentColor" strokeWidth="5" opacity="0.25"/> : null}
        <circle cx={x(semana)} cy={y(g.ganhoKg!)} r="4" fill="currentColor"><title>{a.avaliadaEm}: {f(g.ganhoKg)} kg, {g.classificacao ?? 'sem classificação'}</title></circle>
      </g>; })}
    </svg> : <p>Nenhum ponto com peso de referência e idade gestacional disponíveis nesta versão.</p>}
    <div className="overflow-x-auto" role="region" aria-label="Tabela do acompanhamento gestacional; use as setas para rolar" tabIndex={0}><table className="w-full text-left text-sm"><caption className="text-left font-semibold">Avaliações da referência {versao ?? '—'}</caption>
      <thead><tr>{['Data','Idade gestacional','Semana da curva','Peso (kg)','IMC de referência','Ganho (kg)','Faixa (kg)','Resultado'].map(t => <th className="p-2" scope="col" key={t}>{t}</th>)}</tr></thead>
      <tbody>{rows.map(a => {const g = a.gestacional;return <tr key={a.id} className="border-t border-linha">
        <td className="p-2">{a.avaliadaEm}</td><td className="p-2">{g?.contexto?.semanas === undefined ? '—' : `${g.contexto.semanas}s ${g.contexto.dias ?? 0}d`}</td>
        <td className="p-2">{g?.semanaCurva ?? '—'}</td><td className="p-2">{f(a.pesoKg)}</td><td className="p-2">{f(g?.imcReferencia)}</td><td className="p-2">{f(g?.ganhoKg)}</td>
        <td className="p-2">{g?.faixa ? `${f(g.faixa.minimo)} a ${f(g.faixa.maximo)}` : '—'}</td><td className="p-2">{a.ilegivel ? 'Registro ilegível' : g?.classificacao ? `${g.classificacao} da faixa` : 'Sem classificação'}{g?.motivos?.length ? <ul>{g.motivos.map(m => <li key={m}>{motivoGestacional(m)}</li>)}</ul> : null}
        {g ? <p className="text-xs">Fonte: {fonteGestacional(g.source_id)}. Base: {g.referencia?.origem?.replaceAll('_',' ') ?? 'não informada'}, {f(g.referencia?.pesoKg)} kg / {f(g.referencia?.alturaCm)} cm.</p> : null}</td>
      </tr>;})}</tbody>
    </table></div>
    <p className="text-sm">A faixa se refere à semana da curva indicada, sem interpolação clínica. O acompanhamento deve ser discutido com seu profissional; a classificação não prescreve perda de peso.</p>
  </div>;
}
