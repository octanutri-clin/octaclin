'use client';
import { useState } from 'react';
import { Campo, Selecao } from '@/components/ui/campo';
import { Botao } from '@/components/ui/botao';
import type { ReferenciaGestacaoApi } from '@/lib/gestacoes-paciente-api';
export function FormularioReferenciaGestacao({ inicial = {},ocupado,salvar }: { inicial?: ReferenciaGestacaoApi; ocupado: boolean; salvar: (r: ReferenciaGestacaoApi) => void }) {
  const [r,setR] = useState(inicial);
  function numero(key: keyof ReferenciaGestacaoApi,value: string) { setR(atual => ({ ...atual,[key]: value === '' ? undefined : Number(value) })); }
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault();salvar(r); }}>
    <label>Peso de referência (kg)<Campo type="number" min="1" max="500" step="any" value={r.pesoKg ?? ''} onChange={e => numero('pesoKg',e.target.value)}/></label>
    <label>Altura de referência (cm)<Campo type="number" min="30" max="250" step="any" value={r.alturaCm ?? ''} onChange={e => numero('alturaCm',e.target.value)}/></label>
    <label>Origem do peso<Selecao value={r.origem ?? ''} onChange={e => setR({ ...r,origem: (e.target.value || undefined) as ReferenciaGestacaoApi['origem'] })}>
      <option value="">Não informada</option><option value="pre_gestacional_medido">Antes da gestação, medido</option><option value="pre_gestacional_informado">Antes da gestação, informado</option><option value="inicio_gestacao_medido">Medida no início da gestação</option><option value="peso_habitual_informado">Peso habitual informado</option>
    </Selecao></label>
    <label>Data do peso, se conhecida<Campo type="date" value={r.dataPeso ?? ''} onChange={e => setR({ ...r,dataPeso: e.target.value || undefined })}/></label>
    {r.origem === 'inicio_gestacao_medido' ? <><label>Semanas na medida de referência<Campo type="number" min="0" max="45" value={r.semanasMedida ?? ''} onChange={e => numero('semanasMedida',e.target.value)}/></label><label>Dias adicionais na medida<Campo type="number" min="0" max="6" value={r.diasMedida ?? ''} onChange={e => numero('diasMedida',e.target.value)}/></label></> : null}
    {r.origem === 'peso_habitual_informado' ? <label className="sm:col-span-2"><input type="checkbox" checked={r.pesoHabitualAnteriorConfirmado ?? false} onChange={e => setR({ ...r,pesoHabitualAnteriorConfirmado: e.target.checked })}/> Confirmo que representa o peso habitual anterior à gestação.</label> : null}
    <p className="text-sm sm:col-span-2">Dados incompletos podem ser registrados, sem classificação. Corrigir a base cria uma nova versão e preserva as avaliações anteriores.</p>
    <Botao type="submit" disabled={ocupado}>Conferir e confirmar referência</Botao>
  </form>;
}
