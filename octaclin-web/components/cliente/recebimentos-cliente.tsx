'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BadgeDollarSign, RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
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
          fimEm: new Date(`${ate}T23:59:59`).toISOString(),
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

  const indicadores = resumo
    ? [
        { rotulo: 'Recebido em consultas', valor: formatarValorBRL(resumo.recebidoCentavos) },
        { rotulo: 'A receber em consultas', valor: formatarValorBRL(resumo.pendenteCentavos) },
        { rotulo: 'Recebido em pacotes', valor: formatarValorBRL(resumo.pacotesRecebidoCentavos) },
        { rotulo: 'A receber em pacotes', valor: formatarValorBRL(resumo.pacotesPendenteCentavos) },
        { rotulo: 'Atendimentos no periodo', valor: String(resumo.consultas) },
        { rotulo: 'Atendimentos isentos', valor: String(resumo.isentas) }
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
          <BarraCarregamento visivel={carregando} rotulo="Carregando recebimentos" />
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-4">
          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={aplicar}>
            <label className="grid gap-1">
              <Rotulo>Inicio</Rotulo>
              <Campo type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} />
            </label>
            <label className="grid gap-1">
              <Rotulo>Fim</Rotulo>
              <Campo type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} />
            </label>
            <div className="flex items-end">
              <Botao type="submit" disabled={carregando}>
                <RefreshCcw size={16} />
                Aplicar periodo
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
            Consulta cancelada nao entra no faturamento. Consulta paga por pacote aparece na linha de pacotes, nao na
            de consultas: contar as duas somaria o mesmo atendimento duas vezes.
          </p>
        </CartaoConteudo>
      </Cartao>

      {contexto === 'gestor' ? <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Por profissional</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          {!resumo || resumo.porProfissional.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum atendimento no periodo selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Recebimentos por profissional no periodo selecionado</caption>
                <thead>
                  <tr className="text-left text-xs text-texto-suave">
                    <th scope="col" className="py-2">Profissional</th>
                    <th scope="col" className="py-2 text-right">Atendimentos</th>
                    <th scope="col" className="py-2 text-right">Recebido</th>
                    <th scope="col" className="py-2 text-right">A receber</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.porProfissional.map((linha) => (
                    <tr key={linha.profissionalId ?? 'sem-profissional'} className="border-t border-linha">
                      <th scope="row" className="py-2 text-left font-normal">{linha.profissionalNome}</th>
                      <td className="py-2 text-right">{linha.consultas}</td>
                      <td className="py-2 text-right">{formatarValorBRL(linha.recebidoCentavos)}</td>
                      <td className="py-2 text-right">{formatarValorBRL(linha.pendenteCentavos)}</td>
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
