'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { GraficoEvolucao, type PontoEvolucao } from '@/components/ui/grafico-evolucao';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { listarAvaliacoesAntropometricas, type SerieAntropometricaApi } from '@/lib/prontuario-api';
import { METRICAS_ANTROPOMETRICAS, formatarMetricaAntropometrica } from './metricas-antropometricas';

function formatarData(valor: string) {
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

interface ResumoAntropometricoProps {
  pacienteId: string;
  aoAbrirDetalhes: () => void;
}

export function ResumoAntropometrico({ pacienteId, aoAbrirDetalhes }: ResumoAntropometricoProps) {
  const [serie, setSerie] = useState<SerieAntropometricaApi | null>(null);
  const [metricaId, setMetricaId] = useState('peso');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const iniciarRequisicao = useRequisicaoCancelavel();

  const carregar = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicao();
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await listarAvaliacoesAntropometricas(pacienteId, { signal });
      if (ehAtual()) setSerie(resposta);
    } catch (erroAtual) {
      if (ehAtual()) setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar a série antropométrica.'));
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }, [iniciarRequisicao, pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const metrica = METRICAS_ANTROPOMETRICAS.find((item) => item.id === metricaId) ?? METRICAS_ANTROPOMETRICAS[0];
  const pontos = useMemo<PontoEvolucao[]>(() =>
    (serie?.avaliacoes ?? [])
      .map((avaliacao) => ({ data: avaliacao.avaliadaEm, valor: metrica.ler(avaliacao) }))
      .filter((ponto): ponto is PontoEvolucao => ponto.valor !== undefined),
  [metrica, serie]);

  return (
    <section aria-labelledby="resumo-antropometrico-titulo" className="grid gap-4 rounded-md border border-linha bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="resumo-antropometrico-titulo" className="text-base font-semibold text-tinta">Evolução antropométrica</h2>
          <p className="mt-1 text-sm text-texto-suave">Série registrada no prontuário, sem recalculo dos resultados historicos.</p>
        </div>
        <Botao type="button" variante="secundario" onClick={aoAbrirDetalhes}>Abrir antropometria</Botao>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
          Metrica da série
          <select
            className="h-10 min-w-48 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
            value={metricaId}
            onChange={(evento) => setMetricaId(evento.target.value)}
          >
            {METRICAS_ANTROPOMETRICAS.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
          </select>
        </label>
        <BarraCarregamento visivel={carregando} rotulo="Carregando série antropométrica" />
      </div>

      {erro ? (
        <div role="alert" className="flex flex-col gap-3 rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte sm:flex-row sm:items-center sm:justify-between">
          <span>{erro}</span>
          <Botao type="button" variante="secundario" onClick={() => void carregar()}>Tentar novamente</Botao>
        </div>
      ) : null}

      {!carregando && !erro && !pontos.length ? (
        <p className="rounded-md border border-linha bg-superficie p-4 text-sm text-texto-suave">
          Nenhuma medida disponível para esta metrica.
        </p>
      ) : null}

      {!erro && pontos.length ? (
        <>
          <GraficoEvolucao
            pontos={pontos}
            rotulo={metrica.rotulo}
            unidade={metrica.unidade}
            casas={metrica.casas}
            descricao="A tabela abaixo apresenta os mesmos valores do gráfico."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-96 border-collapse text-left text-sm">
              <caption className="sr-only">Histórico de {metrica.rotulo.toLocaleLowerCase('pt-BR')}</caption>
              <thead>
                <tr className="border-b border-linha text-xs text-texto-suave">
                  <th scope="col" className="px-2 py-2 font-semibold">Data da avaliação</th>
                  <th scope="col" className="px-2 py-2 font-semibold">{metrica.rotulo}</th>
                </tr>
              </thead>
              <tbody>
                {(serie?.avaliacoes ?? []).map((avaliacao) => {
                  const valor = metrica.ler(avaliacao);
                  if (valor === undefined) return null;
                  return (
                    <tr key={avaliacao.id} className="border-b border-linha/70 last:border-0">
                      <td className="px-2 py-2 text-tinta">{formatarData(avaliacao.avaliadaEm)}</td>
                      <td className="px-2 py-2 font-medium text-tinta">
                        {formatarMetricaAntropometrica(valor, metrica.casas)} {metrica.unidade}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
