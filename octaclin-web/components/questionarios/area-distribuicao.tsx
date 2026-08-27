'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Link2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao } from '@/components/ui/cartao';
import { Campo, Selecao } from '@/components/ui/campo';
import { RecorrenciaEscolhida, SeletorRecorrencia } from './seletor-recorrencia';
import type { WorkspaceQuestionarios } from './usar-workspace-questionarios';

export function AreaDistribuicao({ workspace }: { workspace: WorkspaceQuestionarios }) {
  const {
    pacientes, pacienteAgendamentoId, setPacienteAgendamentoId, agendar, salvando, questionarioAtual,
    pacienteEnvioId, setPacienteEnvioId, gerarLinkFormulario, linkFormulario
  } = workspace;
  const [recorrencia, setRecorrencia] = useState<RecorrenciaEscolhida>({ regraCron: '0 8 * * 1' });
  const botaoAgendarRef = useRef<HTMLButtonElement>(null);
  const restaurarFocoAgendamentoRef = useRef(false);

  function criarCheckinRecorrente() {
    restaurarFocoAgendamentoRef.current = document.activeElement === botaoAgendarRef.current;
    void agendar(recorrencia);
  }

  useEffect(() => {
    if (salvando || !restaurarFocoAgendamentoRef.current) return;
    restaurarFocoAgendamentoRef.current = false;
    botaoAgendarRef.current?.focus();
  }, [salvando]);

  return (
    <Cartao className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
        <Link2 className="h-4 w-4 text-primaria" />
        <h2 className="text-sm font-semibold text-tinta">Distribuição do formulário</h2>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
          <div>
            <p className="text-sm font-semibold text-tinta">Check-in recorrente</p>
            <p className="text-xs text-texto-suave">Agenda um envio automático para um paciente especifico.</p>
          </div>
          <Selecao value={pacienteAgendamentoId} onChange={(event) => setPacienteAgendamentoId(event.target.value)} aria-label="Paciente do check-in recorrente">
            <option value="">Selecione o paciente</option>
            {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
          </Selecao>
          <SeletorRecorrencia onAlterar={setRecorrencia} />
          <Botao ref={botaoAgendarRef} type="button" onClick={criarCheckinRecorrente} disabled={salvando || !questionarioAtual}>
            <CalendarClock className="h-4 w-4" />
            Criar check-in recorrente
          </Botao>
        </div>
        <div className="grid gap-3 rounded-md border border-linha bg-superficie p-3">
          <div>
            <p className="text-sm font-semibold text-tinta">Envio individual</p>
            <p className="text-xs text-texto-suave">Gera o link público para uma resposta única.</p>
          </div>
          <Selecao value={pacienteEnvioId} onChange={(event) => setPacienteEnvioId(event.target.value)} aria-label="Paciente do envio individual">
            <option value="">Selecione o paciente</option>
            {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
          </Selecao>
          <Botao type="button" onClick={() => void gerarLinkFormulario()} disabled={salvando || !questionarioAtual}><Link2 className="h-4 w-4" /> Gerar link</Botao>
          {linkFormulario ? <Campo readOnly value={linkFormulario} onFocus={(event) => event.currentTarget.select()} aria-label="Link público do formulário" /> : null}
        </div>
      </div>
    </Cartao>
  );
}
