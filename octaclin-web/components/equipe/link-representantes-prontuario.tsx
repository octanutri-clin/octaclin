'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState, type MouseEvent } from 'react';
import { UsersRound } from 'lucide-react';
import { classesBotao } from '@/components/ui/botao';
import { equipeRestricoesDisponivel } from '@/lib/restricoes-equipe-api';
import { TEXTOS_EQUIPE_RESTRICOES as T } from '@/lib/textos-equipe-restricoes';

/**
 * Atalho do prontuário para "Quem acompanha pelo portal" (FOOD06 P3-6). Só aparece quando a web E o tenant estão com a
 * área ligada; enquanto pergunta, não aparece. Não é autorização: a página e o backend continuam decidindo.
 */
export function LinkRepresentantesProntuario({ pacienteId, aoClicar }: { pacienteId: string; aoClicar?: (evento: MouseEvent<HTMLAnchorElement>) => void }) {
  const [disponivel, setDisponivel] = useState(false);
  useEffect(() => {
    const controle = new AbortController();
    void equipeRestricoesDisponivel(controle.signal).then((ok) => { if (!controle.signal.aborted) setDisponivel(ok); });
    return () => controle.abort();
  }, []);
  if (!disponivel) return null;
  return (
    <Link href={`/pacientes/${encodeURIComponent(pacienteId)}/representantes` as Route} onClick={aoClicar} className={classesBotao({ variante: 'secundario' })}>
      <UsersRound size={16} />
      {T.linkRepresentantesProntuario}
    </Link>
  );
}
