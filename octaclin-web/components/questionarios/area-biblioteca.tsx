'use client';

import { LibraryBig, Plus } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Campo, Selecao } from '@/components/ui/campo';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

export function AreaBiblioteca({ workspace }: { workspace: WorkspaceQuestionarios }) {
  const {
    buscaBiblioteca, setBuscaBiblioteca, categoriaBibliotecaId, setCategoriaBibliotecaId,
    categorias, perguntasBibliotecaVisiveis, categoriasPorId, incluirDaBiblioteca, salvando, questionarioAtual
  } = workspace;

  return (
    <Cartao className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
        <LibraryBig className="h-4 w-4 text-primaria" />
        <h2 className="text-sm font-semibold text-tinta">Biblioteca de perguntas</h2>
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <Campo type="search" value={buscaBiblioteca} onChange={(event) => setBuscaBiblioteca(event.target.value)} placeholder="Buscar por enunciado ou chave clínica" aria-label="Buscar na biblioteca de perguntas" />
          <Selecao value={categoriaBibliotecaId} onChange={(event) => setCategoriaBibliotecaId(event.target.value)} aria-label="Filtrar categoria da biblioteca">
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
          </Selecao>
        </div>
        <p className="text-sm text-texto-suave">Selecione um formulário em Editor para incluir uma cópia independente da pergunta.</p>
        <ul className="grid gap-2">
          {perguntasBibliotecaVisiveis.length ? perguntasBibliotecaVisiveis.map((pergunta) => (
            <li key={pergunta.id} className="flex items-center justify-between gap-3 rounded-md border border-linha bg-white p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-tinta">{pergunta.enunciado}</span>
                <span className="block truncate text-xs text-texto-suave">{categoriasPorId.get(pergunta.categoriaId)?.nome ?? 'Sem categoria'}{pergunta.chaveClinica ? ` - ${pergunta.chaveClinica}` : ''}</span>
              </span>
              <Botao type="button" onClick={() => void incluirDaBiblioteca(pergunta.id)} disabled={salvando || !questionarioAtual} aria-label={`Incluir ${pergunta.enunciado}`}>
                <Plus className="h-4 w-4" /> Incluir
              </Botao>
            </li>
          )) : <li className="rounded-md border border-linha p-4 text-sm text-texto-suave">Nenhuma pergunta reutilizavel encontrada.</li>}
        </ul>
      </div>
    </Cartao>
  );
}
