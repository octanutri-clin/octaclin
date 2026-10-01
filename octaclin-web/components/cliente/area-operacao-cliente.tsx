'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { obterPainelOperacaoCliente, PainelOperacaoClienteApi } from '@/lib/cliente-api';

function percentual(valor: number | null): string {
  return valor === null ? 'Sem dados' : `${valor}%`;
}

export function AreaOperacaoCliente() {
  const [mes, setMes] = useState('');
  const [painel, setPainel] = useState<PainelOperacaoClienteApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizacao, setAtualizacao] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    void obterPainelOperacaoCliente(mes || undefined)
      .then((dados) => {
        if (!controlador.signal.aborted) setPainel(dados);
      })
      .catch((falha) => {
        if (!controlador.signal.aborted) setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os indicadores.');
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(false);
      });
    return () => controlador.abort();
  }, [mes, atualizacao]);

  return (
    <section id="conta-cliente-operacao-painel" role="tabpanel" aria-labelledby="conta-cliente-operacao-aba" className="grid gap-5" aria-busy={carregando}>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-linha bg-white p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primaria">
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> Mês de referência
          </div>
          <h2 className="mt-2 text-xl font-semibold text-texto-forte">Operação da clínica</h2>
          <p className="mt-1 text-sm text-texto-suave">Indicadores do mês civil no fuso da clínica. Pacientes ativos e prioridade de acompanhamento refletem o cadastro atual.</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="grid gap-1 text-sm font-medium text-texto-forte">
            Mês
            <input type="month" name="mes-operacao" autoComplete="off" value={mes || painel?.mes || ''} onChange={(evento) => {
              setPainel(null);
              setErro(null);
              setCarregando(true);
              setMes(evento.target.value);
            }}
              className="min-h-10 rounded-md border border-linha bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" />
          </label>
          <button type="button" onClick={() => {
            setPainel(null);
            setErro(null);
            setCarregando(true);
            setAtualizacao((valor) => valor + 1);
          }}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-texto-forte hover:bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </button>
        </div>
      </div>

      {erro ? <p role="alert" className="rounded-md border border-perigo-borda bg-white p-4 text-sm text-perigo">{erro}</p> : null}
      {carregando && !painel ? <p role="status" className="text-sm text-texto-suave">Carregando indicadores…</p> : null}
      {painel ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { rotulo: 'Pacientes novos', valor: painel.pacientes.novos, detalhe: 'Cadastrados neste mês e ativos hoje' },
              { rotulo: 'Pacientes ativos', valor: painel.pacientes.ativos, detalhe: 'Ciclo ACTIVE, não arquivados' },
              { rotulo: 'Alta prioridade de acompanhamento', valor: painel.pacientes.emRisco, detalhe: 'Faixa efetiva alta entre pacientes ativos' }
            ].map((indicador) => (
              <article key={indicador.rotulo} className="rounded-lg border border-linha bg-white p-5">
                <h3 className="text-sm font-medium text-texto-suave">{indicador.rotulo}</h3>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-texto-forte">{indicador.valor}</p>
                <p className="mt-2 text-xs text-texto-suave">{indicador.detalhe}</p>
              </article>
            ))}
          </div>

          <div className="rounded-lg border border-linha bg-white p-5">
            <h3 className="text-lg font-semibold text-texto-forte">Carga por profissional</h3>
            <p className="mt-1 text-sm text-texto-suave">Ocupação = minutos reservados dentro do expediente ÷ minutos disponíveis, sem contar horários sobrepostos duas vezes. Falta mantém o horário ocupado; cancelamento não ocupa.</p>
            <p className="mt-1 text-sm text-texto-suave">Conclusão = concluídas ÷ (concluídas + faltas). No-show = faltas ÷ (concluídas + faltas). Canceladas ficam fora dessas taxas; sem desfecho, ambas ficam sem dados. Essas medidas descrevem a agenda, não a qualidade clínica.</p>
            <p className="mt-1 text-sm text-texto-suave">Consultas e desfechos são contados pelo início no mês e pelo estado atual do agendamento. Profissionais arquivados com atividade no período permanecem visíveis.</p>
            {painel.profissionais.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="border-b border-linha text-xs text-texto-suave"><tr>
                    <th scope="col" className="py-3 pr-4 font-medium">Profissional</th>
                    <th scope="col" className="px-3 py-3 font-medium">Pacientes</th>
                    <th scope="col" className="px-3 py-3 font-medium">Consultas</th>
                    <th scope="col" className="px-3 py-3 font-medium">Concluídas</th>
                    <th scope="col" className="px-3 py-3 font-medium">Conclusão</th>
                    <th scope="col" className="px-3 py-3 font-medium">Faltas</th>
                    <th scope="col" className="px-3 py-3 font-medium">Canceladas</th>
                    <th scope="col" className="px-3 py-3 font-medium">Ocupação</th>
                    <th scope="col" className="px-3 py-3 font-medium">No-show</th>
                    <th scope="col" className="px-3 py-3 font-medium">Fora do expediente</th>
                  </tr></thead>
                  <tbody>{painel.profissionais.map((profissional) => (
                    <tr key={profissional.id} className="border-b border-linha last:border-0">
                      <th scope="row" className="break-words py-3 pr-4 font-medium text-texto-forte">{profissional.nome}{profissional.arquivado ? <span className="ml-2 text-xs font-normal text-texto-suave">(Arquivado)</span> : null}</th>
                      <td className="px-3 py-3 tabular-nums">{profissional.pacientesResponsaveis}</td>
                      <td className="px-3 py-3 tabular-nums">{profissional.consultas}</td>
                      <td className="px-3 py-3 tabular-nums">{profissional.concluidas}</td>
                      <td className="px-3 py-3 tabular-nums">{percentual(profissional.taxaConclusao)}</td>
                      <td className="px-3 py-3 tabular-nums">{profissional.faltas}</td>
                      <td className="px-3 py-3 tabular-nums">{profissional.canceladas}</td>
                      <td className="px-3 py-3 tabular-nums">{percentual(profissional.ocupacaoPercentual)}</td>
                      <td className="px-3 py-3 tabular-nums">{percentual(profissional.taxaNoShow)}</td>
                      <td className="px-3 py-3 tabular-nums">{profissional.consultasForaExpediente ?? 'Sem dados'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-sm text-texto-suave">Ainda não há profissionais com dados para apresentar.</p>}
            {painel.consultasSemProfissional > 0 ? <p className="mt-3 text-xs text-texto-suave">{painel.consultasSemProfissional} consultas sem profissional atribuído neste mês.</p> : null}
          </div>
          <p className="text-xs text-texto-suave">Consultas e pacientes novos: {painel.mes} ({painel.timezone}). Sem expediente cadastrado, a ocupação e as consultas fora do expediente ficam sem dados.</p>
        </>
      ) : null}
    </section>
  );
}
