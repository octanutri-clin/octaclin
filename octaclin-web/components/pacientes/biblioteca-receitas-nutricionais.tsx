'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Archive, BookOpenCheck, Plus, UtensilsCrossed } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarReceitaNutricional,
  criarReceitaNutricional,
  listarReceitasNutricionais,
  obterReceitaNutricional,
  type ItemPlanoAlimentarEntrada,
  type OrigemReceitaNutricionalApi,
  type ReceitaNutricionalResumoApi,
  type TipoReceitaNutricionalApi
} from '@/lib/plano-alimentar-api';

interface RefeicaoDisponivel {
  chave: string;
  nome: string;
  itens: ItemPlanoAlimentarEntrada[];
}

interface BibliotecaReceitasNutricionaisProps {
  refeicoes: () => RefeicaoDisponivel[];
  aoInserir: (chaveRefeicao: string, itens: ItemPlanoAlimentarEntrada[]) => void;
  desabilitado?: boolean;
}

const ROTULO_TIPO: Record<TipoReceitaNutricionalApi, string> = {
  receita: 'Receita',
  refeicao_pronta: 'Refeicao pronta'
};

/**
 * Biblioteca que nunca grava diretamente no plano. Aplicar so atualiza o
 * formulario local; o salvamento do rascunho e quem revalida e calcula.
 */
