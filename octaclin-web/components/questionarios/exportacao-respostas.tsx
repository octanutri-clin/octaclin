'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Botao } from '@/components/ui/botao';

export function ExportacaoRespostas({ questionarioId, respostaIds, carregando, filtros }: {
  questionarioId: string; respostaIds: string[]; carregando: boolean; filtros: {pacienteId?:string;inicio?:string;fim?:string};
}) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');
  const emVoo = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  async function exportar(escopo: 'visiveis'|'consulta'|'questionario') {
    if (emVoo.current || carregando || (escopo==='visiveis' && (!respostaIds.length || respostaIds.length > 1000))) return;
    emVoo.current = true; setExportando(true); setErro('');
    try {
      const resposta = await fetch(`/api/questionarios/${questionarioId}/respostas/exportacao.csv`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({escopo,...(escopo!=='questionario'?{filtros}:{}),...(escopo==='visiveis'?{respostaIds}:{})})
      });
      if (!resposta.ok || !resposta.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv')) throw new Error(resposta.status===400||resposta.status===413?'Refine o período ou o paciente para exportar até 1000 respostas por vez.':'Não foi possível exportar. Atualize as respostas e tente novamente.');
      const arquivo = await resposta.blob();
      if (!vivo.current) return;
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      try {
        link.href = url; link.download = 'octaclin-respostas-filtradas.csv';
        document.body.appendChild(link); link.click();
      } finally { link.remove(); URL.revokeObjectURL(url); }
    } catch (e) {
      if (vivo.current) setErro(e instanceof Error?e.message:'Não foi possível exportar. Atualize as respostas e tente novamente.');
    } finally {
      emVoo.current = false;
      if (vivo.current) setExportando(false);
    }
  }

  return <div role="group" aria-label="Exportação de respostas" className="grid min-w-0 gap-2">
    <div className="flex flex-wrap gap-2">
      <Botao type="button" onClick={() => void exportar('visiveis')} disabled={carregando || exportando || !respostaIds.length || respostaIds.length > 1000}>
        <Download className="h-4 w-4" aria-hidden="true" />Exportar itens visíveis
      </Botao>
      <Botao type="button" onClick={() => void exportar('consulta')} disabled={carregando||exportando}>Exportar consulta</Botao>
      <Botao type="button" onClick={() => void exportar('questionario')} disabled={carregando||exportando}>Exportar questionário</Botao>
    </div>
    <p className="text-xs text-texto-suave">Itens visíveis: envios desta página após a busca. Consulta: todas as respostas do paciente e período aplicados, sem a busca local. Questionário: todo o conjunto autorizado, sem filtros. Limite de 1000 respostas por exportação; conjuntos maiores exigem refinar os filtros.</p>
    {respostaIds.length > 1000 ? <p role="status" className="text-sm text-texto-suave">Refine os filtros para exportar até 1000 envios por seleção.</p> : null}
    {exportando?<p role="status">Preparando CSV...</p>:null}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
  </div>;
}
