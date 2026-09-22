'use client';

import { useEffect, useId, useState } from 'react';
import { Rotulo, Selecao } from '@/components/ui/campo';
import { formatarDataHora } from '@/components/pacientes/linha-do-tempo-prontuario';
import { listarConsultasRecentes, type ConsultaRecenteApi } from '@/lib/prontuario-api';

export interface SeletorConsultaRecenteProps {
  pacienteId: string;
  value: string;
  onChange: (consultaId: string) => void;
  disabled?: boolean;
}

/**
 * PB-24 (Fase 275): seletor opcional "Vincular a consulta", reutilizado nas
 * quatro telas de criacao (evolucao, avaliacao antropometrica, conduta
 * terapeutica, exame laboratorial). Sem selecao, o registro fica sem vinculo,
 * como antes desta fase.
 */
export function SeletorConsultaRecente({ pacienteId, value, onChange, disabled = false }: SeletorConsultaRecenteProps) {
  const id = useId();
  const [consultas, setConsultas] = useState<ConsultaRecenteApi[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    listarConsultasRecentes(pacienteId)
      .then((itens) => {
        if (!cancelado) setConsultas(itens);
      })
      .catch(() => {
        // Falha ao carregar consultas nao bloqueia o registro: o vinculo e
        // opcional, entao o formulario segue utilizavel sem ele.
        if (!cancelado) setConsultas([]);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [pacienteId]);

  return (
    <div className="grid gap-1">
      <Rotulo htmlFor={`${id}-consulta`}>Vincular a consulta (opcional)</Rotulo>
      <Selecao
        id={`${id}-consulta`}
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled || carregando || !consultas.length}
      >
        <option value="">{carregando ? 'Carregando consultas...' : consultas.length ? 'Nenhuma consulta selecionada' : 'Sem consultas recentes'}</option>
        {consultas.map((consulta) => (
          <option key={consulta.id} value={consulta.id}>
            {consulta.titulo} · {formatarDataHora(consulta.inicioEm)}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
