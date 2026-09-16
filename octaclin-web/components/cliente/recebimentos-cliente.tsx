'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, Download, RefreshCcw } from 'lucide-react';
import { Botao, classesBotao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { FaixaAcoes } from '@/components/ui/faixa-acoes';
import { ResumoRecebimentosApi, formatarValorBRL, obterRecebimentosAgenda } from '@/lib/agenda-api';

/** Primeiro e ultimo dia do mes corrente, em `yyyy-MM-dd` para o campo `date`. */
function mesCorrente() {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const emTexto = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  return { inicio: emTexto(primeiro), fim: emTexto(ultimo) };
}

function formatarPercentual(valor: number) {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function formatarDiferencaValor(valorCentavos: number) {
  if (valorCentavos === 0) return 'Sem variação';
  return `${valorCentavos > 0 ? '+' : '-'}${formatarValorBRL(Math.abs(valorCentavos))}`;
}

function formatarDiferencaInteira(valor: number) {
  if (valor === 0) return 'Sem variação';
  return `${valor > 0 ? '+' : ''}${valor}`;
}

function formatarDiferencaPontosPercentuais(valor: number) {
  if (valor === 0) return 'Sem variação';
  const absoluto = Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${valor > 0 ? '+' : '-'}${absoluto} p.p.`;
}

function formatarPeriodo(inicioEm: string, fimEm: string) {
  const formatar = (valor: string) => new Date(valor).toLocaleDateString('pt-BR');
  return `${formatar(inicioEm)} a ${formatar(fimEm)}`;
}

interface ResumoRecebimentosProps {
  contexto?: 'gestor' | 'profissional';
  pacienteId?: string;
}

export function ResumoRecebimentos({ contexto = 'gestor', pacienteId }: ResumoRecebimentosProps) {
  const padrao = mesCorrente();
  const [inicio, setInicio] = useState(padrao.inicio);
  const [fim, setFim] = useState(padrao.fim);
  const [resumo, setResumo] = useState<ResumoRecebimentosApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (de: string, ate: string) => {
    setCarregando(true);
    setErro(null);
    try {
      // O fim do periodo vai ate o ultimo instante do dia escolhido: senao a
      // consulta das 15h do dia 31 fica de fora do fechamento do mes.
      setResumo(
        await obterRecebimentosAgenda({
          inicioEm: new Date(`${de}T00:00:00`).toISOString(),
          fimEm: new Date(`${ate}T23:59:59.999`).toISOString(),
          pacienteId
        })
      );
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar recebimentos.');
    } finally {
      setCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar(padrao.inicio, padrao.fim);
    // Carrega o mes corrente uma vez; as trocas de periodo passam pelo formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void carregar(inicio, fim);
  }

  const urlExportacaoCsv = resumo
    ? `/api/agenda/financeiro/recebimentos/exportar.csv?${new URLSearchParams({
        inicioEm: resumo.inicioEm,
        fimEm: resumo.fimEm,
        ...(pacienteId ? { pacienteId } : {})
      })}`
    : null;

  const indicadores = resumo
    ? [
        { rotulo: 'Recebido em consultas', valor: formatarValorBRL(resumo.recebidoCentavos) },
        { rotulo: 'A receber em consultas', valor: formatarValorBRL(resumo.pendenteCentavos) },
        { rotulo: 'Recebido em pacotes', valor: formatarValorBRL(resumo.pacotesRecebidoCentavos) },
        { rotulo: 'A receber em pacotes', valor: formatarValorBRL(resumo.pacotesPendenteCentavos) },
        { rotulo: 'Atendimentos no período', valor: String(resumo.consultas) },
        { rotulo: 'Atendimentos isentos', valor: String(resumo.isentas) }
      ]
    : [];

  const indicadoresPerformance = resumo?.performance
    ? [
        { rotulo: 'Consultas no período', valor: String(resumo.performance.totalConsultas) },
        { rotulo: 'Concluídas', valor: String(resumo.performance.concluidas) },
        { rotulo: 'Faltas', valor: String(resumo.performance.faltas) },
        { rotulo: 'Canceladas', valor: String(resumo.performance.canceladas) },
        {
          rotulo: 'Taxa de comparecimento',
          valor: formatarPercentual(resumo.performance.taxaComparecimentoPercentual)
        },
        { rotulo: 'Taxa de falta', valor: formatarPercentual(resumo.performance.taxaFaltaPercentual) },
        {
          rotulo: 'Taxa de cancelamento',
          valor: formatarPercentual(resumo.performance.taxaCancelamentoPercentual)
        },
        {
          rotulo: 'Ticket médio recebido',
          valor: formatarValorBRL(resumo.performance.ticketMedioRecebidoCentavos)
        }
      ]
    : [];

  const comparacao = resumo?.comparacaoPeriodoAnterior;
  const indicadoresComparacao = resumo?.performance && comparacao
    ? [
        {
          rotulo: 'Receita recebida',
          atual: resumo.recebidoCentavos + resumo.pacotesRecebidoCentavos,
          anterior: comparacao.recebidoCentavos + comparacao.pacotesRecebidoCentavos,
          formatar: formatarValorBRL,
          formatarDiferenca: formatarDiferencaValor
        },
        {
          rotulo: 'Consultas concluídas',
          atual: resumo.performance.concluidas,
          anterior: comparacao.performance.concluidas,
          formatar: String,
          formatarDiferenca: formatarDiferencaInteira
        },
        {
          rotulo: 'Taxa de comparecimento',
          atual: resumo.performance.taxaComparecimentoPercentual,
          anterior: comparacao.performance.taxaComparecimentoPercentual,
          formatar: formatarPercentual,
          formatarDiferenca: formatarDiferencaPontosPercentuais
        },
        {
          rotulo: 'Ticket médio recebido',
          atual: resumo.performance.ticketMedioRecebidoCentavos,
          anterior: comparacao.performance.ticketMedioRecebidoCentavos,
          formatar: formatarValorBRL,
          formatarDiferenca: formatarDiferencaValor
        }
      ]
    : [];

  return (
    <div className="grid gap-4">
      {erro ? (
        <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte">
          {erro}
        </p>
      ) : null}

      <Cartao>
        <CartaoCabecalho className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CartaoTitulo icone={<BadgeDollarSign className="h-4 w-4" />}>
            {pacienteId ? 'Recebimentos do paciente' : contexto === 'profissional' ? 'Meus recebimentos' : 'Recebimentos'}
          </CartaoTitulo>
          <FaixaAcoes rotulo="Ações de recebimentos" className="sm:justify-end">
            <BarraCarregamento visivel={carregando} rotulo="Carregando recebimentos" />
            <a
              href={urlExportacaoCsv ?? '#'}
              aria-disabled={!urlExportacaoCsv}
              onClick={(evento) => {
                if (!urlExportacaoCsv) evento.preventDefault();
              }}
              className={classesBotao({
                variante: 'secundario',
                className: 'aria-disabled:pointer-events-none aria-disabled:opacity-60'
              })}
            >
              <Download size={16} />
              Exportar CSV
            </a>
          </FaixaAcoes>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={aplicar}>
            <label className="grid gap-1">
              <Rotulo>Início</Rotulo>
              <Campo type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} />
            </label>
            <label className="grid gap-1">
              <Rotulo>Fim</Rotulo>
              <Campo type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} />
            </label>
            <div className="flex items-end">
              <Botao type="submit" disabled={carregando}>
                <RefreshCcw size={16} />
                Aplicar período
              </Botao>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {indicadores.map((indicador) => (
              <article key={indicador.rotulo} className="rounded-md border border-linha bg-superficie p-3">
                <p className="text-xs text-texto-suave">{indicador.rotulo}</p>
                <p className="mt-1 break-words text-base font-semibold">{indicador.valor}</p>
              </article>
            ))}
          </div>

          <p className="text-xs text-texto-suave">
            Consulta cancelada não entra no faturamento. Consulta paga por pacote aparece na linha de pacotes, não na
            de consultas: contar as duas somaria o mesmo atendimento duas vezes.
          </p>
        </CartaoConteudo>
      </Cartao>

      {resumo?.performance ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>
              {pacienteId
                ? 'Desempenho do paciente no período'
                : contexto === 'profissional'
                  ? 'Meu desempenho no período'
                  : 'Desempenho no período'}
            </CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indicadoresPerformance.map((indicador) => (
                <article key={indicador.rotulo} className="rounded-md border border-linha bg-superficie p-3">
                  <p className="text-xs text-texto-suave">{indicador.rotulo}</p>
                  <p className="mt-1 break-words text-base font-semibold">{indicador.valor}</p>
                </article>
              ))}
            </div>
            <p className="text-xs text-texto-suave">
              Comparecimento e falta usam apenas consultas concluídas ou marcadas como falta. A taxa de cancelamento
              usa todas as consultas do período. O ticket médio considera somente consultas pagas e não canceladas.
            </p>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      {comparacao ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Comparação com o período anterior</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo className="grid gap-4">
            <p className="text-xs text-texto-suave">
              Período anterior: {formatarPeriodo(comparacao.inicioEm, comparacao.fimEm)}. A comparação usa uma janela
              imediatamente anterior e com a mesma duração da seleção atual.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indicadoresComparacao.map((indicador) => {
                const diferenca = indicador.atual - indicador.anterior;
                return (
                  <article key={indicador.rotulo} className="rounded-md border border-linha bg-superficie p-3">
                    <p className="text-xs text-texto-suave">{indicador.rotulo}</p>
                    <p className="mt-1 text-base font-semibold">{indicador.formatar(indicador.atual)}</p>
                    <p className="mt-1 text-xs text-texto-suave">
                      Anterior: {indicador.formatar(indicador.anterior)} · {indicador.formatarDiferenca(diferenca)}
                    </p>
                  </article>
                );
              })}
            </div>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      {contexto === 'gestor' ? <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Por profissional</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          {!resumo || resumo.porProfissional.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum atendimento no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Recebimentos por profissional no período selecionado</caption>
                <thead>
                  <tr className="text-left text-xs text-texto-suave">
                    <th scope="col" className="py-2">Profissional</th>
                    <th scope="col" className="py-2 text-right">Atendimentos</th>
                    <th scope="col" className="py-2 text-right">Recebido</th>
                    <th scope="col" className="py-2 text-right">A receber</th>
                    <th scope="col" className="py-2 text-right">Comparecimento</th>
                    <th scope="col" className="py-2 text-right">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.porProfissional.map((linha) => (
                    <tr key={linha.profissionalId ?? 'sem-profissional'} className="border-t border-linha">
                      <th scope="row" className="py-2 text-left font-normal">{linha.profissionalNome}</th>
                      <td className="py-2 text-right">{linha.consultas}</td>
                      <td className="py-2 text-right">{formatarValorBRL(linha.recebidoCentavos)}</td>
                      <td className="py-2 text-right">{formatarValorBRL(linha.pendenteCentavos)}</td>
                      <td className="py-2 text-right">
                        {formatarPercentual(linha.performance.taxaComparecimentoPercentual)}
                      </td>
                      <td className="py-2 text-right">
                        {formatarValorBRL(linha.performance.ticketMedioRecebidoCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CartaoConteudo>
      </Cartao> : null}
    </div>
  );
}

export function RecebimentosCliente() {
  return <ResumoRecebimentos contexto="gestor" />;
}
