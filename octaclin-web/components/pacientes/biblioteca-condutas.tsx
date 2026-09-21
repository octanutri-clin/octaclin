'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { BookmarkPlus, LayoutTemplate } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarBibliotecaConduta,
  criarBibliotecaConduta,
  listarBibliotecaCondutas,
  obterBibliotecaConduta,
  type BibliotecaCondutaResumoApi,
  type TipoCondutaTerapeuticaApi
} from '@/lib/condutas-terapeuticas-api';

const ROTULO_TIPO: Record<TipoCondutaTerapeuticaApi, string> = {
  meta: 'Meta',
  orientacao: 'Orientação',
  suplemento: 'Suplemento',
  produto: 'Produto',
  formula_manipulada: 'Fórmula manipulada'
};

export interface BibliotecaCondutasProps {
  /** Tipo/titulo/conteudo atuais do formulario, para salvar na biblioteca. */
  formularioAtual: () => { tipo: TipoCondutaTerapeuticaApi; titulo: string; conteudo: string };
  /** Substitui tipo/titulo/conteudo do formulario pelo item escolhido. */
  aoAplicar: (item: { tipo: TipoCondutaTerapeuticaApi; titulo: string; conteudo: string }) => void;
  desabilitado?: boolean;
}

export function BibliotecaCondutas({ formularioAtual, aoAplicar, desabilitado = false }: BibliotecaCondutasProps) {
  const id = useId();
  const [itens, setItens] = useState<BibliotecaCondutaResumoApi[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [nome, setNome] = useState('');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const carregar = useCallback(async () => {
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await listarBibliotecaCondutas();
      setItens(pagina.itens);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar a biblioteca de condutas.'));
    } finally {
      setOcupado(null);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aplicar() {
    if (!selecionado) return;
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    try {
      const item = await obterBibliotecaConduta(selecionado);
      aoAplicar({ tipo: item.tipo, titulo: item.nome, conteudo: item.conteudo });
      setAviso('Item aplicado. Revise antes de criar o rascunho.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar o item da biblioteca.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    const formulario = formularioAtual();
    if (!nome.trim() || formulario.conteudo.trim().length < 3) {
      setErro('Informe um nome e ao menos 3 caracteres no conteúdo da conduta.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      await criarBibliotecaConduta({ nome: nome.trim(), tipo: formulario.tipo, conteudo: formulario.conteudo });
      setNome('');
      setAviso('Item salvo na biblioteca.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar na biblioteca.'));
    } finally {
      setOcupado(null);
    }
  }

  async function arquivar() {
    setConfirmarRemocao(false);
    if (!selecionado) return;
    setOcupado('arquivando');
    setErro(null);
    try {
      await arquivarBibliotecaConduta(selecionado);
      setSelecionado('');
      setAviso('Item removido da biblioteca.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível remover o item da biblioteca.'));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex items-center gap-2">
        <LayoutTemplate aria-hidden="true" size={17} className="text-primaria" />
        <h3 className="text-sm font-semibold text-tinta">Biblioteca de condutas</h3>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="rounded-md bg-superficie px-3 py-2 text-sm text-tinta">
          {aviso}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-item`}>Aplicar item da biblioteca</Rotulo>
          <Selecao
            id={`${id}-item`}
            value={selecionado}
            onChange={(evento) => setSelecionado(evento.target.value)}
            disabled={desabilitado || !itens.length}
          >
            <option value="">{itens.length ? 'Escolha um item' : 'Nenhum item salvo'}</option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} - {ROTULO_TIPO[item.tipo]}
              </option>
            ))}
          </Selecao>
        </div>
        <Botao
          type="button"
          variante="primario"
          className="min-h-11"
          onClick={() => void aplicar()}
          carregando={ocupado === 'aplicando'}
          disabled={desabilitado || !selecionado || Boolean(ocupado)}
        >
          Aplicar
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          className="min-h-11"
          onClick={() => setConfirmarRemocao(true)}
          disabled={desabilitado || !selecionado || Boolean(ocupado)}
        >
          Remover
        </Botao>
      </div>

      <div className="grid gap-2 border-t border-linha pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-nome`}>Salvar conduta atual na biblioteca</Rotulo>
          <Campo
            id={`${id}-nome`}
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            maxLength={180}
            placeholder="Nome do item na biblioteca"
            disabled={desabilitado}
          />
        </div>
        <Botao
          type="button"
          className="min-h-11"
          onClick={() => void salvar()}
          carregando={ocupado === 'salvando'}
          disabled={desabilitado || !nome.trim() || Boolean(ocupado)}
        >
          <BookmarkPlus aria-hidden="true" size={15} />
          Salvar na biblioteca
        </Botao>
      </div>

      <ModalConfirmacao
        aberto={confirmarRemocao}
        titulo="Remover item da biblioteca"
        mensagem="O item deixa de aparecer na lista. Condutas já criadas a partir dele não mudam."
        rotuloConfirmar="Remover"
        aoConfirmar={() => void arquivar()}
        aoCancelar={() => setConfirmarRemocao(false)}
      />
    </section>
  );
}
