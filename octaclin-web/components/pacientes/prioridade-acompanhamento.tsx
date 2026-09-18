'use client';

import { FormEvent, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { converterDataOverrideParaIso } from '@/lib/prioridade-acompanhamento';
import {
  CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO,
  removerOverridePrioridadeAcompanhamento,
  solicitarOverridePrioridadeAcompanhamento,
  type CodigoMotivoOverridePrioridadeAcompanhamentoApi,
  type FaixaPrioridadeAcompanhamentoApi,
  type PrioridadeAcompanhamentoApi
} from '@/lib/prontuario-api';

interface Props {
  pacienteId: string;
  prioridade: PrioridadeAcompanhamentoApi | null;
  podeGerenciar: boolean;
  aoAtualizar: (prioridade: PrioridadeAcompanhamentoApi) => void;
}

const ROTULOS_FAIXA: Record<FaixaPrioridadeAcompanhamentoApi, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

function rotuloFaixa(faixa: FaixaPrioridadeAcompanhamentoApi) {
  return ROTULOS_FAIXA[faixa];
}

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(data);
}

function dataIsoParaCampo(dias: number) {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

const CODIGO_MOTIVO_PADRAO: CodigoMotivoOverridePrioridadeAcompanhamentoApi = CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO[0].codigo;

export function SecaoPrioridadeAcompanhamento({ pacienteId, prioridade, podeGerenciar, aoAtualizar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [faixa, setFaixa] = useState<FaixaPrioridadeAcompanhamentoApi>('media');
  const [codigoMotivo, setCodigoMotivo] = useState<CodigoMotivoOverridePrioridadeAcompanhamentoApi>(CODIGO_MOTIVO_PADRAO);
  const [justificativa, setJustificativa] = useState('');
  const [expiraEm, setExpiraEm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const overrideAtivo = prioridade?.valorEfetivo.origem === 'override' ? prioridade.override : undefined;

  function abrirAjuste() {
    setErro(null);
    setFaixa(overrideAtivo?.faixa ?? prioridade?.valorCalculado.faixa ?? 'media');
    setCodigoMotivo(CODIGO_MOTIVO_PADRAO);
    setJustificativa('');
    setExpiraEm(dataIsoParaCampo(30));
    setAberto(true);
  }

  async function salvarAjuste(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const expiraEmIso = converterDataOverrideParaIso(expiraEm);
      const atualizado = await solicitarOverridePrioridadeAcompanhamento(pacienteId, {
        faixa,
        codigoMotivo,
        justificativa,
        expiraEm: expiraEmIso
      });
      aoAtualizar(atualizado);
      setAberto(false);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível salvar o ajuste de prioridade.'));
    } finally {
      setSalvando(false);
    }
  }

  async function removerAjuste() {
    setRemovendo(true);
    setErro(null);
    try {
      const atualizado = await removerOverridePrioridadeAcompanhamento(pacienteId);
      aoAtualizar(atualizado);
      setConfirmandoRemocao(false);
      setAberto(false);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível remover o ajuste manual.'));
      setConfirmandoRemocao(false);
    } finally {
      setRemovendo(false);
    }
  }

  const faixaCalculada = prioridade?.valorCalculado.faixa ?? 'baixa';
  const scoreCalculado = prioridade?.valorCalculado.score ?? 0;
  const fatores = prioridade?.valorCalculado.fatores ?? [];
  const faixaEfetiva = prioridade?.valorEfetivo.faixa ?? faixaCalculada;

  return (
    <section aria-labelledby="prioridade-acompanhamento-titulo" className="grid gap-4 rounded-md border border-linha bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="prioridade-acompanhamento-titulo" className="text-base font-semibold text-tinta">Prioridade de acompanhamento</h2>
          <p className="mt-1 text-sm text-texto-suave">
            A prioridade ajuda a organizar quais pacientes podem precisar de acompanhamento mais cedo. O ajuste manual é temporário e não altera o cálculo automático do sistema.
          </p>
        </div>
        {podeGerenciar ? (
          <Botao type="button" variante="secundario" onClick={abrirAjuste}>
            Ajustar prioridade
          </Botao>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-linha bg-superficie-hover p-3">
          <p className="text-xs font-semibold uppercase text-texto-suave">Prioridade calculada</p>
          <p className="mt-1 text-sm font-medium text-tinta">{rotuloFaixa(faixaCalculada)} · {scoreCalculado} pontos</p>
          {fatores.length ? (
            <ul className="mt-2 grid gap-1 text-xs text-texto-suave">
              {fatores.map((fator) => (
                <li key={fator.codigo}>
                  {fator.codigo}{fator.quantidade ? ` (${fator.quantidade})` : ''}: {fator.pontos} pontos
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-texto-suave">Nenhum fator pontuado no último cálculo.</p>
          )}
        </div>
        <div
          className={
            overrideAtivo
              ? 'rounded-md border border-alerta-borda bg-alerta-suave p-3'
              : 'rounded-md border border-linha bg-superficie-hover p-3'
          }
        >
          <p className={overrideAtivo ? 'text-xs font-semibold uppercase text-alerta-forte' : 'text-xs font-semibold uppercase text-texto-suave'}>
            Prioridade efetiva
          </p>
          <p className={overrideAtivo ? 'mt-1 text-sm font-medium text-alerta-forte' : 'mt-1 text-sm font-medium text-tinta'}>
            {rotuloFaixa(faixaEfetiva)}{overrideAtivo ? ' — ajustada manualmente' : ' — calculada automaticamente'}
          </p>
          {overrideAtivo ? (
            <p className="mt-2 text-xs text-alerta-forte">Ajuste válido até {formatarData(overrideAtivo.expiraEm)}.</p>
          ) : (
            <p className="mt-2 text-xs text-texto-suave">Sem ajuste manual em vigor.</p>
          )}
        </div>
      </div>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Ajustar prioridade de acompanhamento"
        descricao="Isto registra uma exceção temporária à prioridade calculada, nunca uma decisão clínica automatizada."
      >
        {erro ? <AlertaOperacional mensagem={erro} className="mb-4" /> : null}
        <form onSubmit={salvarAjuste} className="grid gap-3">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Nova faixa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={faixa}
              onChange={(evento) => setFaixa(evento.target.value as FaixaPrioridadeAcompanhamentoApi)}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Motivo
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={codigoMotivo}
              onChange={(evento) => setCodigoMotivo(evento.target.value as CodigoMotivoOverridePrioridadeAcompanhamentoApi)}
            >
              {CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Justificativa
            <textarea
              className="min-h-[88px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
              value={justificativa}
              onChange={(evento) => setJustificativa(evento.target.value)}
              required
              minLength={3}
              maxLength={2000}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Válido até
            <input
              type="date"
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={expiraEm}
              onChange={(evento) => setExpiraEm(evento.target.value)}
              required
              min={dataIsoParaCampo(1)}
              max={dataIsoParaCampo(90)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            {overrideAtivo ? (
              <Botao type="button" variante="secundario" onClick={() => setConfirmandoRemocao(true)} disabled={salvando}>
                Remover ajuste
              </Botao>
            ) : null}
            <Botao type="submit" variante="primario" disabled={salvando}>
              {salvando ? 'Salvando' : overrideAtivo ? 'Salvar alteração' : 'Aplicar ajuste'}
            </Botao>
          </div>
        </form>
      </Modal>

      <ModalConfirmacao
        aberto={confirmandoRemocao}
        titulo="Remover ajuste manual"
        mensagem="A prioridade volta a refletir somente o cálculo automático do sistema."
        rotuloConfirmar="Remover"
        confirmando={removendo}
        aoConfirmar={() => void removerAjuste()}
        aoCancelar={() => setConfirmandoRemocao(false)}
      />
    </section>
  );
}
