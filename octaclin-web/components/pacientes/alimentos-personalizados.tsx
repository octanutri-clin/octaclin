'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { useProtecaoAlteracoesNaoSalvas } from '@/lib/usar-protecao-alteracoes-nao-salvas';
import { montarComposicaoAlimentoPersonalizado, montarCriacaoAlimentoPersonalizado, type FormularioAlimentoPersonalizadoApi } from '@/lib/alimento-personalizado-formulario';
import {
  atualizarAlimentoPersonalizado,
  buscarAlimentosPersonalizados,
  criarAlimentoPersonalizado,
  ErroApiPlanoAlimentar,
  listarAlimentosPersonalizados,
  obterAlimentoPersonalizado,
  type AlimentoPersonalizadoApi,
  type NutrientesPor100gApi,
  type MicronutrientesPor100gApi
} from '@/lib/plano-alimentar-api';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '@/lib/micronutrientes-plano';

type Formulario = FormularioAlimentoPersonalizadoApi;

const camposMacros: ReadonlyArray<{ codigo: keyof NutrientesPor100gApi; rotulo: string; unidade: string }> = [
  { codigo: 'energiaKcal', rotulo: 'Energia', unidade: 'kcal' },
  { codigo: 'proteinasG', rotulo: 'Proteínas', unidade: 'g' },
  { codigo: 'carboidratosG', rotulo: 'Carboidratos', unidade: 'g' },
  { codigo: 'gordurasG', rotulo: 'Gorduras', unidade: 'g' },
  { codigo: 'fibrasG', rotulo: 'Fibras', unidade: 'g' },
  { codigo: 'sodioMg', rotulo: 'Sódio', unidade: 'mg' }
];

function formularioVazio(): Formulario {
  return { nome: '', preparacao: '', referenciaComposicao: '', escopo: 'pessoal', tipoBase: 'por100g', pesoGramas: '100', nutrientes: {}, micronutrientes: {} };
}

function textoNumerico(valor: number | undefined) {
  return valor === undefined ? '' : String(valor);
}

function preencherFormulario(alimento: AlimentoPersonalizadoApi): Formulario {
  const origem = alimento.composicaoOrigem;
  return {
    nome: alimento.nome,
    preparacao: alimento.preparacao ?? '',
    referenciaComposicao: alimento.referenciaComposicao ?? '',
    escopo: alimento.escopo,
    tipoBase: alimento.baseOrigem.tipo,
    pesoGramas: String(alimento.baseOrigem.pesoGramas),
    nutrientes: Object.fromEntries(camposMacros.map(c => [c.codigo, textoNumerico(origem?.nutrientes[c.codigo])])) as Formulario['nutrientes'],
    micronutrientes: Object.fromEntries(CAMPOS_MICRONUTRIENTES_PLANO.map(c => [c.codigo, textoNumerico(origem?.micronutrientes[c.codigo])])) as Formulario['micronutrientes']
  };
}

export interface SelecaoAlimentoPersonalizado {
  alimento: AlimentoPersonalizadoApi;
  aplicacaoId: string;
}

interface Props {
  podeEditar: boolean;
  contextoSelecao: string;
  aoSelecionar: (valor: SelecaoAlimentoPersonalizado) => void;
}

