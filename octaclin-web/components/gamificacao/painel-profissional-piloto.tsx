'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PacienteResumo, RespostaPaginada } from '@/lib/cadastros-api';
import { obterSessao } from '@/lib/auth-api';
import { chavePiloto, consultarConsole, type CirculoPilotoApi, type ConquistaPilotoApi, type PaginaPiloto } from '@/lib/gamificacao-piloto-api';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Aviso, EstadoVazio } from '@/components/ui/feedback';

interface Convite { id: string; estado: string; versao: number; geracao: number; expiraEm?: string | null }
interface Relato { id: string; estado: string; versao: number; evidencia?: { texto?: string; motivo?: string; autor?: string; criadoEm?: string } }
interface ItemFeed { id: string; texto: string; autor: string; criadoEm: string; versao: number; proprio: boolean; reacoes: { total: number; curti: boolean } }

export function PainelProfissionalPiloto() {
  const [podeUsar, setPodeUsar] = useState<boolean | null>(null);
  const [pacientes, setPacientes] = useState<RespostaPaginada<Pick<PacienteResumo, 'id'|'nome'>> | null>(null);
  const [paginaPacientes, setPaginaPacientes] = useState(1);
  const [busca, setBusca] = useState('');
  const [pacienteId, setPacienteId] = useState('');
  const [circulos, setCirculos] = useState<CirculoPilotoApi[]>([]);
  const [circuloId, setCirculoId] = useState('');
  const [conquistasState, setConquistasState] = useState<{ pacienteId: string; itens: ConquistaPilotoApi[]; temMais: boolean; cursor?: string } | null>(null);
  const [atividadeState, setAtividadeState] = useState<{ circuloId: string; posts: ItemFeed[]; denuncias: Relato[]; postsTemMais: boolean; postsCursor?: string; denunciasTemMais: boolean; denunciasCursor?: string } | null>(null);
  const [circulosTemMais, setCirculosTemMais] = useState(false);
  const [circulosCursor, setCirculosCursor] = useState<string | undefined>();
  const [nomeCirculo, setNomeCirculo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pendingKeys = useRef(new Map<string, string>());
  const leituraAtual=useRef(0);
  const [comentarios,setComentarios]=useState<Record<string,{itens:ItemFeed[];temMais:boolean;cursor?:string}>>({});
  const conquistas = conquistasState?.pacienteId === pacienteId ? conquistasState.itens : [];
  const feed = atividadeState?.circuloId === circuloId ? atividadeState.posts : [];
  const denuncias = atividadeState?.circuloId === circuloId ? atividadeState.denuncias : [];

  async function buscarNaCarteira(termo: string, pagina: number, signal: AbortSignal) {
    const response = await fetch('/api/pacientes/buscar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal,
      body: JSON.stringify({ pagina, limite: 20, busca: termo || undefined })
    });
    if (!response.ok) throw new Error('A busca autorizada da carteira não está disponível.');
    const page = await response.json() as RespostaPaginada<PacienteResumo>;
    return { itens: page.itens.map(({id,nome}) => ({id,nome})), total: page.total };
  }

  useEffect(() => { void obterSessao().then((s) => setPodeUsar(s?.papel === 'Professional' && s.permissoes.includes('gamificacao.gerenciar') && s.permissoes.includes('pacientes.gerenciar'))).catch(() => setPodeUsar(false)); }, []);
  useEffect(() => {
    if (!podeUsar) return;
    let ativo = true;
    void consultarConsole<PaginaPiloto<CirculoPilotoApi>>('console-circulos')
      .then((c) => { if (ativo) { setCirculos(c.itens); setCirculosTemMais(c.temMais); setCirculosCursor(c.proximoCursor); setCirculoId(current => current || c.itens[0]?.id || ''); } })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'O piloto está indisponível para esta clínica.'); });
    return () => { ativo = false; };
  }, [podeUsar]);
  useEffect(() => {
    if (!podeUsar) return;
    let ativo = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void buscarNaCarteira(busca.trim(), paginaPacientes, controller.signal)
      .then((page) => { if (ativo) setPacientes(page); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'O piloto está indisponível para esta clínica.'); }), 250);
    return () => { ativo = false; window.clearTimeout(timer); controller.abort(); };
  }, [podeUsar, busca, paginaPacientes]);
  useEffect(() => {
    if (!podeUsar || !pacienteId) return;
    let ativo = true;
    void consultarConsole<PaginaPiloto<ConquistaPilotoApi>>('console-conquistas', { pacienteId }).then((p) => { if (ativo) setConquistasState({ pacienteId, itens: p.itens, temMais: p.temMais, cursor: p.proximoCursor }); }).catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível abrir as conquistas.'); });
    return () => { ativo = false; };
  }, [podeUsar, pacienteId]);
  useEffect(() => {
    if (!podeUsar || !circuloId) return;
    const leitura=++leituraAtual.current;
    let ativo = true;
    void Promise.all([
      consultarConsole<PaginaPiloto<ItemFeed>>('console-feed', { circuloId }),
      consultarConsole<PaginaPiloto<Relato>>('console-denuncias', { circuloId })
    ]).then(([posts, reports]) => { if (ativo&&leitura===leituraAtual.current) setAtividadeState({ circuloId, posts: posts.itens, denuncias: reports.itens, postsTemMais: posts.temMais, postsCursor: posts.proximoCursor, denunciasTemMais: reports.temMais, denunciasCursor: reports.proximoCursor }); }).catch((e: unknown) => { if (ativo&&leitura===leituraAtual.current){setAtividadeState(null);setComentarios({});setErro(e instanceof Error ? e.message : 'Este círculo não está disponível.');} });
    return () => { ativo = false; };
  }, [podeUsar, circuloId]);

  async function executar(acao: string, dados: Record<string, unknown>): Promise<boolean> {
    setOcupado(true); setErro(null); setAviso(null);
    let comandoConfirmado = false;
    const fingerprint = JSON.stringify([acao, dados]);
    const chave = pendingKeys.current.get(fingerprint) ?? chavePiloto();
    pendingKeys.current.set(fingerprint, chave);
    try {
      await consultarConsole(acao, { ...dados, chave, versaoEsperada: dados.versaoEsperada ?? 0 });
      comandoConfirmado = true;
      pendingKeys.current.delete(fingerprint);
      if (pacienteId && ['conceder-conquista','compartilhar-conquista'].includes(acao)) {
        const page = await consultarConsole<PaginaPiloto<ConquistaPilotoApi>>('console-conquistas', { pacienteId }); setConquistasState({ pacienteId, itens: page.itens, temMais: page.temMais, cursor: page.proximoCursor });
      }
      if (['criar-circulo','encerrar-circulo'].includes(acao)) {
        const page = await consultarConsole<PaginaPiloto<CirculoPilotoApi>>('console-circulos'); setCirculos(page.itens); setCirculosTemMais(page.temMais); setCirculosCursor(page.proximoCursor);
      }
      if (circuloId && ['decidir-denuncia','encerrar-circulo','convidar','revogar-convite','console-retirar-post','console-retirar-comentario'].includes(acao)) {
        const leitura=++leituraAtual.current;setAtividadeState(null);setComentarios({});
        const [reports, posts] = await Promise.all([
          consultarConsole<PaginaPiloto<Relato>>('console-denuncias', { circuloId }),
          consultarConsole<PaginaPiloto<ItemFeed>>('console-feed', { circuloId })
        ]);
        if(leitura===leituraAtual.current)setAtividadeState({ circuloId, posts: posts.itens, denuncias: reports.itens, postsTemMais: posts.temMais, postsCursor: posts.proximoCursor, denunciasTemMais: reports.temMais, denunciasCursor: reports.proximoCursor });
      }
      setAviso('Alteração registrada e lista atualizada.');
      return true;
    }
    catch (e) { setErro(comandoConfirmado ? 'A alteração foi confirmada, mas a lista não atualizou. Recarregue antes de tentar outra vez.' : e instanceof Error ? e.message : 'A ação não foi confirmada. Recarregue e confira o estado.'); return comandoConfirmado; }
    finally { setOcupado(false); }
  }

  async function carregarMaisConquistas() {
    if (!pacienteId || conquistasState?.pacienteId !== pacienteId || !conquistasState.cursor) return;
    setOcupado(true);try { const page=await consultarConsole<PaginaPiloto<ConquistaPilotoApi>>('console-conquistas',{pacienteId,cursor:conquistasState.cursor}); setConquistasState(current=>current?.pacienteId===pacienteId?{pacienteId,itens:[...current.itens,...page.itens],temMais:page.temMais,cursor:page.proximoCursor}:current); }
    catch(e) { setErro(e instanceof Error?e.message:'Não foi possível carregar mais conquistas.'); }finally{setOcupado(false);}
  }

  async function carregarMaisCirculos() {
    if (!circulosCursor) return;
    setOcupado(true);try { const page=await consultarConsole<PaginaPiloto<CirculoPilotoApi>>('console-circulos',{cursor:circulosCursor}); setCirculos(current=>[...current,...page.itens]); setCirculosTemMais(page.temMais); setCirculosCursor(page.proximoCursor); }
    catch(e) { setErro(e instanceof Error?e.message:'Não foi possível carregar mais círculos.'); }finally{setOcupado(false);}
  }

  async function carregarMaisAtividade(tipo:'feed'|'denuncias') {
    if (!circuloId || atividadeState?.circuloId!==circuloId) return;
    const leitura=leituraAtual.current;
    const cursor=tipo==='feed'?atividadeState.postsCursor:atividadeState.denunciasCursor;
    if (!cursor) return;
    setOcupado(true);
    try {
      if(tipo==='feed'){
        const page=await consultarConsole<PaginaPiloto<ItemFeed>>('console-feed',{circuloId,cursor});
        if(leitura!==leituraAtual.current)return;
        setAtividadeState(current=>current?.circuloId===circuloId?{...current,posts:[...current.posts,...page.itens],postsTemMais:page.temMais,postsCursor:page.proximoCursor}:current);
      }else{
        const page=await consultarConsole<PaginaPiloto<Relato>>('console-denuncias',{circuloId,cursor});
        if(leitura!==leituraAtual.current)return;
        setAtividadeState(current=>current?.circuloId===circuloId?{...current,denuncias:[...current.denuncias,...page.itens],denunciasTemMais:page.temMais,denunciasCursor:page.proximoCursor}:current);
      }
    } catch(e) { setErro(e instanceof Error?e.message:'Não foi possível carregar mais atividade.'); }finally{setOcupado(false);}
  }

  async function carregarComentarios(postId:string,cursor?:string) {
    const leitura=leituraAtual.current;
    try {
      const page=await consultarConsole<PaginaPiloto<ItemFeed>>('console-comentarios',{circuloId,postId,...(cursor?{cursor}:{})});
      if(leitura!==leituraAtual.current)return;
      setComentarios(v=>({...v,[postId]:{itens:cursor?[...(v[postId]?.itens??[]),...page.itens]:page.itens,temMais:page.temMais,cursor:page.proximoCursor}}));
    }catch(e){if(leitura===leituraAtual.current){setComentarios(v=>({...v,[postId]:{itens:[],temMais:false}}));setErro(e instanceof Error?e.message:'Comentários indisponíveis.');}}
  }

  async function conceder(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!pacienteId) return; if(await executar('conceder-conquista',{pacienteId,titulo,descricao:descricao||undefined,icone:'award'})){setTitulo('');setDescricao('');} }
  async function criar(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if(await executar('criar-circulo',{nome:nomeCirculo,objetivo})){setNomeCirculo('');setObjetivo('');} }
  async function convidar() {
    if (!circuloId||!pacienteId||!window.confirm('Enviar um convite? A pessoa entrará apenas depois de aceitar o termo e confirmar o nome de exibição.')) return;
    try { const current=await consultarConsole<Convite>('console-convite',{circuloId,pacienteId}); if (['ativo','convidado'].includes(current.estado) && !window.confirm('Esta pessoa já tem um convite ou participação. Criar uma nova geração?')) return;
      await executar('convidar',{circuloId,pacienteId,versaoEsperada:current.versao}); }
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível enviar o convite.');}
  }
  async function revogarParticipacao() {
    if (!circuloId || !pacienteId) return;
    try {
      const current=await consultarConsole<Convite>('console-convite',{circuloId,pacienteId});
      if (!['ativo','convidado'].includes(current.estado)) { setAviso('Não há convite ou participação ativa para revogar.'); return; }
      if (window.confirm('Revogar este convite/participação? O conteúdo e as interações da pessoa ficarão ocultos no círculo.')) await executar('revogar-convite',{circuloId,pacienteId,versaoEsperada:current.versao});
    } catch(e) { setErro(e instanceof Error?e.message:'Não foi possível consultar a participação.'); }
  }
  async function decidirDenuncia(report: Relato, retirar: boolean) {
    const justificativa=window.prompt(retirar?'Explique por que este conteúdo será retirado (até 1.000 caracteres).':'Explique a decisão de manter o conteúdo (até 1.000 caracteres).');
    if (!justificativa?.trim() || justificativa.length>1000) return;
    await executar('decidir-denuncia',{circuloId,denunciaId:report.id,retirar,justificativa:justificativa.trim(),versaoEsperada:report.versao});
  }

  if (podeUsar === null) return <p role="status">Verificando seu acesso…</p>;
  if (!podeUsar) return null;
  return <div className="grid gap-6">
    {erro?<Aviso variante="alerta" mensagem={erro}/>:null}{aviso?<Aviso variante="sucesso" mensagem={aviso}/>:null}
    <Cartao><CartaoCabecalho><CartaoTitulo>Paciente selecionado</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3 sm:grid-cols-[1fr_1fr]">
      <div><Rotulo htmlFor="busca-piloto">Buscar na sua carteira</Rotulo><Campo id="busca-piloto" maxLength={120} value={busca} onChange={e=>{setBusca(e.target.value);setPaginaPacientes(1);}} placeholder="Nome do paciente" autoComplete="off" /></div>
      <div><Rotulo htmlFor="paciente-piloto">Escolha uma pessoa</Rotulo><Selecao id="paciente-piloto" value={pacienteId} onChange={e=>setPacienteId(e.target.value)}><option value="">Selecione</option>{pacientes?.itens.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao></div>
      <div className="flex items-center gap-2 sm:col-span-2"><Botao type="button" disabled={paginaPacientes<=1} onClick={()=>setPaginaPacientes(p=>Math.max(1,p-1))}>Página anterior</Botao><span className="text-sm text-texto-suave">Página {paginaPacientes} · {pacientes?.total??0} resultados</span><Botao type="button" disabled={!pacientes||paginaPacientes*20>=pacientes.total} onClick={()=>setPaginaPacientes(p=>p+1)}>Próxima página</Botao></div>
      <p className="text-sm text-texto-suave sm:col-span-2">A seleção usa a busca autorizada da carteira; nomes e IDs não são gravados no navegador.</p>
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Conquistas individuais</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-4">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={conceder}><div><Rotulo htmlFor="conquista-titulo">Conquista</Rotulo><Campo id="conquista-titulo" maxLength={120} required value={titulo} onChange={e=>setTitulo(e.target.value)} /></div><div><Rotulo htmlFor="conquista-descricao">Descrição opcional</Rotulo><Campo id="conquista-descricao" maxLength={1000} value={descricao} onChange={e=>setDescricao(e.target.value)} /></div><div className="sm:col-span-2"><Botao type="submit" disabled={ocupado||!pacienteId}>Registrar em privado</Botao></div></form>
      {conquistas.length?conquistas.map(item=><article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-linha p-3"><div><p className="font-semibold">{item.titulo}</p><p className="text-sm text-texto-suave">{item.descricao||'Sem descrição'} · {item.compartilhado?'Compartilhada':'Privada'}</p></div><Botao type="button" disabled={ocupado||!pacienteId} onClick={()=>{if(window.confirm(item.compartilhado?'Retirar o compartilhamento desta conquista?':'Compartilhar esta conquista no portal após confirmação do paciente?')) void executar('compartilhar-conquista',{pacienteId,conquistaId:item.id,compartilhado:!item.compartilhado,versaoEsperada:item.versao??0});}}>{item.compartilhado?'Retirar':'Compartilhar'}</Botao></article>):<EstadoVazio titulo="Sem conquistas para esta pessoa" descricao={pacienteId?'As conquistas ficam privadas até o profissional compartilhar e o paciente aceitar.':'Escolha um paciente da sua carteira.'}/>}
      {conquistasState?.pacienteId===pacienteId&&conquistasState.temMais?<Botao type="button" disabled={ocupado} onClick={()=>void carregarMaisConquistas()}>{ocupado?'Carregando…':'Carregar mais conquistas'}</Botao>:null}
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Círculos e convites</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-4">
      <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2"><div><Rotulo htmlFor="nome-circulo">Nome do círculo</Rotulo><Campo id="nome-circulo" required maxLength={160} value={nomeCirculo} onChange={e=>setNomeCirculo(e.target.value)}/></div><div><Rotulo htmlFor="objetivo-circulo">Objetivo</Rotulo><Campo id="objetivo-circulo" required maxLength={160} value={objetivo} onChange={e=>setObjetivo(e.target.value)}/></div><div className="sm:col-span-2"><Botao type="submit" disabled={ocupado}>Criar círculo privado</Botao></div></form>
      <div><Rotulo htmlFor="circulo-piloto">Círculo</Rotulo><Selecao id="circulo-piloto" value={circuloId} onChange={e=>{if(e.target.value!==circuloId){leituraAtual.current++;setComentarios({});setAtividadeState(null);setCirculoId(e.target.value);}}}><option value="">Selecione</option>{circulos.map(c=><option key={c.id} value={c.id}>{c.nome} · {c.estado}</option>)}</Selecao></div>
      {circulosTemMais?<Botao type="button" disabled={ocupado} onClick={()=>void carregarMaisCirculos()}>{ocupado?'Carregando…':'Carregar mais círculos'}</Botao>:null}
      <p className="text-sm text-texto-suave">Convide uma pessoa por vez. A lista de participantes não é exposta no console.</p><div className="flex flex-wrap gap-2"><Botao type="button" disabled={ocupado||!pacienteId||!circuloId} onClick={()=>void convidar()}>Convidar paciente selecionado</Botao><Botao type="button" variante="perigo" disabled={ocupado||!pacienteId||!circuloId} onClick={()=>void revogarParticipacao()}>Revogar convite/participação</Botao><Botao type="button" variante="perigo" disabled={ocupado||!circuloId} onClick={()=>{if(window.confirm('Encerrar este círculo? Novas publicações serão bloqueadas e o conteúdo ficará oculto.')) void executar('encerrar-circulo',{circuloId,versaoEsperada:circulos.find(c=>c.id===circuloId)?.versao??0});}}>Encerrar círculo</Botao></div>
      {circulos.length===0?<EstadoVazio titulo="Piloto indisponível ou sem círculos" descricao="A disponibilidade depende da configuração e da autorização operacional da clínica."/>:null}
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Publicações do círculo</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3">
      {feed.length ? feed.map((post) => <article key={post.id} className="rounded-md border border-linha p-3">
        <p className="text-sm font-semibold">{post.autor} · <time dateTime={post.criadoEm}>{new Date(post.criadoEm).toLocaleString('pt-BR')}</time></p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.texto}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Botao type="button" disabled={ocupado} onClick={()=>void carregarComentarios(post.id)}>Ver comentários</Botao><Botao type="button" variante="perigo" disabled={ocupado} onClick={()=>{if(window.confirm('Retirar esta publicação e ocultar suas interações?'))void executar('console-retirar-post',{circuloId,postId:post.id,versaoEsperada:post.versao});}}>Retirar publicação</Botao></div>
        {comentarios[post.id]?.itens.map(comment=><div key={comment.id} className="mt-3 rounded-md border border-linha p-3"><p className="text-sm font-semibold">{comment.autor}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.texto}</p><Botao type="button" variante="perigo" disabled={ocupado} onClick={()=>{if(window.confirm('Retirar este comentário?'))void executar('console-retirar-comentario',{circuloId,postId:post.id,comentarioId:comment.id,versaoEsperada:comment.versao});}}>Retirar comentário</Botao></div>)}
        {comentarios[post.id]?.temMais?<Botao type="button" disabled={ocupado} onClick={()=>void carregarComentarios(post.id,comentarios[post.id].cursor)}>Carregar mais comentários</Botao>:null}
      </article>) : <p className="text-sm text-texto-suave">Selecione um círculo ativo para ver publicações visíveis à moderação.</p>}
      {atividadeState?.circuloId===circuloId&&atividadeState.postsTemMais?<Botao type="button" disabled={ocupado} onClick={()=>void carregarMaisAtividade('feed')}>{ocupado?'Carregando…':'Carregar mais publicações'}</Botao>:null}
      <p className="text-xs text-texto-suave">O conteúdo é apresentado como texto simples aos profissionais autorizados do círculo.</p>
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Denúncias e conteúdo</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3">
      {denuncias.length?denuncias.map(r=><article key={r.id} className="rounded-md border border-linha p-3"><p className="text-sm font-semibold">Denúncia {r.estado}</p><p className="mt-1 whitespace-pre-wrap text-sm">{r.evidencia?.texto}</p><p className="mt-1 text-sm text-texto-suave">Motivo: {r.evidencia?.motivo}</p>{r.estado==='aberta'?<div className="mt-3 flex gap-2"><Botao type="button" variante="perigo" disabled={ocupado} onClick={()=>void decidirDenuncia(r,true)}>Retirar conteúdo</Botao><Botao type="button" disabled={ocupado} onClick={()=>void decidirDenuncia(r,false)}>Manter após revisão</Botao></div>:null}</article>):<p className="text-sm text-texto-suave">Nenhuma denúncia aberta neste círculo.</p>}
      {atividadeState?.circuloId===circuloId&&atividadeState.denunciasTemMais?<Botao type="button" disabled={ocupado} onClick={()=>void carregarMaisAtividade('denuncias')}>{ocupado?'Carregando…':'Carregar mais denúncias'}</Botao>:null}
      <p className="text-xs text-texto-suave">O filtro textual é apenas auxiliar. A decisão de moderação é humana; a denúncia não remove conteúdo automaticamente.</p>
    </CartaoConteudo></Cartao>
  </div>;
}
