'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chavePiloto, consultarPortal, type CirculoPilotoApi, type ConquistaPilotoApi, type PaginaPiloto, type PublicacaoPilotoApi } from '@/lib/gamificacao-piloto-api';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { Aviso, EstadoVazio } from '@/components/ui/feedback';

type Comentario = PublicacaoPilotoApi;
interface Privacidade { id: string; geracao: number; versao?: number; consentimentoVersao?: number; termoVersao?: string; aceito?: boolean; estado?: string }
interface PaginaState { conquistas: ConquistaPilotoApi[]; circulos: CirculoPilotoApi[]; privacyAwards: Privacidade[]; privacyCircles: Privacidade[] }
const termosConquistas='A participação é opcional. Autorizo a exibição, no meu portal, das conquistas que o profissional compartilhar comigo. Elas reconhecem marcos registrados e não são diagnóstico, avaliação de saúde ou comparação com outros pacientes. Outros participantes da comunidade não verão minhas conquistas. Posso revogar esta autorização; isso oculta a exibição no portal e não apaga o histórico profissional que tenha retenção aplicável.';
const termosCirculo='Quero participar deste círculo privado. Outros participantes verão meu nome de exibição confirmado, minhas publicações, comentários e as curtidas que eu fizer. Minha participação pode me identificar como paciente da clínica. O conteúdo é publicado imediatamente, antes de revisão humana, e pode ser retirado pelo profissional após denúncia. Não publique dados pessoais ou de saúde de outras pessoas. Este espaço não substitui atendimento individual. Posso denunciar conteúdo e sair a qualquer momento. Ao sair ou revogar este aceite, meu conteúdo e minhas interações serão ocultados; isso não elimina cópias já vistas por outras pessoas. Conteúdo retirado e denúncias podem permanecer restritos à moderação por até 90 dias, ou pela necessidade legal específica registrada. Para retornar, precisarei de novo convite e aceite.';