export function BibliotecaReceitasNutricionais({
  refeicoes,
  aoInserir,
  desabilitado = false
}: BibliotecaReceitasNutricionaisProps) {
  const id = useId();
  const [itens, setItens] = useState<ReceitaNutricionalResumoApi[]>([]);
  const [selecionada, setSelecionada] = useState('');
  const [refeicaoDestino, setRefeicaoDestino] = useState(() => refeicoes()[0]?.chave ?? '');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemReceitaNutricionalApi>('pessoal');
  const [tipo, setTipo] = useState<TipoReceitaNutricionalApi>('receita');
  const [instrucoes, setInstrucoes] = useState('');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);

  const refeicoesAtuais = refeicoes();
  const refeicaoDestinoAtual = refeicoesAtuais.some((refeicao) => refeicao.chave === refeicaoDestino)
    ? refeicaoDestino
    : (refeicoesAtuais[0]?.chave ?? '');
  const receitaAtual = useMemo(() => itens.find((item) => item.id === selecionada), [itens, selecionada]);

  const carregar = async () => {
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await listarReceitasNutricionais({ pagina: 1, limite: 100 });
      setItens(pagina.itens);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar as receitas.'));
    } finally {
      setOcupado(null);
    }
  };

  useEffect(() => {
    const agendamento = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(agendamento);
  }, []);

  async function aplicar() {
    if (!selecionada || !refeicaoDestinoAtual) return;
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    try {
      const receita = await obterReceitaNutricional(selecionada);
      if (receita.alimentosIndisponiveis.length) {
        setErro(
          `${receita.alimentosIndisponiveis.length} alimento(s) desta receita sairam do catalogo ativo. Revise a receita antes de aplicar.`
        );
        return;
      }
      aoInserir(refeicaoDestinoAtual, receita.itens);
      setAviso(`${ROTULO_TIPO[receita.tipo]} inserida no rascunho. Salve o plano para recalcular os totais.`);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    const refeicao = refeicoesAtuais.find((item) => item.chave === refeicaoDestinoAtual);
    if (!nome.trim()) {
      setErro('Informe um nome para salvar na biblioteca.');
      return;
    }
    if (!refeicao?.itens.length) {
      setErro('Escolha uma refeicao com ao menos um alimento para salvar.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      await criarReceitaNutricional({
        nome: nome.trim(),
        origem,
        tipo,
        instrucoes: instrucoes.trim() || undefined,
        itens: refeicao.itens
      });
      setNome('');
      setInstrucoes('');
      setAviso('Item salvo na biblioteca.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function arquivar() {
    if (!selecionada) return;
    setOcupado('arquivando');
    setErro(null);
    setAviso(null);
    try {
      await arquivarReceitaNutricional(selecionada);
      setSelecionada('');
      setConfirmarArquivo(false);
      setAviso('Item arquivado da biblioteca. Planos publicados nao foram alterados.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UtensilsCrossed aria-hidden="true" size={17} className="text-primaria" />
          <div>
            <h3 className="text-sm font-semibold text-tinta">Receitas e refeicoes prontas</h3>
            <p className="text-sm text-texto-suave">Insira itens no rascunho ou salve uma refeicao para reutilizar.</p>
          </div>
        </div>
        <Botao type="button" tamanho="sm" onClick={() => void carregar()} disabled={desabilitado || ocupado !== null}>
          <BookOpenCheck size={15} /> Atualizar biblioteca
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">{aviso}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-selecionada`}>
          Biblioteca
          <Selecao id={`${id}-selecionada`} value={selecionada} onChange={(evento) => setSelecionada(evento.target.value)} disabled={desabilitado || ocupado !== null || !itens.length}>
            <option value="">{ocupado === 'carregando' ? 'Carregando...' : itens.length ? 'Escolha uma receita' : 'Nenhum item salvo'}</option>
            {itens.map((item) => <option key={item.id} value={item.id}>{item.nome} - {ROTULO_TIPO[item.tipo]} - {item.totalItens} item(ns)</option>)}
          </Selecao>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-destino`}>
          Inserir na refeicao
          <Selecao id={`${id}-destino`} value={refeicaoDestinoAtual} onChange={(evento) => setRefeicaoDestino(evento.target.value)} disabled={desabilitado || ocupado !== null}>
            {refeicoesAtuais.map((refeicao, indice) => <option key={refeicao.chave} value={refeicao.chave}>{refeicao.nome.trim() || `Refeicao ${indice + 1}`}</option>)}
          </Selecao>
        </label>
        <div className="flex flex-wrap gap-2">
          <Botao type="button" onClick={() => void aplicar()} carregando={ocupado === 'aplicando'} disabled={desabilitado || !selecionada || !refeicaoDestinoAtual || ocupado !== null}>
            <Plus size={16} /> Inserir
          </Botao>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setConfirmarArquivo(true)} disabled={desabilitado || !receitaAtual || ocupado !== null} aria-label="Arquivar item selecionado da biblioteca">
            <Archive size={15} /> Arquivar
          </Botao>
        </div>
      </div>

      <fieldset className="grid gap-3 border-t border-linha pt-3">
        <legend className="px-1 text-sm font-semibold text-tinta">Salvar refeicao atual</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-nome`}>
            Nome
            <Campo id={`${id}-nome`} value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={180} disabled={desabilitado || ocupado !== null} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-tipo`}>
            Tipo
            <Selecao id={`${id}-tipo`} value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="receita">Receita</option>
              <option value="refeicao_pronta">Refeicao pronta</option>
            </Selecao>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-origem`}>
            Visibilidade
            <Selecao id={`${id}-origem`} value={origem} onChange={(evento) => setOrigem(evento.target.value as OrigemReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="pessoal">So para mim</option>
              <option value="clinica">Compartilhar com a clinica</option>
            </Selecao>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-instrucoes`}>
          Instrucoes de preparo (opcional)
          <AreaTexto id={`${id}-instrucoes`} value={instrucoes} onChange={(evento) => setInstrucoes(evento.target.value)} maxLength={4000} disabled={desabilitado || ocupado !== null} />
        </label>
        <div><Botao type="button" onClick={() => void salvar()} carregando={ocupado === 'salvando'} disabled={desabilitado || !refeicaoDestino || ocupado !== null}><Plus size={16} /> Salvar na biblioteca</Botao></div>
      </fieldset>

      <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar item da biblioteca"
        mensagem="O item deixara de aparecer para novos rascunhos. Planos ja publicados permanecem inalterados."
        rotuloConfirmar="Arquivar"
        confirmando={ocupado === 'arquivando'}
        aoCancelar={() => setConfirmarArquivo(false)}
        aoConfirmar={() => void arquivar()}
      />
    </section>
  );
}
