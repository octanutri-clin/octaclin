'use client';
import { useEffect, useRef, useState } from 'react';
import { Campo, Selecao } from '@/components/ui/campo';
import { Botao } from '@/components/ui/botao';
import { solicitarGestacao, urlGestacoes, type ContextoGestacaoApi, type GestacaoApi, type PaginaGestacoesApi } from '@/lib/gestacoes-paciente-api';
export function FormularioContextoGestacional({ pacienteId,contexto,alterar }: { pacienteId: string; contexto: ContextoGestacaoApi; alterar: (c: ContextoGestacaoApi) => void }) {
  const [itens,setItens] = useState<GestacaoApi[]>([]),[cursor,setCursor] = useState<string|null>(null),[erro,setErro] = useState('');
  const vivo = useRef(false);
  useEffect(() => {vivo.current = true;const controller = new AbortController();void solicitarGestacao<PaginaGestacoesApi<GestacaoApi>>(urlGestacoes(pacienteId),'GET',undefined,controller.signal).then(r => {if (!controller.signal.aborted) {setItens(r.itens);setCursor(r.proximoCursor);}}).catch(() => {if (!controller.signal.aborted) setErro('Não foi possível carregar as gestações. Atualize antes de vincular.');});return () => {vivo.current = false;controller.abort();};},[pacienteId]);
  async function atualizar(mais?: string) {
    try {const r = await solicitarGestacao<PaginaGestacoesApi<GestacaoApi>>(`${urlGestacoes(pacienteId)}${mais ? '?cursor='+encodeURIComponent(mais) : ''}`);if (!vivo.current) return;setItens(a => mais ? [...a,...r.itens] : r.itens);setCursor(r.proximoCursor);setErro('');alterar({ ...contexto,gestacaoId: undefined,referenciaNumero: undefined });}
    catch {if (vivo.current) setErro('Não foi possível atualizar as gestações.');}
  }
  return <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="font-semibold">Contexto na data desta avaliação</legend>
    {erro ? <p role="alert" className="sm:col-span-2">{erro}</p> : null}
    <label>Gestação vinculada<Selecao value={contexto.gestacaoId ?? ''} onChange={e => {const g = itens.find(x => x.id === e.target.value);alterar({ ...contexto,gestacaoId: g?.id,referenciaNumero: g?.numero });}}><option value="">Sem vínculo: medidas, sem classificação</option>{itens.filter(g => g.status === 'ativa').map((g,i) => <option key={g.id} value={g.id}>Gestação {i+1} — referência {g.numero} — {g.criadoEm.slice(0,10)}</option>)}</Selecao></label>
    <div className="flex gap-2"><Botao type="button" onClick={() => void atualizar()}>Atualizar gestações</Botao>{cursor ? <Botao type="button" onClick={() => void atualizar(cursor)}>Mais gestações</Botao> : null}</div>
    <label>Semanas completas na avaliação<Campo type="number" min="0" max="45" value={contexto.semanas ?? ''} onChange={e => alterar({ ...contexto,semanas: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
    <label>Dias adicionais<Campo type="number" min="0" max="6" value={contexto.dias ?? ''} onChange={e => alterar({ ...contexto,dias: e.target.value === '' ? undefined : Number(e.target.value) })}/></label>
    <label>Origem da idade gestacional<Selecao value={contexto.origemIdadeGestacional ?? 'nao_informada'} onChange={e => alterar({ ...contexto,origemIdadeGestacional: e.target.value as ContextoGestacaoApi['origemIdadeGestacional'] })}><option value="nao_informada">Não informada</option><option value="pre_natal">Pré-natal</option><option value="ultrassonografia">Ultrassonografia</option><option value="dum">DUM</option></Selecao></label>
    <label>Data da fonte, se conhecida<Campo type="date" value={contexto.dataFonteIdadeGestacional ?? ''} onChange={e => alterar({ ...contexto,dataFonteIdadeGestacional: e.target.value || undefined })}/></label>
    <label>Tipo da gestação<Selecao value={contexto.tipo ?? 'nao_informada'} onChange={e => alterar({ ...contexto,tipo: e.target.value as ContextoGestacaoApi['tipo'] })}><option value="nao_informada">Não informado</option><option value="unica">Feto único</option><option value="multipla">Múltipla</option></Selecao></label>
    <label>Risco confirmado<Selecao value={contexto.risco ?? 'nao_informado'} onChange={e => alterar({ ...contexto,risco: e.target.value as ContextoGestacaoApi['risco'] })}><option value="nao_informado">Não informado</option><option value="habitual">Habitual</option><option value="alto">Alto risco</option></Selecao></label>
    <label className="sm:col-span-2"><input type="checkbox" checked={contexto.idadeGestacionalInconsistente ?? false} onChange={e => alterar({ ...contexto,idadeGestacionalInconsistente: e.target.checked })}/> Idade gestacional inconsistente: registrar sem classificação</label>
    <p className="sm:col-span-2 text-sm">Informe a idade gestacional correspondente à data da avaliação. O sistema não a calcula pela data de hoje, DUM ou laudo. Alterar a data exige informar o contexto novamente.</p>
  </fieldset>;
}
