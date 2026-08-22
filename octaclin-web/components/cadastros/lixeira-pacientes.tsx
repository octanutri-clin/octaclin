'use client';

import { ArchiveRestore } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Modal } from '@/components/ui/modal';
import type { PacienteResumo } from '@/lib/cadastros-api';

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

interface LixeiraPacientesProps {
  aberta: boolean;
  pacientes: PacienteResumo[];
  podeGerenciar: boolean;
  restaurandoId: string | null;
  aoFechar: () => void;
  aoRestaurar: (paciente: PacienteResumo) => void;
}

export function LixeiraPacientes({ aberta, pacientes, podeGerenciar, restaurandoId, aoFechar, aoRestaurar }: LixeiraPacientesProps) {
  return (
    <Modal aberto={aberta} aoFechar={aoFechar} titulo="Lixeira de pacientes" descricao="Restaure cadastros arquivados sem perder prontuário, agenda ou vínculos.">
      {pacientes.length ? (
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {pacientes.map((paciente) => (
            <li key={paciente.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linha p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-texto-forte">{paciente.nome}</p>
                <p className="text-xs text-texto-suave">Arquivado em {formatarData(paciente.arquivadoEm ?? undefined)}</p>
              </div>
              {podeGerenciar ? <Botao type="button" tamanho="sm" onClick={() => aoRestaurar(paciente)} carregando={restaurandoId === paciente.id}><ArchiveRestore size={14} /> Restaurar</Botao> : null}
            </li>
          ))}
        </ul>
      ) : <p className="py-8 text-center text-sm text-texto-suave">Nenhum paciente arquivado.</p>}
    </Modal>
  );
}
