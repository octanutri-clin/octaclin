'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Modal } from '@/components/ui/modal';
import { ChaveKitInicialClinicaApi, EstadoKitInicialClinicaApi } from '@/lib/onboarding-operacoes-api';

type Props = {
  estado: EstadoKitInicialClinicaApi | null;
  carregando: boolean;
  salvando: boolean;
  erro: string | null;
  sucesso: string | null;
  selecionadas: ChaveKitInicialClinicaApi[];
  aoAlternar: (chave: ChaveKitInicialClinicaApi) => void;
  aoSelecionarPendentes: () => void;
  aoRecarregar: () => void;
  aoConfirmar: () => Promise<boolean>;
};

export function KitInicialSeletor({
  estado, carregando, salvando, erro, sucesso, selecionadas, aoAlternar,
  aoSelecionarPendentes, aoRecarregar, aoConfirmar
}: Props) {
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const itensSelecionados = estado?.itens.filter((item) => selecionadas.includes(item.chave)) ?? [];

  async function confirmar() {
    if (await aoConfirmar()) setConfirmacaoAberta(false);
  }

  return (
    <Cartao>
      <CartaoCabecalho>
        <div>
          <CartaoTitulo icone={<CheckCircle2 className="h-4 w-4" />}>Kit inicial da clínica</CartaoTitulo>
          <p className="mt-1 text-sm text-texto-suave">Adicione materiais genéricos e estruturas vazias para a equipe revisar.</p>
        </div>
        <Botao type="button" tamanho="sm" onClick={aoRecarregar} disabled={carregando || salvando}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />Atualizar
        </Botao>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-4" aria-live="polite">
        {carregando ? <p role="status" className="text-sm text-texto-suave">Carregando o estado do kit…</p> : null}
        {erro ? <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo">{erro}</p> : null}
        {sucesso ? <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">{sucesso}</p> : null}
        {estado?.motivoBloqueio ? <p role="status" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm">Instalação bloqueada: {estado.motivoBloqueio.replaceAll('_', ' ')}.</p> : null}
        {estado ? <>
          <p className="text-sm text-texto-suave">
            {estado.estado === 'completo' ? 'Kit completo.' : estado.estado === 'parcial' ? 'Kit parcialmente instalado. Você pode completar os itens restantes.' : 'Nenhum item do kit foi instalado.'}
            {' '}A instalação não envia conteúdo ao paciente. O profissional revisa e completa as estruturas antes de usá-las.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {estado.itens.map((item) => (
              <label key={item.chave} className={`grid min-h-28 gap-2 rounded-lg border p-4 ${item.instalado ? 'border-sucesso-borda bg-sucesso-suave/40' : 'border-linha bg-superficie'}`}>
                <span className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-primaria"
                    checked={item.instalado || selecionadas.includes(item.chave)}
                    disabled={item.instalado || !estado.podeInstalar || carregando || salvando}
                    onChange={() => aoAlternar(item.chave)}
                    aria-label={`${item.instalado ? 'Instalado' : 'Selecionar'}: ${item.titulo}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-texto-forte">{item.titulo}</span>
                    <span className="mt-1 block text-sm text-texto-suave">{item.resumo}</span>
                    {item.tipo === 'estrutura' ? <span className="mt-2 block text-xs text-texto-suave">{item.refeicoes?.length ?? 0} refeições vazias</span> : null}
                  </span>
                  <span className="ml-auto shrink-0 text-xs font-medium text-texto-suave">{item.instalado ? 'Instalado' : 'Pendente'}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Botao type="button" onClick={aoSelecionarPendentes} disabled={!estado.podeInstalar || carregando || salvando}>
              Selecionar itens pendentes
            </Botao>
            <Botao
              type="button"
              variante="primario"
              disabled={!estado.podeInstalar || selecionadas.length === 0 || carregando || salvando}
              onClick={() => setConfirmacaoAberta(true)}
            >
              Confirmar instalação ({selecionadas.length})
            </Botao>
          </div>
        </> : null}
      </CartaoConteudo>
      <Modal
        aberto={confirmacaoAberta}
        aoFechar={() => { if (!salvando) setConfirmacaoAberta(false); }}
        titulo="Confirmar instalação do kit"
        descricao={estado ? `Clínica: ${estado.tenantNome}. A confirmação autoriza adicionar estes itens.` : undefined}
      >
        <div className="grid gap-4">
          <ul className="grid gap-2 text-sm">
            {itensSelecionados.map((item) => <li key={item.chave} className="flex items-start gap-2"><Circle size={14} className="mt-1 shrink-0" aria-hidden="true" />{item.titulo}</li>)}
          </ul>
          <p className="text-sm text-texto-suave">Itens já instalados permanecem como estão. A operação não remove nem reativa itens anteriores.</p>
          <div className="flex justify-end gap-2">
            <Botao type="button" onClick={() => setConfirmacaoAberta(false)} disabled={salvando}>Cancelar</Botao>
            <Botao type="button" variante="primario" carregando={salvando} onClick={() => void confirmar()}>Confirmar</Botao>
          </div>
        </div>
      </Modal>
    </Cartao>
  );
}
