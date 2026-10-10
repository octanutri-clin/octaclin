'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { usePortalPaciente } from './portal-contexto';
import { GraficoGestacional } from '../pacientes/grafico-gestacional';
import { solicitarGestacao, type ConviteGestacaoApi, type PaginaGestacoesApi, type DetalheGestacaoPortalApi } from '@/lib/gestacoes-paciente-api';
const base = '/api/portal/paciente/gestacoes';
export function AcompanhamentoGestacionalPortal() {
  const { portal } = usePortalPaciente();
  return portal ? <ConteudoGestacional key={portal.paciente.id}/> : null;
}
function ConteudoGestacional() {
  const [itens,setItens] = useState<ConviteGestacaoApi[]>([]),[cursor,setCursor] = useState<string|null>(null);
  const [detalhe,setDetalhe] = useState<DetalheGestacaoPortalApi|null>(null),[erro,setErro] = useState(''),[ocupado,setOcupado] = useState(false);
  const vivo = useRef(false),geracao = useRef(0);
  const carregar = useCallback(async (mais?: string) => {
    const atual = geracao.current;
    const dados = await solicitarGestacao<PaginaGestacoesApi<ConviteGestacaoApi>>(`${base}${mais ? '?cursor='+encodeURIComponent(mais) : ''}`);
    if (!vivo.current || atual !== geracao.current) return;
    setItens(anteriores => mais ? [...anteriores,...dados.itens] : dados.itens);setCursor(dados.proximoCursor);
  },[]);
  useEffect(() => {
    vivo.current = true;
    const invalidar = () => {geracao.current++;};
    const foco = () => {geracao.current++;setDetalhe(null);setItens([]);void carregar().catch(() => {if (vivo.current) setErro('Não foi possível atualizar o acompanhamento.');});};
    foco();window.addEventListener('focus',foco);
    return () => {vivo.current = false;invalidar();window.removeEventListener('focus',foco);};
  },[carregar]);
  async function abrir(g: ConviteGestacaoApi,mais?: string) {
    const atual = ++geracao.current;setErro('');setOcupado(true);if (!mais) setDetalhe(null);
    try {
      const d = await solicitarGestacao<DetalheGestacaoPortalApi>(`${base}/${encodeURIComponent(g.id)}${mais ? '?cursor='+encodeURIComponent(mais) : ''}`);
      if (vivo.current && atual === geracao.current) setDetalhe(a => mais && a ? { ...d,avaliacoes: [...a.avaliacoes,...d.avaliacoes],seriesReferencia: [...a.seriesReferencia,...d.seriesReferencia.filter(s => !a.seriesReferencia.some(anterior => anterior.numero === s.numero))] } : d);
    } catch {if (vivo.current && atual === geracao.current) {setDetalhe(null);setErro('O acompanhamento está indisponível ou deixou de estar autorizado.');}}
    finally {if (vivo.current && atual === geracao.current) setOcupado(false);}
  }
  async function consentir(g: ConviteGestacaoApi,aceitar: boolean) {
    if (!window.confirm(aceitar ? g.termo : 'Revogar seu aceite e ocultar todo o acompanhamento desta gestação?')) return;
    geracao.current++;setDetalhe(null);setItens([]);setErro('');setOcupado(true);
    try {
      await solicitarGestacao(`${base}/${encodeURIComponent(g.id)}/consentimento`,'PUT',{ confirmar: true,aceitar,geracao: g.geracao,versao: g.consentimentoVersao,termoVersao: g.termoVersao });
      if (vivo.current) await carregar();
    } catch {if (vivo.current) setErro('Não foi possível confirmar a alteração. Atualize antes de tentar novamente.');}
    finally {if (vivo.current) setOcupado(false);}
  }
  if (!itens.length && !erro) return null;
  return <Cartao><CartaoCabecalho><CartaoTitulo>Acompanhamento gestacional</CartaoTitulo></CartaoCabecalho><CartaoConteudo className="grid gap-3">
    {erro ? <p role="alert">{erro}</p> : null}
    {itens.map((g,i) => <div key={g.id} className="grid gap-2"><p>Acompanhamento {i+1}</p>{!g.aceito ? <p>{g.termo}</p> : null}<div className="flex flex-wrap gap-2">{g.aceito ? <><Botao disabled={ocupado} onClick={() => void abrir(g)}>Ver acompanhamento</Botao><Botao disabled={ocupado} onClick={() => void consentir(g,false)}>Revogar aceite</Botao></> : <Botao disabled={ocupado} onClick={() => void consentir(g,true)}>Ler e aceitar</Botao>}</div></div>)}
    <Botao disabled={ocupado} onClick={() => {geracao.current++;setDetalhe(null);void carregar().catch(() => setErro('Não foi possível atualizar.'));}}>Atualizar</Botao>
    {cursor ? <Botao disabled={ocupado} onClick={() => void carregar(cursor).catch(() => setErro('Não foi possível carregar mais.'))}>Mais acompanhamentos</Botao> : null}
    {detalhe ? <><GraficoGestacional key={detalhe.id} avaliacoes={detalhe.avaliacoes} series={detalhe.seriesReferencia} parcial={!!detalhe.proximoCursor}/>{detalhe.proximoCursor ? <Botao disabled={ocupado} onClick={() => {const g = itens.find(x => x.id === detalhe.id);if (g) void abrir(g,detalhe.proximoCursor!);}}>Carregar mais avaliações</Botao> : null}</> : null}
  </CartaoConteudo></Cartao>;
}
