'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { solicitarGestacao, urlGestacoes, type DetalheGestacaoApi, type GestacaoApi, type PaginaGestacoesApi, type ReferenciaGestacaoApi } from '@/lib/gestacoes-paciente-api';
import { FormularioReferenciaGestacao } from './formulario-gestacao';
import { GraficoGestacional } from './grafico-gestacional';
export function GestacoesPaciente({ pacienteId,podeGerenciar }: { pacienteId: string; podeGerenciar: boolean }) {
  const [itens,setItens] = useState<GestacaoApi[]>([]),[cursor,setCursor] = useState<string|null>(null);
  const [id,setId] = useState(''),[detalhe,setDetalhe] = useState<DetalheGestacaoApi|null>(null);
  const [nova,setNova] = useState(false),[erro,setErro] = useState(''),[ocupado,setOcupado] = useState(false);
  const montado = useRef(false),selecao = useRef(0),chave = useRef<{ body: string; id: string }|null>(null);
  const base = urlGestacoes(pacienteId);
  const carregar = useCallback(async (mais?: string) => {
    const r = await solicitarGestacao<PaginaGestacoesApi<GestacaoApi>>(`${base}${mais ? '?cursor='+encodeURIComponent(mais) : ''}`);
    if (!montado.current) return;
    setItens(anterior => mais ? [...anterior,...r.itens] : r.itens);setCursor(r.proximoCursor);
  },[base]);
  useEffect(() => { montado.current = true;void carregar().catch(() => {if (montado.current) setErro('Não foi possível carregar as gestações.');});return () => {montado.current = false;selecao.current++;}; },[carregar]);
  async function abrir(escolha: string,mais?: string) {
    const request = ++selecao.current;setId(escolha);setErro('');if (!mais) setDetalhe(null);
    if (!escolha) return;
    setOcupado(true);
    try {
      const d = await solicitarGestacao<DetalheGestacaoApi>(`${base}/${encodeURIComponent(escolha)}${mais ? '?cursor='+encodeURIComponent(mais) : ''}`);
      if (montado.current && request === selecao.current) setDetalhe(anterior => mais && anterior ? { ...d,avaliacoes: [...anterior.avaliacoes,...d.avaliacoes],seriesReferencia: [...anterior.seriesReferencia,...d.seriesReferencia.filter(s => !anterior.seriesReferencia.some(a => a.numero === s.numero))] } : d);
    } catch (e) {if (montado.current && request === selecao.current) {setDetalhe(null);setErro(e instanceof Error ? e.message : 'Não foi possível abrir a gestação.');}}
    finally {if (montado.current && request === selecao.current) setOcupado(false);}
  }
  async function executar(acao: 'criar'|'referencias'|'encerrar'|'reabrir'|'compartilhamento',referencia?: ReferenciaGestacaoApi) {
    const selecionada = detalhe;
    if (acao !== 'criar' && !selecionada) return;
    const mensagem = acao === 'compartilhamento' ? selecionada?.compartilhada ? 'Retirar todo o acompanhamento gestacional do portal?' : 'Liberar todas as avaliações atuais e futuras desta gestação no portal? O paciente também precisará aceitar o termo. Notas internas não serão incluídas.' : acao === 'referencias' ? 'Criar uma nova versão desta referência para as próximas avaliações? O histórico será preservado.' : acao === 'encerrar' ? 'Encerrar esta gestação? Novos registros ficam bloqueados; o histórico e o compartilhamento autorizado permanecem.' : acao === 'reabrir' ? 'Reabrir esta gestação para novos registros?' : 'Abrir esta gestação com a referência informada?';
    if (!window.confirm(mensagem)) return;
    setOcupado(true);setErro('');
    try {
      let d: GestacaoApi;
      if (acao === 'criar') {
        const body = JSON.stringify(referencia);
        if (!chave.current || chave.current.body !== body) chave.current = { body,id: crypto.randomUUID() };
        d = await solicitarGestacao<GestacaoApi>(base,'POST',{ confirmar: true,chaveCriacao: chave.current.id,referencia });
        if (!montado.current) return;
        chave.current = null;setNova(false);
      } else {
        d = await solicitarGestacao<GestacaoApi>(`${base}/${encodeURIComponent(selecionada!.id)}/${acao}`,acao === 'compartilhamento' ? 'PUT' : 'POST',{ confirmar: true,versao: selecionada!.versao,...(referencia ? { referencia } : {}),...(acao === 'compartilhamento' ? { compartilhada: !selecionada!.compartilhada } : {}) });
        if (!montado.current) return;
      }
      await carregar();if (montado.current) await abrir(d.id);
    } catch (e) {if (montado.current) setErro(e instanceof Error ? e.message : 'Não foi possível concluir. Atualize e confira antes de tentar novamente.');}
    finally {if (montado.current) setOcupado(false);}
  }
  return <Cartao><CartaoCabecalho><CartaoTitulo>Acompanhamento gestacional</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-4">
    {erro ? <p role="alert">{erro}</p> : null}
    <div className="flex flex-wrap gap-2"><label className="min-w-60 flex-1">Gestação<Selecao disabled={ocupado} value={id} onChange={e => {setNova(false);void abrir(e.target.value);}}><option value="">Selecione uma gestação</option>{itens.map((g,i) => <option key={g.id} value={g.id}>Gestação {i+1} — {g.status} — {g.criadoEm.slice(0,10)}</option>)}</Selecao></label>
      {podeGerenciar ? <Botao disabled={ocupado} onClick={() => {selecao.current++;setDetalhe(null);setId('');setNova(true);}}>Abrir gestação</Botao> : null}
      <Botao disabled={ocupado} onClick={() => void carregar().catch(() => setErro('Não foi possível atualizar.'))}>Atualizar</Botao>
      {cursor ? <Botao disabled={ocupado} onClick={() => void carregar(cursor).catch(() => setErro('Não foi possível carregar mais.'))}>Mais gestações</Botao> : null}
    </div>
    {!itens.length && !nova ? <p>Nenhuma gestação registrada. Os registros antigos não são vinculados automaticamente.</p> : null}
    {nova ? <FormularioReferenciaGestacao key="nova" ocupado={ocupado} salvar={r => void executar('criar',r)}/> : null}
    {detalhe ? <>
      <p>Gestação {detalhe.status}. Referência atual: versão {detalhe.numero}. Portal: {detalhe.compartilhada ? 'liberado, sujeito ao aceite do paciente' : 'não liberado'}.</p>
      {podeGerenciar ? <div className="flex flex-wrap gap-2"><Botao disabled={ocupado} onClick={() => void executar(detalhe.status === 'ativa' ? 'encerrar' : 'reabrir')}>{detalhe.status === 'ativa' ? 'Encerrar gestação' : 'Reabrir gestação'}</Botao><Botao disabled={ocupado} onClick={() => void executar('compartilhamento')}>{detalhe.compartilhada ? 'Retirar do portal' : 'Liberar no portal'}</Botao></div> : null}
      {podeGerenciar && detalhe.status === 'ativa' ? <details><summary>Corrigir peso/altura: criar referência nova</summary><FormularioReferenciaGestacao key={`${detalhe.id}:${detalhe.numero}`} inicial={detalhe.referencia} ocupado={ocupado} salvar={r => void executar('referencias',r)}/></details> : null}
      <GraficoGestacional key={detalhe.id} avaliacoes={detalhe.avaliacoes} series={detalhe.seriesReferencia} parcial={!!detalhe.proximoCursor}/>
      {detalhe.proximoCursor ? <Botao disabled={ocupado} onClick={() => void abrir(detalhe.id,detalhe.proximoCursor!)}>Carregar mais avaliações</Botao> : null}
    </> : null}
  </CartaoConteudo></Cartao>;
}
