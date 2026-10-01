'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { BookmarkPlus, History, LayoutTemplate, Pencil, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Etiqueta } from '@/components/ui/etiqueta';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarModeloPlanoAlimentar,
  buscarAlimentosParaModelo,
  criarModeloPlanoAlimentar,
  editarModeloPlanoAlimentar,
  listarModelosPlanoAlimentar,
  listarVersoesModeloPlanoAlimentar,
  obterModeloPlanoAlimentar,
  obterVersaoModeloPlanoAlimentar,
  restaurarVersaoModeloPlanoAlimentar,
  type EstruturaInicialPlanoApi,
  type AlimentoComposicaoApi,
  type AlternativaPlanoAlimentarEntrada,
  type ItemPlanoAlimentarEntrada,
  type ModeloPlanoAlimentarResumoApi,
  type OrigemModeloApi,
  type RefeicaoPlanoAlimentarEntrada,
  type VersaoModeloPlanoAlimentarApi,
  type VersaoModeloPlanoAlimentarResumoApi
} from '@/lib/plano-alimentar-api';

const ROTULO_ORIGEM: Record<OrigemModeloApi, string> = {
  pessoal: 'Pessoal',
  clinica: 'Da clinica'
};

export interface ModelosPlanoAlimentarProps {
  /** Refeicoes do rascunho atual, para salvar como modelo. */
  refeicoesAtuais: () => RefeicaoPlanoAlimentarEntrada[];
  /** Substitui as refeicoes do rascunho pelas do modelo escolhido. */
  aoAplicar: (refeicoes: RefeicaoPlanoAlimentarEntrada[]) => void;
  desabilitado?: boolean;
}

