'use client';

import type { ExamesForaFaixaResumoApi } from '@/lib/prontuario-api';
import { Botao } from '@/components/ui/botao';

interface ResumoExamesForaFaixaProps {
  dados?: ExamesForaFaixaResumoApi;
  carregando: boolean;
  podeLer: boolean;
  aoTentarNovamente: () => void;
  aoAbrirExames: () => void;
}

function formatarDataCivil(dataCivil: string): string {
  const data = new Date(`${dataCivil.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return dataCivil;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

function formatarFaixa(limiteInferior?: string, limiteSuperior?: string, unidade?: string): string {
  if (limiteInferior !== undefined && limiteSuperior !== undefined) return `${limiteInferior} a ${limiteSuperior} ${unidade ?? ''}`.trim();
  if (limiteInferior !== undefined) return `A partir de ${limiteInferior} ${unidade ?? ''}`.trim();
  if (limiteSuperior !== undefined) return `Até ${limiteSuperior} ${unidade ?? ''}`.trim();
  return 'Sem faixa numérica registrada';
}

export function ResumoExamesForaFaixa({
  dados,
  carregando,
  podeLer,
  aoTentarNovamente,
  aoAbrirExames
}: ResumoExamesForaFaixaProps) {
  const indisponivel = !dados || dados.status === 'indisponivel';
  const leitura = dados?.status === 'disponivel' ? dados : undefined;

  return (
    <section
      aria-labelledby="resumo-exames-fora-faixa-titulo"
      className="grid min-w-0 gap-3 rounded-md border border-linha bg-white p-4"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="resumo-exames-fora-faixa-titulo" className="text-sm font-semibold text-tinta">
            Exames fora da faixa informada
          </h3>
          <p className="mt-1 text-xs text-texto-suave">
            Último resultado por grupo nas coletas analisadas. Os resultados são apresentados como registrados.
          </p>
        </div>
        {podeLer && !indisponivel && !carregando ? (
          <Botao type="button" variante="secundario" tamanho="sm" className="shrink-0" onClick={aoAbrirExames}>
            Ver exames laboratoriais
          </Botao>
        ) : null}
      </div>

      {!podeLer ? (
        <p className="text-sm text-texto-suave">Acesso não disponível.</p>
      ) : carregando ? (
        <p role="status" className="text-sm text-texto-suave">Carregando o resumo dos exames…</p>
      ) : indisponivel ? (
        <div className="grid justify-items-start gap-2" role="group" aria-label="Resumo de exames indisponível">
          <p role="status" className="text-sm text-texto-suave">Resumo dos exames indisponível.</p>
          <Botao type="button" variante="secundario" tamanho="sm" onClick={aoTentarNovamente}>
            Tentar novamente
          </Botao>
        </div>
      ) : leitura ? (
        <div aria-live="polite" className="grid min-w-0 gap-3">
          <p className="text-xs text-texto-suave">
            Último resultado por grupo entre {leitura.coletasAnalisadas} {leitura.coletasAnalisadas === 1 ? 'coleta' : 'coletas'} analisadas.
          </p>

          {leitura.coletasAnalisadas === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum exame registrado.</p>
          ) : leitura.gruposAnalisados === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum resultado de exame disponível nas coletas analisadas.</p>
          ) : leitura.itens.length === 0 ? (
            <p className="text-sm text-texto-suave">
              Nenhum resultado fora da faixa informada nos grupos classificáveis analisados.
            </p>
          ) : (
            <ul aria-label="Resultados mais recentes fora da faixa" className="grid min-w-0 gap-2 sm:grid-cols-2">
              {leitura.itens.map((item) => (
                <li key={item.resultadoId} className="min-w-0 rounded-md border border-linha p-3">
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <p className="min-w-0 break-words text-sm font-semibold text-tinta">{item.nome}</p>
                    <p className="shrink-0 text-sm font-semibold text-tinta">
                      {item.valor} {item.unidade}
                    </p>
                  </div>
                  <dl className="mt-2 grid min-w-0 gap-1 text-xs text-texto-suave">
                    <div className="flex min-w-0 flex-wrap gap-x-1">
                      <dt>Faixa registrada:</dt>
                      <dd className="break-words font-medium text-tinta">
                        {formatarFaixa(item.limiteInferior, item.limiteSuperior, item.unidade)}
                      </dd>
                    </div>
                    {item.referencia ? (
                      <div className="flex min-w-0 flex-wrap gap-x-1">
                        <dt>Referência:</dt><dd className="break-words">{item.referencia}</dd>
                      </div>
                    ) : null}
                    {item.metodo ? (
                      <div className="flex min-w-0 flex-wrap gap-x-1">
                        <dt>Método:</dt><dd className="break-words">{item.metodo}</dd>
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-wrap gap-x-1">
                      <dt>Coletado em:</dt><dd>{formatarDataCivil(item.coletadaEm)}</dd>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-x-1">
                      <dt>Agrupamento:</dt>
                      <dd>{item.origemAgrupamento === 'catalogo' ? 'Catálogo' : 'Nome livre'}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}

          {leitura.gruposNomeLivre > 0 ? (
            <p className="text-xs text-texto-suave">
              Nomes livres são agrupados por nome, unidade e método e permanecem separados dos marcadores do catálogo.
            </p>
          ) : null}
          {leitura.semClassificacao > 0 ? (
            <p className="text-xs text-texto-suave">
              {leitura.semClassificacao} {leitura.semClassificacao === 1 ? 'grupo sem classificação' : 'grupos sem classificação'}
              {' '}por ausência de valor numérico, unidade ou faixa válida. Consulte Exames para os detalhes.
            </p>
          ) : null}
          {leitura.duplicadosNaUltimaColeta > 0 ? (
            <p className="text-xs text-texto-suave">
              {leitura.duplicadosNaUltimaColeta} {leitura.duplicadosNaUltimaColeta === 1 ? 'grupo com resultado duplicado' : 'grupos com resultados duplicados'}
              {' '}na coleta — consultar Exames.
            </p>
          ) : null}
          {leitura.historicoTruncado ? (
            <p className="text-xs text-texto-suave">
              Resumo limitado às 100 coletas mais recentes. Há histórico anterior na aba Exames.
            </p>
          ) : null}
          {leitura.itensLimitados ? (
            <p className="text-xs text-texto-suave">
              Mostrando {leitura.itens.length} de {leitura.totalForaFaixa} resultados fora da faixa nas coletas analisadas.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
