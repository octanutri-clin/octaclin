'use client';

import type { FalhaEquipe } from '@/lib/restricoes-equipe-api';
import { TEXTOS_EQUIPE_RESTRICOES as T } from '@/lib/textos-equipe-restricoes';

/** Mensagem fixa por tipo de falha (FOOD06 P3-6). O texto do servidor nunca aparece. */
export function mensagemFalhaEquipe(tipo: FalhaEquipe): string {
  switch (tipo) {
    case 'indisponivel':
      return T.indisponivel;
    case 'sessao':
      return 'Sua sessão terminou. Entre novamente.';
    case 'semAcesso':
      return T.semPermissao;
    case 'mudou':
      return T.mudou;
    case 'invalida':
      return 'Revise os campos destacados.';
    case 'muitas':
      return T.muitasBuscas;
    case 'incerto':
      return T.incerto;
    default:
      return T.carregarFalhou;
  }
}

export function formatarDataEquipe(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
}
