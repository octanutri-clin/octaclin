'use client';

import { useEffect, useMemo, useState } from 'react';
import { obterLeituraLongitudinalPaciente, type EventoProntuarioPacienteApi, type LeituraLongitudinalPacienteApi } from '@/lib/prontuario-api';

function dataCivilLocal(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function dataDoEvento(valor: string) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(data);
}

function apresentarValor(valor: NonNullable<NonNullable<LeituraLongitudinalPacienteApi['eventos'][number]['respostas']>[number]['valor']>) {
  return Array.isArray(valor) ? valor.join(', ') : typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não') : String(valor);
}

export function LeituraLongitudinal({
  pacienteId,
  consultas,
  habilitada
}: {
  pacienteId: string;
  consultas: EventoProntuarioPacienteApi[];
  habilitada: boolean;
}) {
  const [resultado, setResultado] = useState<{ pacienteId: string; leitura?: LeituraLongitudinalPacienteApi; erro?: boolean } | null>(null);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!habilitada) return;
    const controller = new AbortController();
    void obterLeituraLongitudinalPaciente(pacienteId, controller.signal)
      .then((leitura) => setResultado({ pacienteId, leitura }))
      .catch(() => { if (!controller.signal.aborted) setResultado({ pacienteId, erro: true }); });
    return () => controller.abort();
  }, [pacienteId, habilitada, tentativa]);

  const leitura = resultado?.pacienteId === pacienteId ? resultado.leitura ?? null : null;
  const erro = resultado?.pacienteId === pacienteId && resultado.erro === true;

  const eventos = useMemo(() => {
    if (!leitura) return [];
    const clinicos = leitura.eventos.map((evento) => ({ ...evento, consulta: false }));
    const marcadoresConsulta = consultas
      .filter((evento) => evento.tipo === 'consulta')
      .map((evento) => ({
        id: evento.id,
        tipo: 'consulta' as const,
        data: evento.data,
        origem: 'Consulta',
        titulo: 'Consulta registrada',
        consulta: true
      }));
    const todos = [...clinicos, ...marcadoresConsulta].sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
    return todos.filter((evento) => {
      const data = dataCivilLocal(evento.data);
      return Boolean(data) && (!inicio || data >= inicio) && (!fim || data <= fim);
    });
  }, [leitura, consultas, inicio, fim]);

  if (!habilitada) return null;

  return (
    <section aria-labelledby="leitura-longitudinal-titulo" className="grid gap-4 rounded-md border border-linha bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="leitura-longitudinal-titulo" className="text-base font-semibold text-tinta">Questionários e medidas ao longo do tempo</h2>
          <p className="mt-1 max-w-3xl text-sm text-texto-suave">
            Registros por data, com origem e unidade. A proximidade entre eventos não indica causa, diagnóstico ou evolução clínica.
          </p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-tinta">Filtrar período</legend>
          <div className="flex flex-wrap gap-2">
            <label className="grid gap-1 text-xs text-texto-suave">De
              <input aria-label="Data inicial da leitura longitudinal" className="rounded-md border border-linha bg-white px-3 py-2 text-sm text-tinta" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-texto-suave">Até
              <input aria-label="Data final da leitura longitudinal" className="rounded-md border border-linha bg-white px-3 py-2 text-sm text-tinta" type="date" value={fim} onChange={(event) => setFim(event.target.value)} />
            </label>
          </div>
        </fieldset>
      </header>

      {erro ? (
        <div role="alert" className="grid gap-2 text-sm text-erro">
          <p>Não foi possível carregar a leitura longitudinal.</p>
          <button className="w-fit rounded-md border border-linha px-3 py-2 text-tinta" type="button" onClick={() => setTentativa((atual) => atual + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      {!leitura && !erro ? <p role="status" className="text-sm text-texto-suave">Carregando registros...</p> : null}
      {leitura && eventos.length === 0 ? <p className="text-sm text-texto-suave">Nenhum registro neste período.</p> : null}

      {leitura?.truncado.questionarios || leitura?.truncado.antropometria ? (
        <p role="status" className="rounded-md bg-superficie p-3 text-sm text-texto-suave">
          O histórico exibido foi limitado aos 100 registros mais recentes de cada tipo. Os filtros de período restringem somente os registros carregados.
        </p>
      ) : null}

      <ol className="grid gap-3">
        {eventos.map((evento) => (
          <li key={`${evento.tipo}-${evento.id}`} className="rounded-md border border-linha bg-superficie p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-tinta">{evento.titulo ?? evento.origem}</h3>
              <time className="text-sm text-texto-suave">{dataDoEvento(evento.data)}</time>
            </div>
            <p className="mt-1 text-xs text-texto-suave">Origem: {evento.origem}</p>
            {evento.tipo === 'questionario' && evento.estruturaIndisponivel ? (
              <p className="mt-3 text-sm text-texto-suave">Estrutura histórica indisponível. As respostas deste registro não podem ser associadas com segurança às perguntas originais.</p>
            ) : null}
            {evento.tipo === 'questionario' && evento.respostasIndisponiveisPorLimite ? (
              <p className="mt-3 text-sm text-texto-suave">Este formulário excede o limite seguro de leitura. O conteúdo foi omitido; campos não foram classificados como ausentes.</p>
            ) : null}
            {evento.tipo === 'questionario' && !evento.estruturaIndisponivel && !evento.respostasIndisponiveisPorLimite ? (
              <>
                <p className="mt-2 text-xs text-texto-suave">Versão {evento.versaoQuestionario ?? 'não identificada'}</p>
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  {(evento.respostas ?? []).map((resposta) => (
                    <div key={resposta.perguntaId} className="border-l-2 border-primaria pl-3">
                      <dt className="text-sm font-medium text-tinta">{resposta.enunciado}</dt>
                      <dd className="mt-1 text-sm text-tinta">
                        {resposta.estado === 'informada' && resposta.valor !== undefined
                          ? `${apresentarValor(resposta.valor)}${resposta.unidade ? ` ${resposta.unidade}` : ''}`
                          : 'Não informada'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {evento.tipo === 'antropometria' ? (
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {typeof evento.medidas?.pesoKg === 'number' ? <div><dt className="text-xs text-texto-suave">Peso</dt><dd className="text-sm font-medium">{evento.medidas.pesoKg} kg</dd></div> : null}
                {typeof evento.medidas?.alturaCm === 'number' ? <div><dt className="text-xs text-texto-suave">Altura</dt><dd className="text-sm font-medium">{evento.medidas.alturaCm} cm</dd></div> : null}
                {typeof evento.resultado?.imc === 'number' ? <div><dt className="text-xs text-texto-suave">IMC registrado</dt><dd className="text-sm font-medium">{evento.resultado.imc}</dd></div> : null}
                {typeof evento.resultado?.rcq === 'number' ? <div><dt className="text-xs text-texto-suave">Relação cintura-quadril</dt><dd className="text-sm font-medium">{evento.resultado.rcq}</dd></div> : null}
                {typeof evento.resultado?.circunferenciaCinturaCm === 'number' ? <div><dt className="text-xs text-texto-suave">Circunferência da cintura</dt><dd className="text-sm font-medium">{evento.resultado.circunferenciaCinturaCm} cm</dd></div> : null}
                {typeof evento.resultado?.percentualGordura === 'number' ? <div><dt className="text-xs text-texto-suave">Percentual de gordura</dt><dd className="text-sm font-medium">{evento.resultado.percentualGordura}%</dd></div> : null}
                {typeof evento.resultado?.massaGordaKg === 'number' ? <div><dt className="text-xs text-texto-suave">Massa gorda</dt><dd className="text-sm font-medium">{evento.resultado.massaGordaKg} kg</dd></div> : null}
                {typeof evento.resultado?.massaMagraKg === 'number' ? <div><dt className="text-xs text-texto-suave">Massa magra</dt><dd className="text-sm font-medium">{evento.resultado.massaMagraKg} kg</dd></div> : null}
                {Object.entries(evento.medidas?.circunferencias ?? {}).map(([nome, valor]) => <div key={`circ-${nome}`}><dt className="text-xs text-texto-suave">Circunferência: {nome}</dt><dd className="text-sm font-medium">{valor} cm</dd></div>)}
                {Object.entries(evento.medidas?.dobras ?? {}).map(([nome, valor]) => <div key={`dobra-${nome}`}><dt className="text-xs text-texto-suave">Dobra: {nome}</dt><dd className="text-sm font-medium">{valor} mm</dd></div>)}
              </dl>
            ) : null}
            {!evento.consulta && evento.tipo === 'antropometria' ? (
              <p className="mt-3 text-xs text-texto-suave">
                Protocolo: {evento.protocolo ?? 'não informado'}{evento.formulaAplicada ? ` · Fórmula: ${evento.formulaAplicada}` : ''}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