export function ModelosPlanoAlimentar({ refeicoesAtuais, aoAplicar, desabilitado = false }: ModelosPlanoAlimentarProps) {
  const id = useId();
  const [modelos, setModelos] = useState<ModeloPlanoAlimentarResumoApi[]>([]);
  const [totalModelos, setTotalModelos] = useState(0);
  const [paginaModelos, setPaginaModelos] = useState(1);
  const [estruturasIniciais, setEstruturasIniciais] = useState<EstruturaInicialPlanoApi[]>([]);
  const [estruturaSelecionada, setEstruturaSelecionada] = useState('');
  const [selecionado, setSelecionado] = useState('');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemModeloApi>('pessoal');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | 'editando' | 'historico' | 'restaurando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  const [edicao, setEdicao] = useState<{ id: string; versaoEsperada: number; nome: string; refeicoes: RefeicaoPlanoAlimentarEntrada[] } | null>(null);
  const [confirmarEdicao, setConfirmarEdicao] = useState(false);
  const [versoes, setVersoes] = useState<VersaoModeloPlanoAlimentarResumoApi[]>([]);
  const [paginaVersoes, setPaginaVersoes] = useState(1);
  const [totalVersoes, setTotalVersoes] = useState(0);
  const [versaoAberta, setVersaoAberta] = useState<VersaoModeloPlanoAlimentarApi | null>(null);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState<number | null>(null);
  const [buscaAlimento, setBuscaAlimento] = useState('');
  const [refeicaoBusca, setRefeicaoBusca] = useState<number | null>(null);
  const [resultadosAlimentos, setResultadosAlimentos] = useState<AlimentoComposicaoApi[]>([]);
  const [totalAlimentos, setTotalAlimentos] = useState(0);
  const [paginaAlimentos, setPaginaAlimentos] = useState(1);
  const [buscandoAlimentos, setBuscandoAlimentos] = useState(false);

  const carregar = useCallback(async () => {
    setOcupado('carregando');
    setErro(null);
    try {
      // Limite alto: o seletor ainda carrega tudo de uma vez, e esconder um
      // modelo do profissional seria pior que a consulta extra.
      const pagina = await listarModelosPlanoAlimentar({ pagina: 1, limite: 100 });
      setModelos(pagina.itens);
      setTotalModelos(pagina.total);
      setPaginaModelos(1);
      setEstruturasIniciais(pagina.estruturasIniciais ?? []);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os modelos.'));
    } finally {
      setOcupado(null);
    }
  }, []);

  async function carregarMaisModelos() {
    const proxima = paginaModelos + 1;
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await listarModelosPlanoAlimentar({ pagina: proxima, limite: 100 });
      setModelos((atuais) => [...atuais, ...pagina.itens]);
      setPaginaModelos(proxima);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar mais modelos.'));
    } finally {
      setOcupado(null);
    }
  }

  async function iniciarEdicao() {
    if (!selecionado) return;
    setOcupado('editando');
    setErro(null);
    try {
      const modelo = await obterModeloPlanoAlimentar(selecionado);
      // Esta cópia nasce do modelo carregado. Nunca lê nem altera o rascunho do paciente.
      setEdicao({ id: modelo.id, versaoEsperada: modelo.versaoAtual, nome: modelo.nome, refeicoes: modelo.refeicoes });
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir o modelo para edição.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvarEdicao() {
    if (!edicao) return;
    if (!edicao.refeicoes.length || edicao.refeicoes.some((refeicao) =>
      !refeicao.nome.trim() || !refeicao.itens.length || refeicao.itens.some((item) =>
        !item.unidade.trim() || item.quantidade <= 0 || item.porcaoGramas <= 0 || (!item.alimentoComposicaoId && !item.descricao?.trim()) ||
        item.substituicoes.some((alternativa) =>
          !alternativa.unidade.trim() || alternativa.quantidade <= 0 || alternativa.porcaoGramas <= 0 ||
          (!alternativa.alimentoComposicaoId && !alternativa.descricao?.trim())
        )
      )
    )) {
      setErro('Cada refeição precisa de nome e ao menos um alimento válido, com descrição ou vínculo ao catálogo, quantidade, porção e unidade.');
      setConfirmarEdicao(false);
      return;
    }
    setConfirmarEdicao(false);
    setOcupado('editando');
    setErro(null);
    try {
      await editarModeloPlanoAlimentar(edicao.id, {
        versaoEsperada: edicao.versaoEsperada,
        nome: edicao.nome,
        refeicoes: edicao.refeicoes
      });
      setEdicao(null);
      setAviso('Nova versão do modelo salva.');
      await carregar();
    } catch (falha) {
      // Em 409, mantém nome e estrutura digitados para revisão humana.
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar a nova versão. Suas alterações continuam abertas.'));
    } finally {
      setOcupado(null);
    }
  }

  function atualizarRefeicaoEdicao(indice: number, alteracao: Partial<RefeicaoPlanoAlimentarEntrada>) {
    setEdicao((atual) => atual ? {
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao, posicao) => posicao === indice ? { ...refeicao, ...alteracao } : refeicao)
    } : atual);
  }

  function atualizarItemEdicao(indiceRefeicao: number, indiceItem: number, alteracao: Partial<ItemPlanoAlimentarEntrada>) {
    setEdicao((atual) => atual ? {
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao, posicaoRefeicao) => posicaoRefeicao === indiceRefeicao
        ? { ...refeicao, itens: refeicao.itens.map((item, posicaoItem) => posicaoItem === indiceItem ? { ...item, ...alteracao } : item) }
        : refeicao)
    } : atual);
  }

  function atualizarAlternativaEdicao(
    indiceRefeicao: number,
    indiceItem: number,
    indiceAlternativa: number,
    alteracao: Partial<AlternativaPlanoAlimentarEntrada>
  ) {
    setEdicao((atual) => atual ? {
      ...atual,
      refeicoes: atual.refeicoes.map((refeicao, posicaoRefeicao) => posicaoRefeicao === indiceRefeicao
        ? {
            ...refeicao,
            itens: refeicao.itens.map((item, posicaoItem) => posicaoItem === indiceItem
              ? { ...item, substituicoes: item.substituicoes.map((alternativa, posicaoAlternativa) => posicaoAlternativa === indiceAlternativa ? { ...alternativa, ...alteracao } : alternativa) }
              : item)
          }
        : refeicao)
    } : atual);
  }

  async function buscarAlimentos(pagina = 1) {
    if (buscaAlimento.trim().length < 2) {
      setErro('Digite ao menos dois caracteres para buscar no catálogo.');
      return;
    }
    setBuscandoAlimentos(true);
    setErro(null);
    try {
      const resultado = await buscarAlimentosParaModelo({ busca: buscaAlimento.trim(), pagina, limite: 10 });
      setResultadosAlimentos((atuais) => pagina === 1 ? resultado.itens : [...atuais, ...resultado.itens]);
      setTotalAlimentos(resultado.total);
      setPaginaAlimentos(pagina);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível pesquisar o catálogo.'));
    } finally {
      setBuscandoAlimentos(false);
    }
  }

  function adicionarAlimento(alimento: AlimentoComposicaoApi) {
    if (!edicao || refeicaoBusca === null) return;
    const item: ItemPlanoAlimentarEntrada = {
      alimentoComposicaoId: alimento.id,
      descricao: alimento.nome,
      quantidade: 1,
      unidade: 'porção',
      porcaoGramas: 100,
      nutrientesPor100g: alimento.nutrientesPor100g,
      substituicoes: []
    };
    atualizarRefeicaoEdicao(refeicaoBusca, {
      itens: [...edicao.refeicoes[refeicaoBusca].itens, item]
    });
    setResultadosAlimentos([]);
    setTotalAlimentos(0);
    setBuscaAlimento('');
    setRefeicaoBusca(null);
  }

  async function abrirHistorico(reiniciar = true) {
    if (!selecionado) return;
    const pagina = reiniciar ? 1 : paginaVersoes + 1;
    setOcupado('historico');
    setErro(null);
    try {
      const resultado = await listarVersoesModeloPlanoAlimentar(selecionado, { pagina, limite: 10 });
      setVersoes((atuais) => reiniciar ? resultado.itens : [...atuais, ...resultado.itens]);
      setPaginaVersoes(pagina);
      setTotalVersoes(resultado.total);
      if (reiniciar) setVersaoAberta(null);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar o histórico.'));
    } finally {
      setOcupado(null);
    }
  }

  async function abrirVersao(versao: VersaoModeloPlanoAlimentarResumoApi) {
    if (!selecionado) return;
    setOcupado('historico');
    setErro(null);
    try {
      setVersaoAberta(await obterVersaoModeloPlanoAlimentar(selecionado, versao.numero));
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir esta versão.'));
    } finally {
      setOcupado(null);
    }
  }

  async function restaurar(versao: number) {
    if (!modeloAtual) return;
    setConfirmarRestauracao(null);
    setOcupado('restaurando');
    setErro(null);
    try {
      await restaurarVersaoModeloPlanoAlimentar(modeloAtual.id, versao, modeloAtual.versaoAtual);
      setAviso(`Versão ${versao} restaurada como nova versão do modelo.`);
      await carregar();
      await abrirHistorico(true);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível restaurar. O histórico permanece intacto.'));
    } finally {
      setOcupado(null);
    }
  }

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aplicar() {
    if (!selecionado) return;
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    try {
      const modelo = await obterModeloPlanoAlimentar(selecionado);
      aoAplicar(modelo.refeicoes);
      setAviso(
        modelo.alimentosIndisponiveis.length
          ? `Modelo aplicado. ${modelo.alimentosIndisponiveis.length} alimento(s) sairam do catalogo ativo e precisam ser revistos antes de salvar.`
          : 'Modelo aplicado ao rascunho. Revise e salve para confirmar.'
      );
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    const refeicoes = refeicoesAtuais();
    if (!nome.trim() || !refeicoes.length) {
      setErro('Informe um nome e tenha ao menos uma refeição no modelo.');
      return;
    }
    if (refeicoes.some((refeicao) => refeicao.itens.length === 0)) {
      setErro('Adicione ao menos um alimento em cada refeição antes de salvar o modelo.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      await criarModeloPlanoAlimentar({ nome: nome.trim(), origem, refeicoes });
      setNome('');
      setAviso('Modelo salvo.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  async function arquivar() {
    setConfirmarArquivo(false);
    if (!selecionado) return;
    setOcupado('arquivando');
    setErro(null);
    try {
      await arquivarModeloPlanoAlimentar(selecionado);
      setSelecionado('');
      setAviso('Modelo arquivado.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar o modelo.'));
    } finally {
      setOcupado(null);
    }
  }

  const modeloAtual = modelos.find((modelo) => modelo.id === selecionado);

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex items-center gap-2">
        <LayoutTemplate aria-hidden="true" size={17} className="text-primaria" />
        <h3 className="text-sm font-semibold text-tinta">Modelos</h3>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="rounded-md bg-superficie px-3 py-2 text-sm text-tinta">
          {aviso}
        </p>
      ) : null}

      {estruturasIniciais.length ? (
        <div className="grid gap-2 border-b border-linha pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1">
            <Rotulo htmlFor={`${id}-estrutura`}>Estrutura inicial de refeições</Rotulo>
            <Selecao id={`${id}-estrutura`} value={estruturaSelecionada} onChange={(evento) => setEstruturaSelecionada(evento.target.value)} disabled={desabilitado || Boolean(ocupado)}>
              <option value="">Escolha uma estrutura</option>
              {estruturasIniciais.map((estrutura) => <option key={estrutura.id} value={estrutura.id}>{estrutura.nome}</option>)}
            </Selecao>
          </div>
          <Botao type="button" onClick={() => {
            const estrutura = estruturasIniciais.find((item) => item.id === estruturaSelecionada);
            if (!estrutura) return;
            aoAplicar(estrutura.refeicoes.map((refeicao) => ({ ...refeicao, itens: [] })));
            setErro(null);
            setAviso('Estrutura aplicada ao rascunho. Adicione alimentos e revise cada refeição antes de salvar.');
          }} disabled={desabilitado || !estruturaSelecionada || Boolean(ocupado)}>Usar estrutura</Botao>
          <p className="text-xs text-texto-suave sm:col-span-2">A estrutura substitui as refeições do rascunho. Ela não contém alimentos, quantidades nem orientação clínica.</p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-modelo`}>Aplicar modelo ao rascunho</Rotulo>
          <Selecao
            id={`${id}-modelo`}
            value={selecionado}
            onChange={(evento) => {
              setSelecionado(evento.target.value);
              setEdicao(null);
              setVersoes([]);
              setVersaoAberta(null);
            }}
            disabled={desabilitado || !modelos.length}
          >
            <option value="">{modelos.length ? 'Escolha um modelo' : 'Nenhum modelo salvo'}</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome} - {ROTULO_ORIGEM[modelo.origem]} - {modelo.totalRefeicoes} refeições
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
          onClick={() => setConfirmarArquivo(true)}
          disabled={desabilitado || !selecionado || Boolean(ocupado)}
        >
          <Trash2 aria-hidden="true" size={15} />
          Arquivar
        </Botao>
        <Botao type="button" variante="fantasma" onClick={() => void iniciarEdicao()} disabled={desabilitado || !selecionado || Boolean(ocupado)}>
          <Pencil aria-hidden="true" size={15} />
          Editar modelo
        </Botao>
        <Botao type="button" variante="fantasma" onClick={() => void abrirHistorico(true)} disabled={desabilitado || !selecionado || Boolean(ocupado)}>
          <History aria-hidden="true" size={15} />
          Histórico
        </Botao>
      </div>

      {modeloAtual ? (
        <p className="text-xs text-texto-suave">
          <Etiqueta variante={modeloAtual.origem === 'clinica' ? 'primaria' : 'neutra'}>
            {ROTULO_ORIGEM[modeloAtual.origem]}
          </Etiqueta>{' '}
          Aplicar substitui todas as refeições do rascunho atual.
        </p>
      ) : null}

      {totalModelos > modelos.length ? (
        <Botao type="button" variante="fantasma" onClick={() => void carregarMaisModelos()} carregando={ocupado === 'carregando'}>
          Carregar mais modelos ({modelos.length} de {totalModelos})
        </Botao>
      ) : null}

      {edicao ? (
        <div className="grid gap-3 rounded-md border border-primaria/30 bg-superficie p-3" aria-label="Edição isolada do modelo">
          <h4 className="text-sm font-semibold text-tinta">Editar cópia do modelo · versão {edicao.versaoEsperada}</h4>
          <div className="grid gap-1">
            <Rotulo htmlFor={`${id}-edicao-nome`}>Nome do modelo</Rotulo>
            <Campo id={`${id}-edicao-nome`} value={edicao.nome} maxLength={180} onChange={(evento) => setEdicao({ ...edicao, nome: evento.target.value })} />
          </div>
          <p className="text-xs text-texto-suave">A edição usa uma cópia independente do modelo. Planos de pacientes e versões publicadas não são alterados.</p>
          <div className="grid gap-3">
            {edicao.refeicoes.map((refeicao, indiceRefeicao) => (
              <fieldset key={`${edicao.id}-refeicao-${indiceRefeicao}`} className="grid gap-3 rounded-md border border-linha bg-white p-3">
                <legend className="px-1 text-sm font-semibold text-tinta">Refeição {indiceRefeicao + 1}</legend>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-refeicao-${indiceRefeicao}-nome`}>Nome
                    <Campo id={`${id}-refeicao-${indiceRefeicao}-nome`} maxLength={180} value={refeicao.nome} onChange={(evento) => atualizarRefeicaoEdicao(indiceRefeicao, { nome: evento.target.value })} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-refeicao-${indiceRefeicao}-horario`}>Horário
                    <Campo id={`${id}-refeicao-${indiceRefeicao}-horario`} type="time" value={refeicao.horarioLocal ?? ''} onChange={(evento) => atualizarRefeicaoEdicao(indiceRefeicao, { horarioLocal: evento.target.value || undefined })} />
                  </label>
                  <Botao type="button" variante="fantasma" onClick={() => setEdicao((atual) => atual ? { ...atual, refeicoes: atual.refeicoes.filter((_, indice) => indice !== indiceRefeicao) } : atual)} disabled={edicao.refeicoes.length <= 1}>Remover refeição</Botao>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-refeicao-${indiceRefeicao}-orientacoes`}>Orientações
                  <textarea id={`${id}-refeicao-${indiceRefeicao}-orientacoes`} maxLength={2000} rows={2} value={refeicao.orientacoes ?? ''} onChange={(evento) => atualizarRefeicaoEdicao(indiceRefeicao, { orientacoes: evento.target.value || undefined })} className="w-full rounded-md border border-linha bg-white p-2 text-sm text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria" />
                </label>
                {refeicao.itens.map((item, indiceItem) => (
                  <fieldset key={`${edicao.id}-refeicao-${indiceRefeicao}-item-${indiceItem}`} className="grid gap-2 rounded border border-linha p-3">
                    <legend className="px-1 text-xs font-semibold text-tinta">Alimento {indiceItem + 1}</legend>
                    {item.alimentoComposicaoId ? (
                      <p className="text-xs text-texto-suave">{item.descricao ?? 'Alimento vinculado ao catálogo'} (código {item.alimentoComposicaoId.slice(0, 8)}). O vínculo será preservado; remova este item para substituí-lo.</p>
                    ) : (
                      <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-item-${indiceRefeicao}-${indiceItem}-descricao`}>Descrição do alimento
                        <Campo id={`${id}-item-${indiceRefeicao}-${indiceItem}-descricao`} maxLength={240} value={item.descricao ?? ''} onChange={(evento) => atualizarItemEdicao(indiceRefeicao, indiceItem, { descricao: evento.target.value })} />
                      </label>
                    )}
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-item-${indiceRefeicao}-${indiceItem}-quantidade`}>Quantidade
                        <Campo id={`${id}-item-${indiceRefeicao}-${indiceItem}-quantidade`} type="number" min="0.001" max="10000" step="0.001" value={item.quantidade} onChange={(evento) => atualizarItemEdicao(indiceRefeicao, indiceItem, { quantidade: Number(evento.target.value) })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-item-${indiceRefeicao}-${indiceItem}-unidade`}>Unidade
                        <Campo id={`${id}-item-${indiceRefeicao}-${indiceItem}-unidade`} maxLength={40} value={item.unidade} onChange={(evento) => atualizarItemEdicao(indiceRefeicao, indiceItem, { unidade: evento.target.value })} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-item-${indiceRefeicao}-${indiceItem}-gramas`}>Porção em gramas
                        <Campo id={`${id}-item-${indiceRefeicao}-${indiceItem}-gramas`} type="number" min="0.001" max="10000" step="0.001" value={item.porcaoGramas} onChange={(evento) => atualizarItemEdicao(indiceRefeicao, indiceItem, { porcaoGramas: Number(evento.target.value) })} />
                      </label>
                    </div>
                    {item.nutrientesPor100g ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-primaria">Composição nutricional por 100 g</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {([
                            ['energiaKcal', 'Energia (kcal)'], ['proteinasG', 'Proteínas (g)'], ['carboidratosG', 'Carboidratos (g)'],
                            ['gordurasG', 'Gorduras (g)'], ['fibrasG', 'Fibras (g)'], ['sodioMg', 'Sódio (mg)']
                          ] as const).map(([campo, rotulo]) => (
                            <label key={campo} className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-item-${indiceRefeicao}-${indiceItem}-${campo}`}>{rotulo}
                              <Campo id={`${id}-item-${indiceRefeicao}-${indiceItem}-${campo}`} type="number" min="0" step="0.0001" value={item.nutrientesPor100g?.[campo] ?? 0} onChange={(evento) => atualizarItemEdicao(indiceRefeicao, indiceItem, { nutrientesPor100g: { ...item.nutrientesPor100g!, [campo]: Number(evento.target.value) } })} />
                            </label>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {item.substituicoes.map((alternativa, indiceAlternativa) => (
                      <fieldset key={`${edicao.id}-refeicao-${indiceRefeicao}-item-${indiceItem}-alternativa-${indiceAlternativa}`} className="grid gap-2 rounded border border-dashed border-linha p-3">
                        <legend className="px-1 text-xs font-semibold text-tinta">Alternativa {indiceAlternativa + 1}</legend>
                        {alternativa.alimentoComposicaoId ? (
                          <p className="text-xs text-texto-suave">{alternativa.descricao ?? 'Alternativa vinculada ao catálogo'} (código {alternativa.alimentoComposicaoId.slice(0, 8)}). O vínculo será preservado.</p>
                        ) : (
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-alternativa-${indiceRefeicao}-${indiceItem}-${indiceAlternativa}-descricao`}>Descrição da alternativa
                            <Campo id={`${id}-alternativa-${indiceRefeicao}-${indiceItem}-${indiceAlternativa}-descricao`} maxLength={240} value={alternativa.descricao ?? ''} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { descricao: evento.target.value })} />
                          </label>
                        )}
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Quantidade
                            <Campo type="number" min="0.001" max="10000" step="0.001" value={alternativa.quantidade} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { quantidade: Number(evento.target.value) })} />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Unidade
                            <Campo maxLength={40} value={alternativa.unidade} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { unidade: evento.target.value })} />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Porção em gramas
                            <Campo type="number" min="0.001" max="10000" step="0.001" value={alternativa.porcaoGramas} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { porcaoGramas: Number(evento.target.value) })} />
                          </label>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-texto-suave">
                          <input type="checkbox" checked={alternativa.liberadaParaPaciente} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { liberadaParaPaciente: evento.target.checked })} />
                          Liberada para o paciente
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-texto-suave">
                          <input type="checkbox" checked={alternativa.preferida} onChange={(evento) => atualizarAlternativaEdicao(indiceRefeicao, indiceItem, indiceAlternativa, { preferida: evento.target.checked })} />
                          Preferida
                        </label>
                        <Botao type="button" variante="fantasma" onClick={() => atualizarItemEdicao(indiceRefeicao, indiceItem, { substituicoes: item.substituicoes.filter((_, indice) => indice !== indiceAlternativa) })}>Remover alternativa</Botao>
                      </fieldset>
                    ))}
                    <Botao type="button" variante="fantasma" onClick={() => atualizarItemEdicao(indiceRefeicao, indiceItem, {
                      substituicoes: [...item.substituicoes, { descricao: '', quantidade: 1, unidade: 'porção', porcaoGramas: 100, liberadaParaPaciente: false, preferida: false }]
                    })} disabled={item.substituicoes.length >= 50}>Adicionar alternativa</Botao>
                    <Botao type="button" variante="fantasma" onClick={() => atualizarRefeicaoEdicao(indiceRefeicao, { itens: refeicao.itens.filter((_, indice) => indice !== indiceItem) })} disabled={refeicao.itens.length <= 1}>Remover alimento</Botao>
                  </fieldset>
                ))}
                {refeicaoBusca === indiceRefeicao ? (
                  <div className="grid gap-2 rounded-md border border-linha bg-superficie p-3">
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-busca-alimento-${indiceRefeicao}`}>Buscar alimento no catálogo
                      <Campo id={`${id}-busca-alimento-${indiceRefeicao}`} value={buscaAlimento} maxLength={120} onChange={(evento) => setBuscaAlimento(evento.target.value)} onKeyDown={(evento) => {
                        if (evento.key === 'Enter') { evento.preventDefault(); void buscarAlimentos(); }
                      }} />
                    </label>
                    <Botao type="button" variante="fantasma" carregando={buscandoAlimentos} onClick={() => void buscarAlimentos()} disabled={buscandoAlimentos || buscaAlimento.trim().length < 2}>Buscar</Botao>
                    {resultadosAlimentos.length ? (
                      <ul className="grid gap-1" aria-label="Resultados do catálogo">
                        {resultadosAlimentos.map((alimento) => (
                          <li key={alimento.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-linha bg-white p-2 text-sm">
                            <span>{alimento.nome}{alimento.fonte ? ` · ${alimento.fonte.nome} ${alimento.fonte.versao}` : ''}</span>
                            <Botao type="button" variante="fantasma" onClick={() => adicionarAlimento(alimento)} disabled={refeicao.itens.length >= 100}>Adicionar</Botao>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {resultadosAlimentos.length < totalAlimentos ? <Botao type="button" variante="fantasma" carregando={buscandoAlimentos} onClick={() => void buscarAlimentos(paginaAlimentos + 1)}>Carregar mais alimentos</Botao> : null}
                    <Botao type="button" variante="fantasma" onClick={() => { setRefeicaoBusca(null); setResultadosAlimentos([]); }}>Fechar busca</Botao>
                  </div>
                ) : (
                  <Botao type="button" variante="fantasma" onClick={() => { setRefeicaoBusca(indiceRefeicao); setResultadosAlimentos([]); setTotalAlimentos(0); setBuscaAlimento(''); }} disabled={refeicao.itens.length >= 100}>Adicionar alimento do catálogo</Botao>
                )}
              </fieldset>
            ))}
            <Botao type="button" variante="fantasma" onClick={() => setEdicao((atual) => atual ? { ...atual, refeicoes: [...atual.refeicoes, { nome: '', itens: [] }] } : atual)} disabled={edicao.refeicoes.length >= 50}>Adicionar refeição</Botao>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao type="button" variante="primario" onClick={() => setConfirmarEdicao(true)} disabled={Boolean(ocupado) || !edicao.nome.trim()}>Revisar e confirmar nova versão</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setEdicao(null)} disabled={Boolean(ocupado)}>Cancelar edição</Botao>
          </div>
        </div>
      ) : null}

      {versoes.length ? (
        <div className="grid gap-3 rounded-md border border-linha p-3">
          <h4 className="text-sm font-semibold text-tinta">Histórico do modelo · {totalVersoes} versões</h4>
          <ul className="grid gap-2">
            {versoes.map((versao) => (
              <li key={versao.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-linha p-2 text-sm">
                <span>v{versao.numero} · {versao.nome} · {versao.totalRefeicoes} refeições · {versao.totalItens} itens</span>
                <div className="flex gap-2">
                  <Botao type="button" variante="fantasma" onClick={() => void abrirVersao(versao)} disabled={Boolean(ocupado)}>Ver snapshot</Botao>
                  <Botao type="button" variante="fantasma" onClick={() => setConfirmarRestauracao(versao.numero)} disabled={Boolean(ocupado)}>Restaurar…</Botao>
                </div>
              </li>
            ))}
          </ul>
          {versoes.length < totalVersoes ? <Botao type="button" variante="fantasma" onClick={() => void abrirHistorico(false)} carregando={ocupado === 'historico'}>Carregar versões anteriores</Botao> : null}
          {versaoAberta ? (
            <div className="grid gap-2 border-t border-linha pt-3">
              <h5 className="text-sm font-semibold">Snapshot v{versaoAberta.numero} · {versaoAberta.nome}</h5>
              {versaoAberta.alimentosIndisponiveis.length ? <AlertaOperacional mensagem={`${versaoAberta.alimentosIndisponiveis.length} alimento(s) desta versão não estão disponíveis no catálogo ativo.`} /> : null}
              <pre className="max-h-72 overflow-auto rounded bg-superficie p-3 text-xs text-tinta">{JSON.stringify(versaoAberta.refeicoes, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-linha pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-nome`}>Nome do novo modelo</Rotulo>
          <Campo
            id={`${id}-nome`}
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            maxLength={180}
            placeholder="Nome do modelo"
            disabled={desabilitado}
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-origem`}>Visibilidade</Rotulo>
          <Selecao
            id={`${id}-origem`}
            value={origem}
            onChange={(evento) => setOrigem(evento.target.value as OrigemModeloApi)}
            disabled={desabilitado}
          >
            <option value="pessoal">Só para mim</option>
            <option value="clinica">Toda a clínica</option>
          </Selecao>
        </div>
        <Botao
          type="button"
          className="min-h-11"
          onClick={() => void salvar()}
          carregando={ocupado === 'salvando'}
          disabled={desabilitado || !nome.trim() || Boolean(ocupado)}
        >
          <BookmarkPlus aria-hidden="true" size={15} />
          Salvar modelo
        </Botao>
      </div>
      <p className="text-xs text-texto-suave">Salvar cria um modelo novo com as refeições do rascunho atual; editar um modelo existente usa uma cópia separada e não altera o rascunho do paciente.</p>

      <ModalConfirmacao
        aberto={confirmarEdicao}
        titulo="Salvar nova versão do modelo"
        mensagem="A versão atual será preservada no histórico e esta cópia revisada ficará disponível como nova versão."
        rotuloConfirmar="Salvar nova versão"
        aoConfirmar={() => void salvarEdicao()}
        aoCancelar={() => setConfirmarEdicao(false)}
      />
      <ModalConfirmacao
        aberto={confirmarRestauracao !== null}
        titulo="Restaurar versão do modelo"
        mensagem={`A versão ${confirmarRestauracao ?? ''} será copiada como uma nova versão. O histórico existente será preservado.`}
        rotuloConfirmar="Criar nova versão"
        aoConfirmar={() => confirmarRestauracao !== null && void restaurar(confirmarRestauracao)}
        aoCancelar={() => setConfirmarRestauracao(null)}
      />

      <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar modelo"
        mensagem="O modelo deixa de aparecer na lista. Planos já criados a partir dele não mudam."
        rotuloConfirmar="Arquivar"
        aoConfirmar={() => void arquivar()}
        aoCancelar={() => setConfirmarArquivo(false)}
      />
    </section>
  );
}
