'use client';

import { useState } from 'react';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';

export type FrequenciaRecorrencia = 'diaria' | 'semanal' | 'data_especifica';

export interface RecorrenciaEscolhida {
  regraCron?: string;
  dataFixa?: string;
}

interface Props {
  onAlterar: (recorrencia: RecorrenciaEscolhida) => void;
}

const diasSemana: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: 'Domingo' },
  { valor: 1, rotulo: 'Segunda-feira' },
  { valor: 2, rotulo: 'Terca-feira' },
  { valor: 3, rotulo: 'Quarta-feira' },
  { valor: 4, rotulo: 'Quinta-feira' },
  { valor: 5, rotulo: 'Sexta-feira' },
  { valor: 6, rotulo: 'Sabado' }
];

function horarioParaPartes(horario: string): { hora: number; minuto: number } {
  const [horaTexto, minutoTexto] = horario.split(':');
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  return { hora: Number.isFinite(hora) ? hora : 8, minuto: Number.isFinite(minuto) ? minuto : 0 };
}

function calcularRecorrencia(frequencia: FrequenciaRecorrencia, diaSemana: number, horario: string, dataEspecifica: string): RecorrenciaEscolhida {
  if (frequencia === 'data_especifica') {
    return dataEspecifica ? { dataFixa: new Date(dataEspecifica).toISOString() } : {};
  }
  const { hora, minuto } = horarioParaPartes(horario);
  return { regraCron: frequencia === 'diaria' ? `${minuto} ${hora} * * *` : `${minuto} ${hora} * * ${diaSemana}` };
}

export function SeletorRecorrencia({ onAlterar }: Props) {
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>('semanal');
  const [diaSemana, setDiaSemana] = useState(1);
  const [horario, setHorario] = useState('08:00');
  const [dataEspecifica, setDataEspecifica] = useState('');

  function atualizar(proxima: Partial<{ frequencia: FrequenciaRecorrencia; diaSemana: number; horario: string; dataEspecifica: string }>) {
    const novaFrequencia = proxima.frequencia ?? frequencia;
    const novoDiaSemana = proxima.diaSemana ?? diaSemana;
    const novoHorario = proxima.horario ?? horario;
    const novaDataEspecifica = proxima.dataEspecifica ?? dataEspecifica;
    setFrequencia(novaFrequencia);
    setDiaSemana(novoDiaSemana);
    setHorario(novoHorario);
    setDataEspecifica(novaDataEspecifica);
    onAlterar(calcularRecorrencia(novaFrequencia, novoDiaSemana, novoHorario, novaDataEspecifica));
  }

  return (
    <div className="grid gap-2">
      <Rotulo htmlFor="frequencia-recorrencia">Frequencia</Rotulo>
      <Selecao
        id="frequencia-recorrencia"
        aria-label="Frequencia"
        value={frequencia}
        onChange={(event) => atualizar({ frequencia: event.target.value as FrequenciaRecorrencia })}
      >
        <option value="diaria">Todos os dias</option>
        <option value="semanal">Toda semana</option>
        <option value="data_especifica">Data especifica</option>
      </Selecao>

      {frequencia === 'semanal' ? (
        <Selecao aria-label="Dia da semana" value={diaSemana} onChange={(event) => atualizar({ diaSemana: Number(event.target.value) })}>
          {diasSemana.map((dia) => (
            <option key={dia.valor} value={dia.valor}>{dia.rotulo}</option>
          ))}
        </Selecao>
      ) : null}

      {frequencia === 'diaria' || frequencia === 'semanal' ? (
        <label className="space-y-1.5">
          <Rotulo>Horario</Rotulo>
          <Campo type="time" aria-label="Horario" value={horario} onChange={(event) => atualizar({ horario: event.target.value })} />
        </label>
      ) : (
        <label className="space-y-1.5">
          <Rotulo>Data e horario</Rotulo>
          <Campo type="datetime-local" aria-label="Data e horario" value={dataEspecifica} onChange={(event) => atualizar({ dataEspecifica: event.target.value })} />
        </label>
      )}
    </div>
  );
}