export function GamificacaoPilotoPortal() {
  const [data,setData]=useState<PaginaState>({conquistas:[],circulos:[],privacyAwards:[],privacyCircles:[]});
  const [feeds,setFeeds]=useState<Record<string,PublicacaoPilotoApi[]>>({});
  const [comments,setComments]=useState<Record<string,Comentario[]>>({});
  const [likeNames,setLikeNames]=useState<Record<string,string[]>>({});
  const [comentariosDraft,setComentariosDraft]=useState<Record<string,string>>({});
  const [nomes,setNomes]=useState<Record<string,string>>({});
  const [textos,setTextos]=useState<Record<string,string>>({});
  const [consentimentos,setConsentimentos]=useState<Record<string,boolean>>({});
  const [erro,setErro]=useState<string|null>(null);
  const [aviso,setAviso]=useState<string|null>(null);
  const [indisponivel,setIndisponivel]=useState(false);
  const [busy,setBusy]=useState(false);
  const [paginacao,setPaginacao]=useState<Record<string,{cursor?:string;temMais:boolean}>>({});
  const pendingKeys=useRef(new Map<string,string>());
  const leituraAtual=useRef(0);

  const carregarFeed = useCallback(async (circleId:string,cursor?:string,acrescentar=false) => { const leitura=leituraAtual.current; try { const page=await consultarPortal<PaginaPiloto<PublicacaoPilotoApi>>('portal-feed',{circuloId:circleId,...(cursor?{cursor}:{})}); if(leitura!==leituraAtual.current)return; setFeeds(v=>({...v,[circleId]:acrescentar?[...(v[circleId]??[]),...page.itens]:page.itens})); setPaginacao(v=>({...v,[`feed:${circleId}`]:{cursor:page.proximoCursor,temMais:page.temMais}})); } catch { if(leitura===leituraAtual.current){setFeeds(v=>({...v,[circleId]:[]}));setErro('Não foi possível carregar o conteúdo deste círculo agora.');} } }, []);

  const carregar = useCallback(async () => {
    const leitura=++leituraAtual.current;
    setFeeds({});setComments({});setLikeNames({});setPaginacao({});setConsentimentos({});
    setData({conquistas:[],circulos:[],privacyAwards:[],privacyCircles:[]});
    const result=await Promise.allSettled([
      consultarPortal<PaginaPiloto<ConquistaPilotoApi>>('portal-conquistas'),
      consultarPortal<PaginaPiloto<CirculoPilotoApi>>('portal-circulos'),
      consultarPortal<PaginaPiloto<Privacidade>>('portal-privacidade-conquistas'),
      consultarPortal<PaginaPiloto<Privacidade>>('portal-privacidade-circulos')
    ]);
    if(leitura!==leituraAtual.current)return;
    setErro(null);
    setData({conquistas:result[0].status==='fulfilled'?result[0].value.itens:[],circulos:result[1].status==='fulfilled'?result[1].value.itens:[],privacyAwards:result[2].status==='fulfilled'?result[2].value.itens:[],privacyCircles:result[3].status==='fulfilled'?result[3].value.itens:[]});
    const pageState:Record<string,{cursor?:string;temMais:boolean}>={};
    (['conquistas','circulos','privacyAwards','privacyCircles'] as const).forEach((key,index)=>{const resultPage=result[index];if(resultPage.status==='fulfilled')pageState[key]={cursor:resultPage.value.proximoCursor,temMais:resultPage.value.temMais};});
    setPaginacao(pageState);
    const failed=result.slice(0,2).some(r=>r.status==='rejected');setIndisponivel(failed);
    const privacyFailed=result.slice(2).some(r=>r.status==='rejected');if(privacyFailed)setErro('Não foi possível carregar suas opções de privacidade.');
    const circles=result[1].status==='fulfilled'?result[1].value.itens:[];
    for(const circle of circles){if(circle.participacao==='ativo')void carregarFeed(circle.id);}
  }, [carregarFeed]);
  useEffect(()=>{const controleLeitura=leituraAtual;const timer=window.setTimeout(()=>void carregar(),0);return()=>{window.clearTimeout(timer);controleLeitura.current++;};},[carregar]);
  async function carregarMaisLista(tipo:'conquistas'|'circulos'|'privacyAwards'|'privacyCircles'){
    const cursor=paginacao[tipo]?.cursor;if(!cursor)return;const leitura=leituraAtual.current;setBusy(true);
    try{
      if(tipo==='conquistas'){const page=await consultarPortal<PaginaPiloto<ConquistaPilotoApi>>('portal-conquistas',{cursor});if(leitura!==leituraAtual.current)return;setData(v=>({...v,conquistas:[...v.conquistas,...page.itens]}));setPaginacao(v=>({...v,[tipo]:{cursor:page.proximoCursor,temMais:page.temMais}}));}
      if(tipo==='circulos'){const page=await consultarPortal<PaginaPiloto<CirculoPilotoApi>>('portal-circulos',{cursor});if(leitura!==leituraAtual.current)return;setData(v=>({...v,circulos:[...v.circulos,...page.itens]}));setPaginacao(v=>({...v,[tipo]:{cursor:page.proximoCursor,temMais:page.temMais}}));for(const circle of page.itens)if(circle.participacao==='ativo')void carregarFeed(circle.id);}
      if(tipo==='privacyAwards'){const page=await consultarPortal<PaginaPiloto<Privacidade>>('portal-privacidade-conquistas',{cursor});if(leitura!==leituraAtual.current)return;setData(v=>({...v,privacyAwards:[...v.privacyAwards,...page.itens]}));setPaginacao(v=>({...v,[tipo]:{cursor:page.proximoCursor,temMais:page.temMais}}));}
      if(tipo==='privacyCircles'){const page=await consultarPortal<PaginaPiloto<Privacidade>>('portal-privacidade-circulos',{cursor});if(leitura!==leituraAtual.current)return;setData(v=>({...v,privacyCircles:[...v.privacyCircles,...page.itens]}));setPaginacao(v=>({...v,[tipo]:{cursor:page.proximoCursor,temMais:page.temMais}}));}
    }catch(e){if(leitura===leituraAtual.current)setErro(e instanceof Error?e.message:'Não foi possível carregar mais itens.');}finally{setBusy(false);}
  }
  async function carregarComentarios(circleId:string,postId:string,cursor?:string,acrescentar=false){const leitura=leituraAtual.current;try{const page=await consultarPortal<PaginaPiloto<Comentario>>('portal-comentarios',{circuloId:circleId,postId,...(cursor?{cursor}:{})});if(leitura!==leituraAtual.current)return;setComments(v=>({...v,[postId]:acrescentar?[...(v[postId]??[]),...page.itens]:page.itens}));setPaginacao(v=>({...v,[`comments:${postId}`]:{cursor:page.proximoCursor,temMais:page.temMais}}));}catch(e){if(leitura===leituraAtual.current){setComments(v=>({...v,[postId]:[]}));setErro(e instanceof Error?e.message:'Não foi possível abrir os comentários.');}}}
  async function carregarMaisFeed(circleId:string){const page=paginacao[`feed:${circleId}`];if(!page?.cursor)return;setBusy(true);try{await carregarFeed(circleId,page.cursor,true);}finally{setBusy(false);}}
  async function carregarMaisComentarios(circleId:string,postId:string){const page=paginacao[`comments:${postId}`];if(!page?.cursor)return;setBusy(true);try{await carregarComentarios(circleId,postId,page.cursor,true);}finally{setBusy(false);}}
  async function executar(acao:string,dados:Record<string,unknown>):Promise<boolean>{setBusy(true);setErro(null);setAviso(null);const fingerprint=JSON.stringify([acao,dados]);const chave=pendingKeys.current.get(fingerprint)??chavePiloto();pendingKeys.current.set(fingerprint,chave);try{await consultarPortal(acao,{...dados,chave});pendingKeys.current.delete(fingerprint);setAviso('Solicitação registrada. Atualize a tela para conferir o estado.');await carregar();return true;}catch(e){setErro(e instanceof Error?e.message:'A solicitação não foi confirmada. Atualize e confira o estado.');return false;}finally{setBusy(false);}}
  async function reagir(circleId:string,post:PublicacaoPilotoApi,comment?:Comentario){await executar('curtir',{circuloId:circleId,postId:post.id,...(comment?{comentarioId:comment.id}:{}),curti:!(comment?.reacoes.curti??post.reacoes.curti),versaoEsperada:comment?.versao??post.versao});}
  async function denunciar(circleId:string,post:PublicacaoPilotoApi,comment?:Comentario){const alvo=comment??post;if(!window.confirm('Enviar uma denúncia privada ao profissional responsável? A denúncia não remove o conteúdo automaticamente.'))return;const motivo=window.prompt('Explique por que este conteúdo precisa de revisão (até 1.000 caracteres).');if(!motivo?.trim()||motivo.length>1000)return;await executar('denunciar',{circuloId:circleId,postId:post.id,...(comment?{comentarioId:comment.id}:{}),motivo:motivo.trim(),versaoEsperada:alvo.versao});}
  async function mostrarCurtidas(circleId:string,postId:string,commentId?:string,cursor?:string,acrescentar=false){const leitura=leituraAtual.current;const key=commentId??postId;try{const page=await consultarPortal<PaginaPiloto<{nome:string}>>('portal-curtidas',{circuloId:circleId,postId,...(commentId?{comentarioId:commentId}:{}),...(cursor?{cursor}:{})});if(leitura!==leituraAtual.current)return;setLikeNames(v=>({...v,[key]:acrescentar?[...(v[key]??[]),...page.itens.map(x=>x.nome)]:page.itens.map(x=>x.nome)}));setPaginacao(v=>({...v,[`likes:${key}`]:{cursor:page.proximoCursor,temMais:page.temMais}}));}catch(e){if(leitura===leituraAtual.current){setLikeNames(v=>({...v,[key]:[]}));setErro(e instanceof Error?e.message:'Não foi possível ver as curtidas.');}}}
  async function carregarMaisCurtidas(circleId:string,postId:string,commentId?:string){const key=commentId??postId;const page=paginacao[`likes:${key}`];if(!page?.cursor)return;setBusy(true);try{await mostrarCurtidas(circleId,postId,commentId,page.cursor,true);}finally{setBusy(false);}}

  return <div className="grid gap-6">
    {erro?<Aviso variante="alerta" mensagem={erro}/>:null}{aviso?<Aviso variante="sucesso" mensagem={aviso}/>:null}
    {indisponivel?<Aviso variante="alerta" mensagem="Conquistas e círculos não estão disponíveis agora. As opções pessoais de privacidade abaixo continuam disponíveis para revisar ou retirar aceites anteriores."/>:null}
    <Cartao><CartaoCabecalho><CartaoTitulo>Conquistas compartilhadas</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3">
      {data.conquistas.map(item=><article key={item.id} className="rounded-md border border-linha p-3">{item.aceito?<><h3 className="font-semibold">{item.titulo}</h3><p className="mt-1 text-sm text-texto-suave">{item.descricao||'Marco registrado pelo profissional'} · {item.origem}</p><Botao className="mt-3" type="button" disabled={busy} onClick={()=>void executar('consentir-conquista',{conquistaId:item.id,aceitar:false,geracao:item.geracao,termoVersao:item.termoVersao,versaoEsperada:item.consentimentoVersao??0})}>Revogar exibição</Botao></>:<><h3 className="font-semibold">Uma conquista foi compartilhada</h3><p className="mt-2 text-sm">{termosConquistas}</p><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={!!consentimentos[item.id]} onChange={e=>setConsentimentos(v=>({...v,[item.id]:e.target.checked}))}/><span>Li e aceito a exibição desta conquista no meu portal.</span></label><Botao className="mt-3" type="button" disabled={busy||!consentimentos[item.id]} onClick={()=>void executar('consentir-conquista',{conquistaId:item.id,aceitar:true,geracao:item.geracao,termoVersao:item.termoVersao,versaoEsperada:item.consentimentoVersao??0})}>Aceitar e visualizar</Botao></>}</article>)}
      {paginacao.conquistas?.temMais?<Botao type="button" disabled={busy} onClick={()=>void carregarMaisLista('conquistas')}>Carregar mais conquistas</Botao>:null}
      {!data.conquistas.length?<EstadoVazio titulo="Nenhuma conquista compartilhada" descricao="A participação é opcional e as conquistas não são comparadas com outras pessoas."/>:null}
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Convites e círculos</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-4">
      {data.circulos.map(circle=><section key={circle.id} className="rounded-md border border-linha p-3"><h3 className="font-semibold">{circle.nome}</h3><p className="mt-1 text-sm text-texto-suave">{circle.objetivo}</p>{circle.participacao==='convidado'?<div className="mt-3 grid gap-3"><p className="text-sm">{circle.destinatarios?`Clínica: ${circle.destinatarios.clinica} · Profissional responsável: ${circle.destinatarios.profissional}`:"Não foi possível conferir clínica e profissional responsáveis. A confirmação está indisponível."}</p><p className="text-sm">{termosCirculo}</p><div><Rotulo htmlFor={`nome-${circle.id}`}>Nome de exibição</Rotulo><Campo id={`nome-${circle.id}`} autoComplete="nickname" maxLength={80} value={nomes[circle.id]??''} onChange={e=>setNomes(v=>({...v,[circle.id]:e.target.value}))}/><p className="mt-1 text-xs text-texto-suave">Outros participantes poderão identificar você pelo nome confirmado.</p></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={!!consentimentos[`circle-${circle.id}`]} onChange={e=>setConsentimentos(v=>({...v,[`circle-${circle.id}`]:e.target.checked}))}/><span>Li o termo proposto e quero participar deste círculo.</span></label><Botao type="button" disabled={busy||!circle.destinatarios||!consentimentos[`circle-${circle.id}`]||!nomes[circle.id]?.trim()} onClick={()=>void executar('aceitar-circulo',{circuloId:circle.id,geracao:circle.geracao,versaoEsperada:circle.participacaoVersao??0,termoVersao:circle.termoVersao,nomeExibicao:nomes[circle.id]?.trim()})}>Aceitar convite</Botao></div>:null}{circle.participacao==='ativo'?<><div className="mt-3 flex flex-wrap items-end gap-2"><div className="min-w-56 flex-1"><Rotulo htmlFor={`post-${circle.id}`}>Publicação em texto</Rotulo><Campo id={`post-${circle.id}`} maxLength={2000} value={textos[circle.id]??''} onChange={e=>setTextos(v=>({...v,[circle.id]:e.target.value}))}/></div><Botao type="button" disabled={busy||!textos[circle.id]?.trim()} onClick={()=>{const texto=textos[circle.id].trim();void executar('publicar',{circuloId:circle.id,texto,versaoEsperada:0}).then(ok=>{if(ok)setTextos(v=>({...v,[circle.id]:''}));});}}>Publicar</Botao><Botao type="button" variante="perigo" disabled={busy} onClick={()=>{if(window.confirm('Sair do círculo? Suas publicações e interações ficarão ocultas e um novo convite será necessário para voltar.'))void executar('sair-circulo',{circuloId:circle.id,versaoEsperada:circle.participacaoVersao??0});}}>Sair</Botao></div>
      <div className="grid gap-3">
        {(feeds[circle.id] ?? []).map((post) => (
          <article key={post.id} className="rounded-md border border-linha p-3">
            <p className="text-sm font-semibold">{post.autor}</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.texto}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao type="button" onClick={() => void reagir(circle.id, post)}>{post.reacoes.curti ? 'Descurtir' : 'Curtir'} ({post.reacoes.total})</Botao>
              <Botao type="button" onClick={() => void carregarComentarios(circle.id, post.id)}>Comentários</Botao>
              <Botao type="button" onClick={() => void denunciar(circle.id, post)}>Denunciar</Botao>
              <Botao type="button" onClick={() => void mostrarCurtidas(circle.id, post.id)}>Quem curtiu</Botao>
              {post.proprio ? <Botao type="button" variante="perigo" onClick={() => { if (window.confirm('Retirar esta publicação e ocultar suas interações?')) void executar('retirar-post', { circuloId: circle.id, postId: post.id, versaoEsperada: post.versao }); }}>Retirar publicação</Botao> : null}
            </div>
            {likeNames[post.id] ? <><p className="mt-2 text-xs text-texto-suave">Curtidas: {likeNames[post.id].join(', ') || 'nenhuma'}</p>{paginacao[`likes:${post.id}`]?.temMais?<Botao tamanho="sm" type="button" disabled={busy} onClick={()=>void carregarMaisCurtidas(circle.id,post.id)}>Carregar mais curtidas</Botao>:null}</> : null}
            <div className="mt-3 grid gap-2">
              {(comments[post.id] ?? []).map((comment) => (
                <div key={comment.id} className="rounded-md bg-superficie p-2">
                  <p className="text-xs font-semibold">{comment.autor}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.texto}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Botao tamanho="sm" type="button" onClick={() => void reagir(circle.id, post, comment)}>Curtir ({comment.reacoes.total})</Botao>
                    <Botao tamanho="sm" type="button" onClick={() => void mostrarCurtidas(circle.id, post.id, comment.id)}>Quem curtiu</Botao>
                    <Botao tamanho="sm" type="button" onClick={() => void denunciar(circle.id, post, comment)}>Denunciar</Botao>
                    {comment.proprio ? <Botao tamanho="sm" variante="perigo" type="button" onClick={() => { if (window.confirm('Retirar este comentário?')) void executar('retirar-comentario', { circuloId: circle.id, postId: post.id, comentarioId: comment.id, versaoEsperada: comment.versao }); }}>Retirar</Botao> : null}
                  </div>
                  {likeNames[comment.id] ? <><p className="mt-1 text-xs text-texto-suave">Curtidas: {likeNames[comment.id].join(', ') || 'nenhuma'}</p>{paginacao[`likes:${comment.id}`]?.temMais?<Botao tamanho="sm" type="button" disabled={busy} onClick={()=>void carregarMaisCurtidas(circle.id,post.id,comment.id)}>Carregar mais curtidas</Botao>:null}</> : null}
                </div>
              ))}
            </div>
            {paginacao[`comments:${post.id}`]?.temMais?<Botao tamanho="sm" type="button" disabled={busy} onClick={()=>void carregarMaisComentarios(circle.id,post.id)}>Carregar mais comentários</Botao>:null}
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const texto=comentariosDraft[post.id]?.trim(); if(texto)void executar('comentar',{circuloId:circle.id,postId:post.id,texto,versaoEsperada:0}).then(ok=>{if(ok)setComentariosDraft(v=>({...v,[post.id]:''}));}); }}>
              <Campo aria-label="Escreva um comentário" name="comentario" maxLength={500} placeholder="Escreva um comentário" value={comentariosDraft[post.id]??''} onChange={e=>setComentariosDraft(v=>({...v,[post.id]:e.target.value}))} />
              <Botao type="submit" disabled={busy||!comentariosDraft[post.id]?.trim()}>Comentar</Botao>
            </form>
          </article>
        ))}
      </div>
      {paginacao[`feed:${circle.id}`]?.temMais?<Botao type="button" disabled={busy} onClick={()=>void carregarMaisFeed(circle.id)}>Carregar mais publicações</Botao>:null}
      </>:null}</section>)}
      {paginacao.circulos?.temMais?<Botao type="button" disabled={busy} onClick={()=>void carregarMaisLista('circulos')}>Carregar mais convites e círculos</Botao>:null}
      {!data.circulos.length?<EstadoVazio titulo="Nenhum convite ou círculo ativo" descricao="Seu nome e suas publicações só ficam visíveis após você aceitar um convite."/>:null}
    </CartaoConteudo></Cartao>
    <Cartao><CartaoCabecalho><CartaoTitulo>Privacidade e aceites</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3">
      <h3 className="font-semibold">Conquistas</h3>{data.privacyAwards.map(item=><div key={`${item.id}-${item.geracao}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-linha p-3"><p className="text-sm">Aceite da geração {item.geracao}: {item.aceito?'ativo':'revogado'}</p>{item.aceito?<Botao type="button" disabled={busy} onClick={()=>void executar('consentir-conquista',{conquistaId:item.id,aceitar:false,geracao:item.geracao,termoVersao:item.termoVersao,versaoEsperada:item.consentimentoVersao??0})}>Revogar aceite</Botao>:null}</div>)}
      {paginacao.privacyAwards?.temMais?<Botao type="button" disabled={busy} onClick={()=>void carregarMaisLista('privacyAwards')}>Carregar mais aceites de conquistas</Botao>:null}
      <h3 className="mt-2 font-semibold">Círculos</h3>{data.privacyCircles.map(item=><div key={`${item.id}-${item.geracao}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-linha p-3"><p className="break-all text-sm">Participação {item.estado} · geração {item.geracao}</p>{item.estado==='ativo'?<Botao type="button" variante="perigo" disabled={busy} onClick={()=>void executar('sair-circulo',{circuloId:item.id,versaoEsperada:item.versao??0})}>Sair e ocultar conteúdo</Botao>:null}</div>)}
      {paginacao.privacyCircles?.temMais?<Botao type="button" disabled={busy} onClick={()=>void carregarMaisLista('privacyCircles')}>Carregar mais participações</Botao>:null}
      {!data.privacyAwards.length&&!data.privacyCircles.length?<p className="text-sm text-texto-suave">Não há aceites ou participações para gerenciar.</p>:null}
    </CartaoConteudo></Cartao>
    <p className="text-xs text-texto-suave">Os termos exibidos estão em revisão operacional. O recurso não substitui atendimento individual; mensagens são texto simples e não incluem anexos ou links clicáveis.</p>
  </div>;
}
