'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, EstadoVazio } from '@/components/ui/feedback';
import type { ConsentimentoFotograficoApi } from '@/lib/consentimentos-fotograficos-api';
import { obterAcessoEvolucaoFotografica, type EvolucaoFotograficaApi } from '@/lib/evolucoes-fotograficas-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';

interface ComparacaoEvolucaoFotograficaProps {
  evolucoes: EvolucaoFotograficaApi[];
  consentimentos: ConsentimentoFotograficoApi[];
}

type SerieComparavel = EvolucaoFotograficaApi & { arquivoId: string };
type GrupoProtocolo = { chave: string; rotulo: string; series: SerieComparavel[] };
type Previa = { anterior: string; posterior: string };

function normalizarProtocolo(valor: string): string {
  return valor.trim().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function formatarData(valor: string): string {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

export function ComparacaoEvolucaoFotografica({ evolucoes, consentimentos }: ComparacaoEvolucaoFotograficaProps) {
  const [chaveProtocolo, setChaveProtocolo] = useState('');
  const [anteriorId, setAnteriorId] = useState('');
  const [posteriorId, setPosteriorId] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const solicitacaoAtual = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grupos = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const consentimentosDentroDoPrazo = new Set(consentimentos
      .filter((item) => item.retencaoAte >= hoje)
      .map((item) => item.id));
    const porProtocolo = new Map<string, GrupoProtocolo>();
    for (const serie of evolucoes) {
      if (!consentimentosDentroDoPrazo.has(serie.consentimentoId) || !serie.arquivos.length) continue;
      const chave = normalizarProtocolo(serie.protocolo);
      if (!chave) continue;
      if (!porProtocolo.has(chave)) porProtocolo.set(chave, { chave, rotulo: serie.protocolo.trim(), series: [] });
      porProtocolo.get(chave)?.series.push({ ...serie, arquivoId: serie.arquivos[0].id });
    }
    return [...porProtocolo.values()]
      .map((grupo) => ({ ...grupo, series: grupo.series.sort((a, b) =>
        a.capturadaEm.localeCompare(b.capturadaEm) || a.id.localeCompare(b.id)
      ) }))
      .filter((grupo) => grupo.series.length > 1 && grupo.series[0].capturadaEm < grupo.series[grupo.series.length - 1].capturadaEm)
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  }, [consentimentos, evolucoes]);

  useEffect(() => () => {
    solicitacaoAtual.current += 1;
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const grupo = grupos.find((item) => item.chave === chaveProtocolo);
  const anterior = grupo?.series.find((item) => item.id === anteriorId);
  const posterior = grupo?.series.find((item) => item.id === posteriorId);
  const selecaoValida = Boolean(anterior && posterior && anterior.capturadaEm < posterior.capturadaEm);

  function limparPrevia() {
    solicitacaoAtual.current += 1;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setPrevia(null);
    setCarregando(false);
    setErro(null);
  }

  async function comparar() {
    if (!anterior || !posterior || !selecaoValida) return;
    limparPrevia();
    const numeroSolicitacao = solicitacaoAtual.current;
    setCarregando(true);
    try {
      const [acessoAnterior, acessoPosterior] = await Promise.all([
        obterAcessoEvolucaoFotografica(anterior.arquivoId),
        obterAcessoEvolucaoFotografica(posterior.arquivoId)
      ]);
      if (numeroSolicitacao !== solicitacaoAtual.current) return;
      setPrevia({ anterior: acessoAnterior.url, posterior: acessoPosterior.url });
      const segundos = Math.min(acessoAnterior.expiraEmSegundos, acessoPosterior.expiraEmSegundos);
      temporizador.current = setTimeout(() => setPrevia(null), Math.max(1000, (segundos - 5) * 1000));
    } catch (erroAtual) {
      if (numeroSolicitacao === solicitacaoAtual.current) {
        setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível abrir as imagens para comparação.'));
      }
    } finally {
      if (numeroSolicitacao === solicitacaoAtual.current) setCarregando(false);
    }
  }

  return <section aria-labelledby="comparacao-fotos-titulo" className="grid gap-4 rounded-md border border-linha bg-white p-4">
    <div>
      <h3 id="comparacao-fotos-titulo" className="text-sm font-semibold text-tinta">Comparar imagens lado a lado</h3>
      <p className="mt-1 text-sm text-texto-suave">Escolha duas capturas de datas diferentes e do mesmo protocolo. A comparação é visual e depende da avaliação profissional.</p>
    </div>
    {!grupos.length ? <EstadoVazio titulo="Sem par comparável" descricao="São necessárias duas imagens confirmadas, de datas diferentes, com o mesmo protocolo e dentro do prazo de retenção." /> : <>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1"><Rotulo htmlFor="comparacao-protocolo">Protocolo</Rotulo>
          <select id="comparacao-protocolo" className="h-10 rounded-md border border-linha bg-white px-3 text-sm" value={chaveProtocolo} onChange={(evento) => { limparPrevia(); setChaveProtocolo(evento.target.value); setAnteriorId(''); setPosteriorId(''); }}>
            <option value="">Selecione</option>{grupos.map((item) => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
          </select>
        </div>
        <div className="grid gap-1"><Rotulo htmlFor="comparacao-anterior">Antes</Rotulo>
          <select id="comparacao-anterior" className="h-10 rounded-md border border-linha bg-white px-3 text-sm" value={anteriorId} disabled={!grupo} onChange={(evento) => { limparPrevia(); setAnteriorId(evento.target.value); }}>
            <option value="">Selecione a captura</option>{grupo?.series.map((item) => <option key={item.id} value={item.id}>{formatarData(item.capturadaEm)}</option>)}
          </select>
        </div>
        <div className="grid gap-1"><Rotulo htmlFor="comparacao-posterior">Depois</Rotulo>
          <select id="comparacao-posterior" className="h-10 rounded-md border border-linha bg-white px-3 text-sm" value={posteriorId} disabled={!grupo} onChange={(evento) => { limparPrevia(); setPosteriorId(evento.target.value); }}>
            <option value="">Selecione a captura</option>{grupo?.series.map((item) => <option key={item.id} value={item.id}>{formatarData(item.capturadaEm)}</option>)}
          </select>
        </div>
      </div>
      {anteriorId && posteriorId && !selecaoValida ? <p className="text-sm text-texto-suave">A captura “Antes” deve ter data anterior à captura “Depois”.</p> : null}
      <div><Botao type="button" variante="secundario" disabled={!selecaoValida || carregando} carregando={carregando} onClick={() => void comparar()}>Comparar imagens</Botao></div>
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {previa && anterior && posterior ? <div className="grid gap-4 md:grid-cols-2" aria-label="Comparação fotográfica">
        <figure className="min-w-0 rounded-md border border-linha bg-fundo p-3"><figcaption className="mb-2 text-sm font-semibold text-tinta">Antes · {formatarData(anterior.capturadaEm)}</figcaption>
          {/* A URL assinada só existe durante a prévia, sem persistência local. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previa.anterior} alt={`Captura anterior do protocolo ${grupo?.rotulo ?? ''}`} referrerPolicy="no-referrer" className="h-72 w-full object-contain md:h-[28rem]" onError={() => { limparPrevia(); setErro('A imagem anterior não pôde ser carregada. Solicite a comparação novamente.'); }} />
        </figure>
        <figure className="min-w-0 rounded-md border border-linha bg-fundo p-3"><figcaption className="mb-2 text-sm font-semibold text-tinta">Depois · {formatarData(posterior.capturadaEm)}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previa.posterior} alt={`Captura posterior do protocolo ${grupo?.rotulo ?? ''}`} referrerPolicy="no-referrer" className="h-72 w-full object-contain md:h-[28rem]" onError={() => { limparPrevia(); setErro('A imagem posterior não pôde ser carregada. Solicite a comparação novamente.'); }} />
        </figure>
      </div> : null}
      {previa ? <p className="text-xs text-texto-suave">A prévia temporária expira em até cinco minutos. Se necessário, solicite outra comparação.</p> : null}
    </>}
  </section>;
}
