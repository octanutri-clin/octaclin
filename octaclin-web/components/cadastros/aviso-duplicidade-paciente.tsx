'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { Botao, classesBotao } from '@/components/ui/botao';
import type { CandidatoDuplicidadePaciente } from '@/lib/cadastros-api';

export type EstadoVerificacaoDuplicidade = 'ocioso' | 'verificando' | 'sem_candidatos' | 'candidatos' | 'indisponivel';

interface AvisoDuplicidadePacienteProps {
  estado: EstadoVerificacaoDuplicidade;
  candidatos: CandidatoDuplicidadePaciente[];
  pessoaDiferenteConfirmada: boolean;
  aoConfirmarPessoaDiferente: () => void;
}

const rotuloMotivo = {
  nome_e_nascimento: 'mesmo nome e data de nascimento',
  contato: 'mesmo contato',
  nome: 'mesmo nome'
} as const;

export function AvisoDuplicidadePaciente({ estado, candidatos, pessoaDiferenteConfirmada, aoConfirmarPessoaDiferente }: AvisoDuplicidadePacienteProps) {
  if (estado === 'ocioso') return <p className="text-xs text-texto-suave">Informe ao menos três caracteres do nome para verificar cadastros semelhantes.</p>;
  if (estado === 'verificando') return <div role="status" aria-live="polite" className="flex min-h-11 items-center gap-2 text-sm text-texto-suave"><Loader2 size={16} className="animate-spin" aria-hidden="true" />Verificando cadastros semelhantes</div>;
  if (estado === 'sem_candidatos') return <div role="status" className="flex items-center gap-2 text-sm text-sucesso-forte"><CheckCircle2 size={16} aria-hidden="true" />Nenhum cadastro semelhante foi encontrado.</div>;
  if (estado === 'indisponivel') return <div role="status" className="flex items-start gap-2 rounded-md border border-alerta-borda bg-alerta-suave px-3 py-3 text-sm text-alerta-forte"><AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Não foi possível verificar cadastros semelhantes. Você ainda pode concluir o cadastro.</span></div>;

  return (
    <section role="alert" aria-live="assertive" aria-atomic="true" aria-labelledby="duplicidade-paciente-titulo" className="grid gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-alerta-forte" aria-hidden="true" />
        <div><h3 id="duplicidade-paciente-titulo" className="text-sm font-semibold text-tinta">Confira antes de cadastrar</h3><p className="mt-1 text-sm text-texto-suave">Encontramos pacientes que podem ser a mesma pessoa.</p></div>
      </div>
      <ul className="grid gap-2" aria-label="Possíveis cadastros semelhantes">
        {candidatos.map((candidato) => (
          <li key={candidato.pacienteId} className="flex flex-col gap-2 rounded-md border border-linha bg-white px-3 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><p className="font-medium text-tinta">{candidato.nome}</p><p className="text-xs text-texto-suave">{candidato.motivos.map((motivo) => rotuloMotivo[motivo]).join(' e ')}</p></div>
            <Link href={`/pacientes/${candidato.pacienteId}` as Route} className={classesBotao({ variante: 'secundario', tamanho: 'sm' })}><ExternalLink size={14} />Abrir cadastro</Link>
          </li>
        ))}
      </ul>
      {pessoaDiferenteConfirmada ? (
        <div role="status" className="flex items-center gap-2 text-sm font-medium text-sucesso-forte"><CheckCircle2 size={16} aria-hidden="true" />Confirmado: este cadastro representa outra pessoa.</div>
      ) : (
        <Botao type="button" variante="secundario" onClick={aoConfirmarPessoaDiferente}>É outra pessoa, continuar cadastro</Botao>
      )}
    </section>
  );
}