export function AlimentosPersonalizados({ podeEditar, contextoSelecao, aoSelecionar }: Props) {
  const id = useId();
  const montado = useRef(true);
  const sequencia = useRef(0);
  const sequenciaSelecao = useRef(0);
  const estadoSelecaoAtual = useRef({ podeEditar, contextoSelecao, aoSelecionar });
  const chavePendente = useRef<{ assinatura: string; entrada: ReturnType<typeof montarCriacaoAlimentoPersonalizado> } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState<'' | 'pessoal' | 'clinica'>('');
  const [itens, setItens] = useState<AlimentoPersonalizadoApi[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [formulario, setFormulario] = useState<Formulario>(formularioVazio);
  const [editando, setEditando] = useState<AlimentoPersonalizadoApi | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [versaoFormulario, setVersaoFormulario] = useState(0);
  const [criacaoIncerta, setCriacaoIncerta] = useState(false);
  const formularioAlterado = formularioAberto && (Boolean(formulario.nome || formulario.preparacao || formulario.referenciaComposicao)
    || Object.values(formulario.nutrientes).some(Boolean) || Object.values(formulario.micronutrientes).some(Boolean));
  const buscaCurta = Boolean(busca.trim() && busca.trim().replace(/[^\p{L}\p{N}]+/gu, '').length < 3);

  useProtecaoAlteracoesNaoSalvas(formularioAlterado);
  useEffect(() => { montado.current = true; return () => { montado.current = false; sequencia.current += 1; }; }, []);
  useLayoutEffect(() => {
    const mudouContexto = estadoSelecaoAtual.current.contextoSelecao !== contextoSelecao
      || estadoSelecaoAtual.current.podeEditar !== podeEditar;
    estadoSelecaoAtual.current = { podeEditar, contextoSelecao, aoSelecionar };
    if (mudouContexto) {
      sequenciaSelecao.current += 1;
      setCarregando(false);
    }
  }, [aoSelecionar, contextoSelecao, podeEditar]);

  useEffect(() => {
    if (!aberto) return;
    if (buscaCurta) return;
    const controller = new AbortController();
    const requisicao = ++sequencia.current;
    const temporizador = window.setTimeout(async () => {
      setCarregando(true); setErro('');
      try {
        const consulta = { pagina, limite: 25, ...(escopo ? { escopo } : {}) };
        const resultado = busca.trim()
          ? await buscarAlimentosPersonalizados({ ...consulta, busca: busca.trim() }, controller.signal)
          : await listarAlimentosPersonalizados(consulta, controller.signal);
        if (!montado.current || controller.signal.aborted || requisicao !== sequencia.current) return;
        setItens(resultado.itens); setTotal(resultado.total);
      } catch (falha) {
        if (!controller.signal.aborted && montado.current && requisicao === sequencia.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os alimentos personalizados.'));
      } finally {
        if (!controller.signal.aborted && montado.current && requisicao === sequencia.current) setCarregando(false);
      }
    }, busca.trim() ? 300 : 0);
    return () => { window.clearTimeout(temporizador); controller.abort(); };
  }, [aberto, busca, buscaCurta, escopo, pagina, versaoFormulario]);

  async function selecionar(alimento: AlimentoPersonalizadoApi) {
    if (!estadoSelecaoAtual.current.podeEditar || !alimento.ativo || carregando) return;
    const requisicao = ++sequenciaSelecao.current;
    const contexto = estadoSelecaoAtual.current.contextoSelecao;
    setCarregando(true); setErro('');
    try {
      const detalhe = await obterAlimentoPersonalizado(alimento.id);
      const atual = estadoSelecaoAtual.current;
      if (!montado.current || requisicao !== sequenciaSelecao.current || !atual.podeEditar || atual.contextoSelecao !== contexto) return;
      if (!detalhe.ativo || detalhe.revisao !== alimento.revisao) {
        setErro('A revisão mudou desde a busca. Atualize a biblioteca e confira o conteúdo antes de aplicar.');
        setVersaoFormulario(v => v + 1);
        return;
      }
      atual.aoSelecionar({ alimento: detalhe, aplicacaoId: crypto.randomUUID() });
      setMensagem(`“${detalhe.nome}” aplicado ao item. A aplicação usa a revisão ${detalhe.revisao}; salvar o rascunho para materializar.`);
    } catch (falha) {
      if (montado.current && requisicao === sequenciaSelecao.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível confirmar o acesso ao alimento. Atualize a biblioteca.'));
    } finally { if (montado.current && requisicao === sequenciaSelecao.current) setCarregando(false); }
  }

  function iniciarCriacao() {
    if (criacaoIncerta) return;
    if (formularioAlterado && !window.confirm('Descartar os dados não salvos deste alimento?')) return;
    chavePendente.current = null; setCriacaoIncerta(false);
    setEditando(null); setFormulario(formularioVazio()); setFormularioAberto(true); setErro(''); setMensagem('');
  }

  async function iniciarEdicao(alimento: AlimentoPersonalizadoApi) {
    if (!podeEditar || !alimento.podeEditar || salvando) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      const detalhe = await obterAlimentoPersonalizado(alimento.id);
      if (!montado.current) return;
      if (!detalhe.composicaoOrigem) throw new Error('A composição original não está disponível para edição.');
      setEditando(detalhe); setFormulario(preencherFormulario(detalhe)); setFormularioAberto(true); setVersaoFormulario(v => v + 1);
    } catch (falha) { if (montado.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir o alimento para edição.')); }
    finally { if (montado.current) setSalvando(false); }
  }

  async function salvar() {
    if (!podeEditar || salvando) return;
    setSalvando(true); setErro(''); setMensagem('');
    let criacaoEnviada = false;
    try {
      if (editando) {
        await atualizarAlimentoPersonalizado(editando.id, { ...montarComposicaoAlimentoPersonalizado(formulario), revisaoEsperada: editando.revisao });
      } else {
        const assinatura = JSON.stringify({ escopo: formulario.escopo, composicao: montarComposicaoAlimentoPersonalizado(formulario) });
        if (chavePendente.current?.assinatura !== assinatura) {
          const chave = crypto.randomUUID();
          chavePendente.current = { assinatura, entrada: montarCriacaoAlimentoPersonalizado(formulario, chave) };
        }
        criacaoEnviada = true;
        await criarAlimentoPersonalizado(chavePendente.current.entrada);
      }
      if (!montado.current) return;
      setFormularioAberto(false); setFormulario(formularioVazio()); setEditando(null); chavePendente.current = null; setCriacaoIncerta(false);
      setMensagem('Biblioteca salva. Revisões já aplicadas aos planos permanecem intactas até uma reaplicação explícita.');
      setPagina(1); setVersaoFormulario(v => v + 1);
    } catch (falha) {
      if (!montado.current) return;
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar o alimento. Confira os campos e tente novamente.'));
      if (criacaoEnviada) {
        const status = falha instanceof ErroApiPlanoAlimentar ? falha.status : undefined;
        if (status === undefined || status >= 500) {
          setCriacaoIncerta(true);
          setMensagem('O resultado do cadastro não foi confirmado. Os campos e a chave idempotente foram preservados; repita o mesmo pedido para confirmar.');
        } else {
          chavePendente.current = null;
          setCriacaoIncerta(false);
        }
      }
      if (typeof falha === 'object' && falha && 'status' in falha && falha.status === 409) {
        setMensagem('A biblioteca mudou em outra operação. Atualize a lista e confira os dados antes de tentar novamente.');
        setVersaoFormulario(v => v + 1);
      }
    } finally { if (montado.current) setSalvando(false); }
  }

  async function desativar(alimento: AlimentoPersonalizadoApi) {
    if (!podeEditar || !alimento.podeEditar || criacaoIncerta || !window.confirm(`Desativar “${alimento.nome}”? As aplicações existentes continuarão iguais.`)) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      await atualizarAlimentoPersonalizado(alimento.id, { revisaoEsperada: alimento.revisao, ativo: false });
      if (!montado.current) return;
      setMensagem('Alimento desativado. Aplicações existentes foram preservadas.'); setVersaoFormulario(v => v + 1);
    } catch (falha) { if (montado.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível desativar. Atualize a lista e confira a revisão.')); }
    finally { if (montado.current) setSalvando(false); }
  }

  function atualizarCampo<K extends keyof Formulario>(campo: K, valor: Formulario[K]) { setFormulario(atual => ({ ...atual, [campo]: valor })); }
  function atualizarNutriente(codigo: keyof NutrientesPor100gApi, valor: string) { setFormulario(atual => ({ ...atual, nutrientes: { ...atual.nutrientes, [codigo]: valor } })); }
  function atualizarMicro(codigo: keyof MicronutrientesPor100gApi, valor: string) { setFormulario(atual => ({ ...atual, micronutrientes: { ...atual.micronutrientes, [codigo]: valor } })); }

  return <section className="grid gap-2 rounded-md border border-linha p-3" aria-label="Biblioteca de alimentos personalizados">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-tinta">Alimentos personalizados</h3><p className="text-xs text-texto-suave">Dados informados pela clínica. Campos não informados continuam ausentes.</p></div>
      <Botao type="button" tamanho="sm" aria-expanded={aberto} onClick={() => { setAberto(v => !v); setErro(''); }}>{aberto ? 'Fechar biblioteca' : 'Abrir biblioteca'}</Botao>
    </div>
    {mensagem ? <p role="status" className="text-xs text-texto-suave">{mensagem}</p> : null}
    {buscaCurta ? <p role="alert" className="text-xs text-perigo">Use pelo menos 3 letras ou números para pesquisar alimentos personalizados.</p> : null}
    {erro && !buscaCurta ? <p role="alert" className="text-xs text-perigo">{erro}</p> : null}
    {aberto ? <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="grid gap-1"><Rotulo htmlFor={`${id}-busca`}>Buscar alimentos personalizados</Rotulo><Campo id={`${id}-busca`} value={busca} maxLength={240} autoComplete="off" placeholder="Digite pelo menos 3 caracteres" onChange={e => { setBusca(e.target.value); setPagina(1); }} /></div>
        <div className="grid gap-1"><Rotulo htmlFor={`${id}-escopo`}>Disponibilidade</Rotulo><Selecao id={`${id}-escopo`} value={escopo} onChange={e => { setEscopo(e.target.value as typeof escopo); setPagina(1); }}><option value="">Pessoal e clínica</option><option value="pessoal">Pessoal</option><option value="clinica">Clínica</option></Selecao></div>
      </div>
      {carregando ? <p role="status" className="text-sm text-texto-suave">Carregando biblioteca…</p> : null}
      {!carregando && !erro && !buscaCurta && itens.length === 0 ? <p className="text-sm text-texto-suave">{busca.trim() ? 'Nenhum alimento encontrado.' : 'Ainda não há alimentos nesta biblioteca.'}</p> : null}
      {!buscaCurta && itens.length ? <><p className="text-xs text-texto-suave" role="status">Mostrando {itens.length} de {total} alimentos. Selecione para aplicar uma revisão ao item atual.</p><ul className="grid max-h-72 gap-2 overflow-auto">{itens.map(alimento => <li key={alimento.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-linha p-2">
        <div className="min-w-0"><p className="break-words text-sm font-medium text-tinta">{alimento.nome}{alimento.preparacao ? `, ${alimento.preparacao}` : ''}</p><p className="text-xs text-texto-suave">{alimento.escopo === 'pessoal' ? 'Pessoal' : 'Clínica'} · revisão {alimento.revisao} · base {alimento.baseOrigem.pesoGramas} g · {alimento.disponivelParaCalculo ? 'composição calculável' : 'composição parcial'}</p></div>
        <div className="flex flex-wrap gap-2"><Botao type="button" tamanho="sm" disabled={!podeEditar || carregando || salvando || criacaoIncerta} onClick={() => selecionar(alimento)}>Aplicar revisão</Botao>{podeEditar && alimento.podeEditar ? <><Botao type="button" tamanho="sm" disabled={salvando || criacaoIncerta} onClick={() => void iniciarEdicao(alimento)}>Editar</Botao><Botao type="button" tamanho="sm" variante="fantasma" disabled={salvando || criacaoIncerta} onClick={() => void desativar(alimento)}>Desativar</Botao></> : null}</div>
      </li>)}</ul></> : null}
      {!buscaCurta && total > 25 ? <nav className="flex items-center justify-between" aria-label="Paginação dos alimentos personalizados"><Botao tamanho="sm" disabled={pagina <= 1 || carregando} onClick={() => setPagina(p => p - 1)}>Anterior</Botao><span aria-live="polite" className="text-sm">Página {pagina} de {Math.ceil(total / 25)}</span><Botao tamanho="sm" disabled={pagina >= Math.ceil(total / 25) || carregando} onClick={() => setPagina(p => p + 1)}>Próxima</Botao></nav> : null}
      {podeEditar ? <div className="flex flex-wrap gap-2 border-t border-linha pt-3"><Botao type="button" disabled={salvando || criacaoIncerta} onClick={iniciarCriacao}>Cadastrar alimento</Botao><p className="self-center text-xs text-texto-suave">Cadastro não aplica automaticamente ao plano.</p></div> : null}
      {formularioAberto ? <fieldset className="grid gap-3 rounded-md bg-superficie p-3">
        <legend className="px-1 text-sm font-semibold text-tinta">{editando ? `Editar ${editando.nome}` : 'Novo alimento personalizado'}</legend>
        <fieldset disabled={salvando || criacaoIncerta} className="contents">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Nome <Campo maxLength={240} value={formulario.nome} onChange={e => atualizarCampo('nome', e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Preparação (opcional)<Campo maxLength={180} value={formulario.preparacao} onChange={e => atualizarCampo('preparacao', e.target.value)} /></label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Referência da composição (opcional)<Campo maxLength={240} value={formulario.referenciaComposicao} onChange={e => atualizarCampo('referenciaComposicao', e.target.value)} /></label>
          {!editando ? <label className="grid gap-1 text-xs font-semibold text-texto-suave">Disponibilidade<Selecao value={formulario.escopo} onChange={e => atualizarCampo('escopo', e.target.value as Formulario['escopo'])}><option value="pessoal">Pessoal (padrão)</option><option value="clinica">Clínica</option></Selecao></label> : <p className="self-center text-xs text-texto-suave">O escopo não muda após a criação.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Base informada<Selecao value={formulario.tipoBase} onChange={e => atualizarCampo('tipoBase', e.target.value as Formulario['tipoBase'])}><option value="por100g">Por 100 g</option><option value="porcao">Por porção com peso em gramas</option></Selecao></label>
          {formulario.tipoBase === 'porcao' ? <label className="grid gap-1 text-xs font-semibold text-texto-suave">Peso da porção (g)<Campo type="text" inputMode="decimal" maxLength={24} value={formulario.pesoGramas} onChange={e => atualizarCampo('pesoGramas', e.target.value)} /></label> : null}
        </div>
        <fieldset className="grid gap-2"><legend className="text-xs font-semibold uppercase text-texto-suave">Composição por base informada</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{camposMacros.map(campo => <label key={campo.codigo} className="grid gap-1 text-xs font-semibold text-texto-suave">{campo.rotulo} ({campo.unidade}; opcional)<Campo type="text" inputMode="decimal" maxLength={32} value={formulario.nutrientes[campo.codigo] ?? ''} onChange={e => atualizarNutriente(campo.codigo, e.target.value)} /></label>)}</div></fieldset>
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-primaria">Micronutrientes (opcional; ausentes não são zero)</summary><div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">{CAMPOS_MICRONUTRIENTES_PLANO.map(campo => <label key={campo.codigo} className="grid gap-1 text-xs font-semibold text-texto-suave">{campo.rotulo} ({campo.unidade})<Campo type="text" inputMode="decimal" maxLength={32} value={formulario.micronutrientes[campo.codigo] ?? ''} onChange={e => atualizarMicro(campo.codigo, e.target.value)} /></label>)}</div></details>
        <p className="text-xs text-texto-suave">Valores ausentes permanecem ausentes. Líquidos também exigem peso explícito em gramas. A normalização é feita pelo servidor.</p>
        </fieldset>
        {criacaoIncerta ? <p role="alert" className="text-sm text-perigo">O servidor pode ter salvo este alimento. Repita o mesmo pedido para conferir o resultado ou cancele após verificar a biblioteca.</p> : null}
        <div className="flex flex-wrap gap-2"><Botao type="button" carregando={salvando} disabled={salvando || !podeEditar} onClick={() => void salvar()}>{criacaoIncerta ? 'Repetir cadastro' : editando ? 'Salvar nova revisão' : 'Salvar na biblioteca'}</Botao><Botao type="button" disabled={salvando} onClick={() => { if (criacaoIncerta ? window.confirm('O cadastro pode já ter sido salvo. Confirme na biblioteca antes de iniciar outro cadastro. Cancelar também descarta este pedido pendente.') : !formularioAlterado || window.confirm('Descartar os dados não salvos deste alimento?')) { setFormularioAberto(false); setFormulario(formularioVazio()); setEditando(null); chavePendente.current = null; setCriacaoIncerta(false); } }}>Cancelar</Botao></div>
      </fieldset> : null}
    </div> : null}
  </section>;
}
