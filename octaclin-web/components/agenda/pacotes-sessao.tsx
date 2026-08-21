'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Package, RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import {
  FormaPagamentoConsulta,
  PacoteSessaoApi,
  ROTULOS_FORMA_PAGAMENTO,
  ROTULOS_STATUS_PAGAMENTO,
  cancelarPacoteSessao,
  centavosDeTexto,
  criarPacoteSessao,
  formatarValorBRL,
  listarPacotesSessao
} from '@/lib/agenda-api';
import { PacienteResumo } from '@/lib/cadastros-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';

const FORMAS = Object.keys(ROTULOS_FORMA_PAGAMENTO).filter(
  (forma): forma is FormaPagamentoConsulta => forma !== 'pacote'
);

interface PacotesSessaoProps {
  pacientes: PacienteResumo[];
  pacienteIdSugerido?: string;
  /** Sobe para a agenda quando a lista muda: o seletor de pacote da consulta reflete na hora. */
  aoMudar?: () => void;
}

export function PacotesSessao({ pacientes, pacienteIdSugerido, aoMudar }: PacotesSessaoProps) {
  const [pacienteId, setPacienteId] = useState(pacienteIdSugerido ?? '');
  const [pacotes, setPacotes] = useState<PacoteSessaoApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async (paciente: string) => {
    if (!paciente) {
      setPacotes([]);
      return;
    }
    setCarregando(true);
    try {
      setPacotes(await listarPacotesSessao(paciente));
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar os pacotes.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(pacienteId);
  }, [carregar, pacienteId]);

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const campos = new FormData(evento.currentTarget);
    const formulario = evento.currentTarget;
    setErro(null);
    setSucesso(null);
    setSalvando(true);
    try {
      const statusPagamento = String(campos.get('statusPagamento') ?? 'pendente') as 'pendente' | 'pago' | 'isento';
      await criarPacoteSessao({
        pacienteId,
        titulo: String(campos.get('titulo') ?? '').trim(),
        sessoesContratadas: Number(campos.get('sessoesContratadas') ?? 0),
        valorTotalCentavos: centavosDeTexto(String(campos.get('valorTotal') ?? '')),
        formaPagamento: (String(campos.get('formaPagamento') ?? '') || undefined) as FormaPagamentoConsulta | undefined,
        statusPagamento,
        validadeEm: String(campos.get('validadeEm') ?? '') || undefined
      });
      formulario.reset();
      setSucesso('Pacote criado. Agende as consultas vinculando ao pacote.');
      await carregar(pacienteId);
      aoMudar?.();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível criar o pacote.'));
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(pacote: PacoteSessaoApi) {
    setErro(null);
    setSucesso(null);
    try {
      await cancelarPacoteSessao(pacote.id);
      setSucesso('Pacote cancelado. As consultas já agendadas continuam na agenda.');
      await carregar(pacienteId);
      aoMudar?.();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível cancelar o pacote.'));
    }
  }

  return (
    <Cartao>
      <CartaoCabecalho className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CartaoTitulo icone={<Package className="h-4 w-4" />}>Pacotes de sessoes</CartaoTitulo>
        <BarraCarregamento visivel={carregando} rotulo="Carregando pacotes" />
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-3">
        {erro ? (
          <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte">
            {erro}
          </p>
        ) : null}
        {sucesso ? (
          <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">
            {sucesso}
          </p>
        ) : null}

        <label className="grid gap-1">
          <Rotulo>Paciente</Rotulo>
          <Selecao value={pacienteId} onChange={(evento) => setPacienteId(evento.target.value)}>
            <option value="">Selecione</option>
            {pacientes.map((paciente) => (
              <option key={paciente.id} value={paciente.id}>
                {paciente.nome}
              </option>
            ))}
          </Selecao>
        </label>

        {pacienteId ? (
          <>
            {pacotes.length === 0 && !carregando ? (
              <p className="text-sm text-texto-suave">Nenhum pacote para este paciente.</p>
            ) : (
              <ul className="grid gap-2">
                {pacotes.map((pacote) => (
                  <li key={pacote.id} className="rounded-md border border-linha bg-superficie p-3 text-sm">
                    <p className="font-semibold">{pacote.titulo}</p>
                    <p className="text-texto-suave">
                      {pacote.sessoesConsumidas} usadas, {pacote.sessoesReservadas} agendadas e{' '}
                      {pacote.sessoesDisponiveis} disponíveis de {pacote.sessoesContratadas}
                    </p>
                    <p className="text-texto-suave">
                      {formatarValorBRL(pacote.valorTotalCentavos)} - {ROTULOS_STATUS_PAGAMENTO[pacote.statusPagamento]}
                      {pacote.validadeEm ? ` - validade ${pacote.validadeEm}` : ''}
                      {pacote.vencido ? ' (vencido)' : ''}
                      {pacote.canceladoEm ? ' (cancelado)' : ''}
                    </p>
                    {!pacote.canceladoEm ? (
                      <div className="mt-2">
                        <Botao type="button" variante="perigo" onClick={() => void cancelar(pacote)}>
                          Cancelar pacote
                        </Botao>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <form className="grid gap-3 border-t border-linha pt-3" onSubmit={criar}>
              <label className="grid gap-1">
                <Rotulo>Título</Rotulo>
                <Campo name="titulo" required maxLength={180} placeholder="Pacote 10 consultas" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <Rotulo>Sessoes</Rotulo>
                  <Campo name="sessoesContratadas" type="number" min={1} max={200} defaultValue={10} required />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Valor total</Rotulo>
                  <Campo name="valorTotal" inputMode="decimal" placeholder="1.500,00" />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Forma de pagamento</Rotulo>
                  <Selecao name="formaPagamento" defaultValue="">
                    <option value="">Definir depois</option>
                    {FORMAS.map((forma) => (
                      <option key={forma} value={forma}>
                        {ROTULOS_FORMA_PAGAMENTO[forma]}
                      </option>
                    ))}
                  </Selecao>
                </label>
                <label className="grid gap-1">
                  <Rotulo>Situação</Rotulo>
                  <Selecao name="statusPagamento" defaultValue="pendente">
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="isento">Isento</option>
                  </Selecao>
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <Rotulo>Validade</Rotulo>
                  <Campo name="validadeEm" type="date" />
                </label>
              </div>
              <div className="flex justify-end">
                <Botao type="submit" variante="primario" carregando={salvando} disabled={salvando}>
                  <RefreshCcw size={16} />
                  Criar pacote
                </Botao>
              </div>
            </form>
          </>
        ) : null}
      </CartaoConteudo>
    </Cartao>
  );
}
