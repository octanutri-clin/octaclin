'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, Copy, Heart, Pencil, Plus, RotateCcw, Share2 } from 'lucide-react';
import { AlertaOperacional, EstadoVazio } from '@/components/ui/feedback';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Etiqueta } from '@/components/ui/etiqueta';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  alterarFavoritoGrupoSubstituicoes, atualizarGrupoSubstituicoes,
  buscarAlimentosParaModelo, buscarAlimentosPersonalizados, consultarFontesGruposAdministracao,
  consultarGruposSubstituicoes, criarGrupoSubstituicoes, duplicarGrupoSubstituicoes,
  obterGrupoSubstituicoes, type AlimentoComposicaoApi
} from '@/lib/plano-alimentar-api';
import type { ConteudoGrupoSubstituicoes, FonteGrupoSubstituicoes, GrupoSubstituicoesDetalhe, GrupoSubstituicoesResumo } from '@/lib/grupos-substituicoes-tipos';

type FonteOpcao = { id: string; nome: string; origem: 'catalogo' | 'custom'; revisao?: number };
interface BibliotecaGruposSubstituicoesProps { pacienteId?: string; administracao?: boolean }

export function BibliotecaGruposSubstituicoes({ pacienteId, administracao = false }: BibliotecaGruposSubstituicoesProps) {
  const id = useId();
  const [grupos, setGrupos] = useState<GrupoSubstituicoesResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [escopo, setEscopo] = useState<'todos' | 'pessoal' | 'clinica'>('todos');
  const [estado, setEstado] = useState<'ativo' | 'arquivado' | 'todos'>('ativo');
  const [favoritos, setFavoritos] = useState(false);
  const [selecionado, setSelecionado] = useState<GrupoSubstituicoesDetalhe | null>(null);
  const [conteudo, setConteudo] = useState<ConteudoGrupoSubstituicoes | null>(null);
  const [fontes, setFontes] = useState<FonteOpcao[]>([]);
  const [buscaFonte, setBuscaFonte] = useState('');
  const [resultadosFontes, setResultadosFontes] = useState<FonteOpcao[]>([]);
  const [origemFonte, setOrigemFonte] = useState<'catalogo' | 'custom'>('catalogo');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [acao, setAcao] = useState<'criar' | 'editar' | 'duplicar' | null>(null);
  const [confirmarArquivamento, setConfirmarArquivamento] = useState(false);
  const [confirmarCompartilhamento, setConfirmarCompartilhamento] = useState(false);
  const controladorDetalhe = useRef<AbortController | null>(null);
  const sequenciaDetalhe = useRef(0);
  const idempotenciaRef = useRef<{ fingerprint: string; chave: string } | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setErro(null);
    try {
      const resposta = await consultarGruposSubstituicoes({
        pagina, limite: 25, busca: busca.trim().length >= 3 ? busca.trim() : undefined, categoria: categoria.trim() || undefined,
        escopo: escopo === 'todos' ? undefined : escopo, estado, favoritos: favoritos || undefined, etiqueta: etiqueta.trim() || undefined
      }, signal, administracao);
      if (signal?.aborted) return;
      setGrupos(resposta.itens);
      setTotal(resposta.total);
    } catch (falha) {
      if (!signal?.aborted) setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os grupos.'));
    }
  }, [administracao, busca, categoria, etiqueta, escopo, estado, favoritos, pagina]);

  useEffect(() => {
    const controlador = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a lista com o servidor sempre que filtros/página mudam.
    void carregar(controlador.signal);
    return () => controlador.abort();
  }, [carregar]);

  useEffect(() => {
    if (buscaFonte.trim().length < 3) return;
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      try {
        if (administracao) {
          const paginaFontes = await consultarFontesGruposAdministracao({ origem: origemFonte, busca: buscaFonte.trim(), pagina: 1, limite: 10 }, controlador.signal);
          if (!controlador.signal.aborted) setResultadosFontes(paginaFontes.itens.map((fonte: FonteGrupoSubstituicoes) => ({ id: fonte.id, nome: fonte.nome, origem: fonte.origem, revisao: fonte.revisao })));
        } else if (pacienteId) {
          if (origemFonte === 'custom') {
            const [pessoal, clinica] = await Promise.all(['pessoal', 'clinica'].map((escopo) => buscarAlimentosPersonalizados({ busca: buscaFonte.trim(), pagina: 1, limite: 10, escopo: escopo as 'pessoal' | 'clinica' }, controlador.signal)));
            if (!controlador.signal.aborted) setResultadosFontes([...pessoal.itens, ...clinica.itens].map((fonte) => ({ id: fonte.id, nome: `${fonte.nome}${fonte.preparacao ? ` — ${fonte.preparacao}` : ''} · ${fonte.escopo}`, origem: 'custom', revisao: fonte.revisao })));
          } else {
            const paginaFontes = await buscarAlimentosParaModelo({ busca: buscaFonte.trim(), pagina: 1, limite: 10 }, controlador.signal);
            if (!controlador.signal.aborted) setResultadosFontes(paginaFontes.itens.map((fonte: AlimentoComposicaoApi) => ({ id: fonte.id, nome: `${fonte.nome}${fonte.preparacao ? ` — ${fonte.preparacao}` : ''}`, origem: 'catalogo' })));
          }
        }
      } catch (falha) { if (!controlador.signal.aborted) setErro(mensagemFalhaInterface(falha, 'Não foi possível pesquisar alimentos.')); }
    }, 250);
    return () => { clearTimeout(timer); controlador.abort(); };
  }, [administracao, origemFonte, buscaFonte, pacienteId]);

  async function abrirGrupo(grupo: GrupoSubstituicoesResumo) {
    controladorDetalhe.current?.abort();
    const controlador = new AbortController();
    controladorDetalhe.current = controlador;
    const sequencia = ++sequenciaDetalhe.current;
    setErro(null); setOcupado(true);
    try { const detalhe = await obterGrupoSubstituicoes(grupo.id, controlador.signal, administracao); if (!controlador.signal.aborted && sequencia === sequenciaDetalhe.current) setSelecionado(detalhe); }
    catch (falha) { if (!controlador.signal.aborted && sequencia === sequenciaDetalhe.current) setErro(mensagemFalhaInterface(falha, 'Este grupo mudou ou não está mais acessível. Atualize a lista.')); }
    finally { if (!controlador.signal.aborted && sequencia === sequenciaDetalhe.current) setOcupado(false); }
  }

  function novoConteudo() {
    setSelecionado(null); setConteudo({ nome: '', descricao: '', categoria: '', etiquetas: [], entradas: [] });
    setBuscaFonte(''); setFontes([]); setAcao('criar'); setErro(null); setAviso(null); idempotenciaRef.current = null;
  }

  function iniciarEdicao(tipo: 'editar' | 'duplicar') {
    if (!selecionado) return;
    if (selecionado.entradas.some((entrada) => !('composicao' in entrada) || !entrada.disponivel)) {
      setErro('Há fontes indisponíveis neste grupo. Para evitar remover entradas silenciosamente, restaure a fonte ou crie outro grupo manualmente.');
      return;
    }
    const fontesValidas: FonteOpcao[] = selecionado.entradas.flatMap((entrada) => 'composicao' in entrada && entrada.disponivel
      ? [{ id: entrada.alimentoId, nome: entrada.composicao.descricao, origem: entrada.origem, revisao: entrada.revisao }]
      : []);
    setFontes(fontesValidas);
    setConteudo({ nome: tipo === 'duplicar' ? `${selecionado.nome} (cópia)` : selecionado.nome, descricao: selecionado.descricao ?? '', categoria: selecionado.categoria ?? '', etiquetas: [...selecionado.etiquetas], entradas: selecionado.entradas.flatMap((entrada) => 'composicao' in entrada ? [{ id: crypto.randomUUID(), origem: entrada.origem, alimentoId: entrada.alimentoId, revisao: entrada.revisao, quantidade: entrada.quantidade, unidade: entrada.unidade, porcaoGramas: entrada.porcaoGramas }] : []) });
    setAcao(tipo); setErro(null); setAviso(null);
  }

  function adicionarFonte(fonte: FonteOpcao) {
    const duplicada = conteudo?.entradas.some((entrada) => entrada.origem === fonte.origem
      && entrada.alimentoId.toLowerCase() === fonte.id.toLowerCase()
      && entrada.porcaoGramas === 100);
    if (duplicada) {
      setErro('Este alimento já está no grupo com porção de 100 g. Altere a porção existente ou escolha outra alternativa.');
      return;
    }
    setErro(null);
    setFontes((anteriores) => [...anteriores.filter((item) => !(item.id === fonte.id && item.origem === fonte.origem)), fonte]);
    setConteudo((atual) => atual ? { ...atual, entradas: [...atual.entradas, { id: crypto.randomUUID(), origem: fonte.origem, alimentoId: fonte.id, revisao: fonte.revisao, quantidade: 1, unidade: 'porção', porcaoGramas: 100 }] } : atual);
    setBuscaFonte(''); setResultadosFontes([]);
  }

  function moverEntrada(index: number, destino: number) {
    setConteudo((atual) => {
      if (!atual || destino < 0 || destino >= atual.entradas.length) return atual;
      const entradas = [...atual.entradas]; const [movida] = entradas.splice(index, 1); entradas.splice(destino, 0, movida);
      return { ...atual, entradas };
    });
  }

  async function salvar() {
    if (!conteudo || conteudo.nome.trim().length === 0 || conteudo.entradas.length < 1 || conteudo.entradas.length > 20) {
      setErro('Informe um nome e entre 1 e 20 alimentos com porções em gramas.'); return;
    }
    setOcupado(true); setErro(null);
    try {
      const canonico = { ...conteudo, nome: conteudo.nome.trim(), descricao: conteudo.descricao?.trim() || undefined, categoria: conteudo.categoria?.trim() || undefined };
      const fingerprint = JSON.stringify({ acao, grupoId: selecionado?.id, revisao: selecionado?.revisao, conteudo: canonico });
      if (!idempotenciaRef.current || idempotenciaRef.current.fingerprint !== fingerprint) idempotenciaRef.current = { fingerprint, chave: crypto.randomUUID() };
      if (acao === 'criar') await criarGrupoSubstituicoes({ chaveIdempotencia: idempotenciaRef.current.chave, conteudo: canonico });
      if (acao === 'editar' && selecionado) await atualizarGrupoSubstituicoes(selecionado.id, { revisaoEsperada: selecionado.revisao, conteudo: canonico }, undefined, administracao);
      if (acao === 'duplicar' && selecionado) await duplicarGrupoSubstituicoes(selecionado.id, { chaveIdempotencia: idempotenciaRef.current.chave, revisaoEsperada: selecionado.revisao, conteudo: canonico });
      idempotenciaRef.current = null;
      setConteudo(null); setAcao(null); setSelecionado(null); setAviso('Grupo salvo. Alimentos e porções são dados de organização; não representam equivalência nutricional validada.');
      await carregar();
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar. Atualize a lista e reconfira a revisão do grupo.')); }
    finally { setOcupado(false); }
  }

  async function alterarEstado(novoEstado: 'ativo' | 'arquivado') {
    if (!selecionado) return;
    setOcupado(true); setErro(null);
    try {
      const atualizado = await atualizarGrupoSubstituicoes(selecionado.id, { revisaoEsperada: selecionado.revisao, estado: novoEstado }, undefined, administracao);
      setSelecionado(atualizado); setConfirmarArquivamento(false); await carregar();
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'O grupo mudou ou não está mais acessível. Recarregue antes de tentar novamente.')); }
    finally { setOcupado(false); }
  }

  async function compartilhar() {
    if (!selecionado || administracao) return;
    setOcupado(true); setErro(null);
    try { setSelecionado(await atualizarGrupoSubstituicoes(selecionado.id, { revisaoEsperada: selecionado.revisao, escopo: 'clinica' })); setConfirmarCompartilhamento(false); await carregar(); }
    catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível compartilhar este grupo. Confira sua permissão e tente novamente.')); }
    finally { setOcupado(false); }
  }

  async function favoritar(grupo: GrupoSubstituicoesResumo) {
    try { await alterarFavoritoGrupoSubstituicoes(grupo.id, !grupo.favorito); await carregar(); }
    catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível atualizar o favorito.')); }
  }

  const entradaPorId = new Map(fontes.map((fonte) => [`${fonte.origem}:${fonte.id}`, fonte.nome]));
  return <section className="grid gap-4" aria-label={administracao ? 'Administração de grupos compartilhados' : 'Biblioteca de grupos de substituições'}>
    <div className="grid gap-3 rounded-lg border border-linha bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-semibold text-tinta">{administracao ? 'Grupos compartilhados da clínica' : 'Grupos de substituições'}</h2><p className="mt-1 text-sm text-texto-suave">Biblioteca para reutilizar alternativas e porções. O grupo não declara equivalência nutricional.</p></div>{!administracao && pacienteId ? <Botao type="button" variante="primario" onClick={novoConteudo}><Plus size={16} /> Novo grupo</Botao> : null}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <label className="grid gap-1 text-xs font-semibold text-texto-suave sm:col-span-2" htmlFor={`${id}-busca`}>Buscar por nome<Campo id={`${id}-busca`} value={busca} onChange={(event) => { setBusca(event.target.value); setPagina(1); }} /></label>
        <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-categoria`}>Categoria<Campo id={`${id}-categoria`} value={categoria} onChange={(event) => { setCategoria(event.target.value); setPagina(1); }} /></label>
        <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-etiqueta`}>Etiqueta<Campo id={`${id}-etiqueta`} value={etiqueta} onChange={(event) => { setEtiqueta(event.target.value); setPagina(1); }} /></label>
        {!administracao ? <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-escopo`}>Escopo<select id={`${id}-escopo`} className="min-h-11 rounded-md border border-linha px-2" value={escopo} onChange={(event) => { setEscopo(event.target.value as typeof escopo); setPagina(1); }}><option value="todos">Todos</option><option value="pessoal">Pessoais</option><option value="clinica">Da clínica</option></select></label> : null}
        <label className="grid gap-1 text-xs font-semibold text-texto-suave" htmlFor={`${id}-estado`}>Estado<select id={`${id}-estado`} className="min-h-11 rounded-md border border-linha px-2" value={estado} onChange={(event) => { setEstado(event.target.value as typeof estado); setPagina(1); }}><option value="ativo">Ativos</option><option value="arquivado">Arquivados</option><option value="todos">Todos</option></select></label>
      </div>
      {!administracao ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={favoritos} onChange={(event) => { setFavoritos(event.target.checked); setPagina(1); }} /> Somente favoritos</label> : null}
    </div>
    {erro ? <AlertaOperacional mensagem={erro} /> : null}
    {aviso ? <p role="status" className="rounded-md border border-primaria/30 bg-superficie p-3 text-sm text-tinta">{aviso}</p> : null}
    {conteudo ? <fieldset className="grid gap-3 rounded-lg border border-primaria/40 bg-white p-4" disabled={ocupado}><legend className="px-1 font-semibold">{acao === 'duplicar' ? 'Duplicar grupo' : acao === 'editar' ? 'Editar grupo' : 'Novo grupo'}</legend>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-texto-suave">Nome obrigatório<Campo maxLength={180} value={conteudo.nome} onChange={(event) => setConteudo({ ...conteudo, nome: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-texto-suave">Categoria opcional<Campo maxLength={80} value={conteudo.categoria ?? ''} onChange={(event) => setConteudo({ ...conteudo, categoria: event.target.value })} /></label></div>
      <label className="grid gap-1 text-xs font-semibold text-texto-suave">Descrição opcional<textarea maxLength={2000} rows={2} className="rounded-md border border-linha p-2" value={conteudo.descricao ?? ''} onChange={(event) => setConteudo({ ...conteudo, descricao: event.target.value })} /></label>
      <label className="grid gap-1 text-xs font-semibold text-texto-suave">Etiquetas separadas por vírgula<Campo maxLength={400} value={(conteudo.etiquetas ?? []).join(', ')} onChange={(event) => setConteudo({ ...conteudo, etiquetas: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10) })} /></label>
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]"><label className="grid gap-1 text-xs font-semibold text-texto-suave">Fonte<select className="min-h-11 rounded-md border border-linha px-2" value={origemFonte} onChange={(event) => setOrigemFonte(event.target.value as typeof origemFonte)}><option value="catalogo">Catálogo aprovado</option><option value="custom">Personalizados da clínica</option></select></label><label className="grid gap-1 text-xs font-semibold text-texto-suave">Pesquisar alimento (3 caracteres)<Campo value={buscaFonte} onChange={(event) => { setBuscaFonte(event.target.value); if (event.target.value.trim().length < 3) setResultadosFontes([]); }} /></label></div>
      {buscaFonte.trim().length >= 3 && resultadosFontes.length ? <ul className="grid gap-1 rounded border border-linha p-2">{resultadosFontes.map((fonte) => <li key={`${fonte.origem}:${fonte.id}`}><Botao type="button" variante="fantasma" className="w-full justify-start" onClick={() => adicionarFonte(fonte)} disabled={conteudo.entradas.length >= 20}>Adicionar {fonte.nome}</Botao></li>)}</ul> : null}
      {conteudo.entradas.map((entrada, index) => <div key={entrada.id} className="grid gap-2 rounded border border-linha p-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end"><div className="min-w-0"><p className="truncate text-sm font-medium">{entradaPorId.get(`${entrada.origem}:${entrada.alimentoId}`) ?? 'Alimento indisponível'}</p><p className="text-xs text-texto-suave">{entrada.origem === 'custom' ? 'Personalizado' : 'Catálogo'}</p></div><label className="grid gap-1 text-xs font-semibold">Quantidade<Campo type="number" min="0.001" step="0.001" value={entrada.quantidade} onChange={(event) => setConteudo({ ...conteudo, entradas: conteudo.entradas.map((atual, i) => i === index ? { ...atual, quantidade: Number(event.target.value) } : atual) })} /></label><label className="grid gap-1 text-xs font-semibold">Porção (g)<Campo type="number" min="0.001" max="10000" step="0.001" value={entrada.porcaoGramas} onChange={(event) => setConteudo({ ...conteudo, entradas: conteudo.entradas.map((atual, i) => i === index ? { ...atual, porcaoGramas: Number(event.target.value), unidade: 'g', quantidade: Number(event.target.value) } : atual) })} /></label><div className="flex gap-1"><Botao type="button" variante="fantasma" tamanho="sm" aria-label="Mover alimento para cima" onClick={() => moverEntrada(index, index - 1)} disabled={index === 0}><ArrowUp size={15} /></Botao><Botao type="button" variante="fantasma" tamanho="sm" aria-label="Mover alimento para baixo" onClick={() => moverEntrada(index, index + 1)} disabled={index === conteudo.entradas.length - 1}><ArrowDown size={15} /></Botao><Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setConteudo({ ...conteudo, entradas: conteudo.entradas.filter((_, i) => i !== index) })} aria-label="Remover alimento">Remover</Botao></div></div>)}
      <p className="text-xs text-texto-suave">As porções são explícitas em gramas. Não calculamos equivalência nutricional nem alteramos alimentos existentes.</p>
      <div className="flex flex-wrap gap-2"><Botao type="button" variante="primario" onClick={() => void salvar()} carregando={ocupado}>Salvar</Botao><Botao type="button" variante="fantasma" onClick={() => { setConteudo(null); setAcao(null); }}>Cancelar</Botao></div>
    </fieldset> : null}
    <div className="grid gap-2">
      {grupos.length === 0 ? <EstadoVazio titulo="Nenhum grupo encontrado" descricao="Ajuste os filtros ou crie um grupo para reutilizar alternativas." /> : grupos.map((grupo) => <article key={grupo.id} className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="min-h-11 min-w-0 text-left" onClick={() => void abrirGrupo(grupo)}><span className="font-semibold text-tinta">{grupo.nome}</span><span className="mt-1 block text-sm text-texto-suave">{grupo.quantidadeEntradas} alimentos · {grupo.categoria || 'Sem categoria'}</span></button><div className="flex flex-wrap items-center gap-2"><Etiqueta variante={grupo.escopo === 'clinica' ? 'primaria' : 'neutra'}>{grupo.escopo === 'clinica' ? 'Da clínica' : 'Pessoal'}</Etiqueta>{grupo.estado === 'arquivado' ? <Etiqueta variante="neutra">Arquivado</Etiqueta> : null}{!administracao ? <Botao type="button" variante="fantasma" aria-label={grupo.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} onClick={() => void favoritar(grupo)}><Heart aria-hidden="true" fill={grupo.favorito ? 'currentColor' : 'none'} size={16} /></Botao> : null}<Botao type="button" variante="fantasma" onClick={() => void abrirGrupo(grupo)}>Abrir</Botao></div></article>)}
      {total > grupos.length ? <div className="flex justify-between"><Botao type="button" variante="fantasma" onClick={() => setPagina((atual) => Math.max(1, atual - 1))} disabled={pagina === 1}>Anterior</Botao><span aria-live="polite" className="self-center text-sm">Página {pagina} · {total} grupos</span><Botao type="button" variante="fantasma" onClick={() => setPagina((atual) => atual + 1)}>Próxima</Botao></div> : null}
    </div>
    {selecionado && !conteudo ? <section className="grid gap-3 rounded-lg border border-primaria/30 bg-white p-4" aria-label="Detalhes do grupo"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{selecionado.nome}</h3><p className="text-sm text-texto-suave">{selecionado.descricao || 'Sem descrição'} · Revisão {selecionado.revisao}</p></div><Botao type="button" variante="fantasma" onClick={() => { controladorDetalhe.current?.abort(); setSelecionado(null); }}>Fechar</Botao></div><ol className="grid gap-2">{selecionado.entradas.map((entrada) => <li key={entrada.id} className="rounded border border-linha p-2 text-sm">{'composicao' in entrada ? `${entrada.composicao.descricao} — ${entrada.porcaoGramas} g` : `Indisponível: ${entrada.motivo}`}</li>)}</ol><div className="flex flex-wrap gap-2">{!administracao ? <Botao type="button" variante="fantasma" onClick={() => iniciarEdicao('duplicar')} disabled={selecionado.entradas.some((entrada) => !('composicao' in entrada) || !entrada.disponivel)}><Copy size={15} />Duplicar para pessoal</Botao> : null}{selecionado.podeEditar ? <Botao type="button" variante="fantasma" onClick={() => iniciarEdicao('editar')} disabled={selecionado.entradas.some((entrada) => !('composicao' in entrada) || !entrada.disponivel)}><Pencil size={15} />Editar</Botao> : null}{!administracao && selecionado.podeEditar && selecionado.escopo === 'pessoal' ? <Botao type="button" variante="fantasma" onClick={() => setConfirmarCompartilhamento(true)} disabled={ocupado}><Share2 size={15} />Compartilhar com clínica</Botao> : null}{selecionado.podeEditar ? <Botao type="button" variante="fantasma" onClick={() => selecionado.estado === 'ativo' ? setConfirmarArquivamento(true) : void alterarEstado('ativo')} disabled={ocupado}>{selecionado.estado === 'ativo' ? <><Archive size={15} />Arquivar</> : <><RotateCcw size={15} />Restaurar</>}</Botao> : null}</div>{confirmarCompartilhamento ? <div role="group" aria-label="Confirmar compartilhamento" className="rounded border border-alerta-borda bg-alerta-suave p-3"><p className="text-sm">Profissionais autorizados e administradores da clínica poderão consultar este grupo e reutilizar seus alimentos e porções.</p><div className="mt-2 flex gap-2"><Botao type="button" variante="primario" onClick={() => void compartilhar()} carregando={ocupado}>Confirmar compartilhamento</Botao><Botao type="button" variante="fantasma" onClick={() => setConfirmarCompartilhamento(false)}>Cancelar</Botao></div></div> : null}{confirmarArquivamento ? <div role="group" aria-label="Confirmar arquivamento" className="rounded border border-alerta-borda bg-alerta-suave p-3"><p className="text-sm">Arquivar este grupo? Aplicações já salvas nos planos permanecem preservadas.</p><div className="mt-2 flex gap-2"><Botao type="button" variante="primario" onClick={() => void alterarEstado('arquivado')} carregando={ocupado}>Confirmar arquivamento</Botao><Botao type="button" variante="fantasma" onClick={() => setConfirmarArquivamento(false)}>Cancelar</Botao></div></div> : null}</section> : null}
  </section>;
}
