'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Botao } from '@/components/ui/botao';

export function ExportacaoRespostas({ questionarioId, respostaIds, carregando }: {
  questionarioId: string; respostaIds: string[]; carregando: boolean;
}) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState('');
  const emVoo = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  async function exportar() {
    if (emVoo.current || carregando || !respostaIds.length || respostaIds.length > 1000) return;
    emVoo.current = true; setExportando(true); setErro('');
    try {
      const resposta = await fetch(`/api/questionarios/${questionarioId}/respostas/exportar.csv`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ respostaIds })
      });
      if (!resposta.ok || !resposta.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv')) throw new Error();
      const arquivo = await resposta.blob();
      if (!vivo.current) return;
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      try {
        link.href = url; link.download = 'octaclin-respostas-filtradas.csv';
        document.body.appendChild(link); link.click();
      } finally { link.remove(); URL.revokeObjectURL(url); }
    } catch {
      if (vivo.current) setErro('Não foi possível exportar. Atualize as respostas e tente novamente.');
    } finally {
      emVoo.current = false;
      if (vivo.current) setExportando(false);
    }
  }

  return <div role="group" aria-label="Exportação de respostas" className="grid min-w-0 gap-2">
    <div className="flex flex-wrap gap-2">
      <Botao type="button" onClick={() => void exportar()} disabled={carregando || exportando || !respostaIds.length || respostaIds.length > 1000}>
        <Download className="h-4 w-4" aria-hidden="true" />{exportando ? 'Preparando CSV' : 'Exportar resultados filtrados'}
      </Botao>
      <a href={`/api/questionarios/${questionarioId}/respostas/exportar.csv`}
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-linha bg-superficie px-3 text-sm font-medium text-texto-forte hover:bg-white">
        Exportar todas as respostas
      </a>
    </div>
    <p className="text-xs text-texto-suave">Filtrados: todos os campos dos envios exibidos, conforme paciente e busca. A exportação completa não aplica os filtros da tela.</p>
    {respostaIds.length > 1000 ? <p role="status" className="text-sm text-texto-suave">Refine os filtros para exportar até 1000 envios por seleção.</p> : null}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
  </div>;
}
