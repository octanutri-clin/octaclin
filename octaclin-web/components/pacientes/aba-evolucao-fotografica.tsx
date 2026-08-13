'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Camera, ExternalLink, ShieldCheck, ShieldOff, UploadCloud } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { listarConsentimentosFotograficos, registrarConsentimentoFotografico, revogarConsentimentoFotografico, type ConsentimentoFotograficoApi } from '@/lib/consentimentos-fotograficos-api';
import { confirmarUploadEvolucaoFotografica, listarEvolucoesFotograficas, obterAcessoEvolucaoFotografica, solicitarEvolucaoFotografica, type EvolucaoFotograficaApi } from '@/lib/evolucoes-fotograficas-api';

function formatarData(valor: string) {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

interface AbaEvolucaoFotograficaProps { pacienteId: string; podeGerenciar: boolean; }

export function AbaEvolucaoFotografica({ pacienteId, podeGerenciar }: AbaEvolucaoFotograficaProps) {
  const [itens, setItens] = useState<ConsentimentoFotograficoApi[]>([]);
  const [evolucoes, setEvolucoes] = useState<EvolucaoFotograficaApi[]>([]);
  const [versao, setVersao] = useState('foto-v1');
  const [retencaoAte, setRetencaoAte] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [paraRevogar, setParaRevogar] = useState<ConsentimentoFotograficoApi | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [consentimentoId, setConsentimentoId] = useState('');
  const [protocolo, setProtocolo] = useState('Frente, lateral e costas');
  const [capturadaEm, setCapturadaEm] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [consentimentos, series] = await Promise.all([listarConsentimentosFotograficos(pacienteId), listarEvolucoesFotograficas(pacienteId)]);
      setItens(consentimentos); setEvolucoes(series);
    }
    catch (erroAtual) { setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar consentimentos.'); }
    finally { setCarregando(false); }
  }, [pacienteId]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null); setSucesso(null); setSalvando(true);
    try {
      await registrarConsentimentoFotografico(pacienteId, { versao: versao.trim(), retencaoAte, evidencia: evidencia.trim() || undefined });
      setEvidencia('');
      setSucesso('Consentimento fotografico registrado. A captura permanece indisponivel ate a proxima entrega segura.');
      await carregar();
    } catch (erroAtual) { setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar consentimento.'); }
    finally { setSalvando(false); }
  }

  async function confirmarRevogacao() {
    if (!paraRevogar) return;
    setErro(null); setSucesso(null); setSalvando(true);
    try {
      await revogarConsentimentoFotografico(pacienteId, paraRevogar.id);
      setParaRevogar(null);
      setSucesso('Consentimento revogado. Nenhuma nova captura pode ser vinculada a ele.');
      await carregar();
    } catch (erroAtual) { setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao revogar consentimento.'); }
    finally { setSalvando(false); }
  }

  async function enviarFoto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!arquivo) { setErro('Selecione uma imagem para a evolucao fotografica.'); return; }
    setEnviandoFoto(true); setErro(null); setSucesso(null);
    try {
      const solicitacao = await solicitarEvolucaoFotografica(pacienteId, {
        consentimentoId, protocolo: protocolo.trim(), capturadaEm, observacoes: observacoes.trim() || undefined,
        mimeType: arquivo.type, tamanhoBytes: arquivo.size, nomeArquivo: arquivo.name
      });
      const envio = await fetch(solicitacao.upload.uploadUrl, { method: 'PUT', headers: solicitacao.upload.uploadHeaders, body: arquivo });
      if (!envio.ok) throw new Error('O armazenamento recusou a imagem. Tente novamente.');
      await confirmarUploadEvolucaoFotografica(solicitacao.upload.arquivo.id);
      setArquivo(null); setObservacoes(''); evento.currentTarget.reset();
      setSucesso('Imagem confirmada e vinculada a serie fotografica com consentimento ativo.');
      await carregar();
    } catch (erroAtual) { setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao enviar imagem.'); }
    finally { setEnviandoFoto(false); }
  }

  async function abrirImagem(arquivoId: string) {
    const aba = window.open('', '_blank'); setErro(null);
    try {
      const acesso = await obterAcessoEvolucaoFotografica(arquivoId);
      if (aba) { aba.opener = null; aba.location.href = acesso.url; } else window.location.assign(acesso.url);
    } catch (erroAtual) { aba?.close(); setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao abrir imagem.'); }
  }

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando consentimentos fotograficos" />;

  const consentimentosAtivos = itens.filter((item) => item.ativo && item.retencaoAte >= new Date().toISOString().slice(0, 10));
  return <section className="grid gap-4">
    <div className="flex items-start gap-3 rounded-md border border-linha bg-white p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria"><Camera size={19} /></div><div><h2 className="text-base font-semibold text-tinta">Evolucao fotografica</h2><p className="mt-1 text-sm text-texto-suave">O consentimento e obrigatorio e revogavel. Imagens ficam privadas e so podem ser vinculadas com consentimento ativo.</p></div></div>
    {erro ? <AlertaOperacional mensagem={erro} /> : null}
    {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
    {podeGerenciar ? <form onSubmit={registrar} className="grid gap-3 rounded-md border border-linha bg-white p-4"><div><h3 className="text-sm font-semibold text-tinta">Registrar consentimento</h3><p className="mt-1 text-sm text-texto-suave">Registre a versao aceita e o prazo de retencao antes de qualquer captura futura.</p></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><Rotulo htmlFor="foto-versao">Versao do consentimento</Rotulo><Campo id="foto-versao" value={versao} onChange={(evento) => setVersao(evento.target.value)} maxLength={40} required /></div><div className="grid gap-1"><Rotulo htmlFor="foto-retencao">Retencao ate</Rotulo><Campo id="foto-retencao" type="date" value={retencaoAte} onChange={(evento) => setRetencaoAte(evento.target.value)} required /></div></div><div className="grid gap-1"><Rotulo htmlFor="foto-evidencia">Evidencia do aceite</Rotulo><AreaTexto id="foto-evidencia" value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} maxLength={4000} /></div><div className="flex justify-end"><Botao type="submit" variante="primario" carregando={salvando}><ShieldCheck size={16} />Registrar consentimento</Botao></div></form> : null}
    {podeGerenciar ? <form onSubmit={enviarFoto} className="grid gap-3 rounded-md border border-linha bg-white p-4"><div><h3 className="text-sm font-semibold text-tinta">Adicionar imagem clinica</h3><p className="mt-1 text-sm text-texto-suave">A imagem fica privada. O envio e confirmado somente se o consentimento ainda estiver ativo.</p></div>{consentimentosAtivos.length ? <><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><Rotulo htmlFor="foto-consentimento">Consentimento ativo</Rotulo><select id="foto-consentimento" className="h-10 rounded-md border border-linha bg-white px-3 text-sm" value={consentimentoId} onChange={(evento) => setConsentimentoId(evento.target.value)} required><option value="">Selecione</option>{consentimentosAtivos.map((item) => <option key={item.id} value={item.id}>{item.versao} · ate {formatarData(item.retencaoAte)}</option>)}</select></div><div className="grid gap-1"><Rotulo htmlFor="foto-data">Data da captura</Rotulo><Campo id="foto-data" type="date" value={capturadaEm} onChange={(evento) => setCapturadaEm(evento.target.value)} required /></div></div><div className="grid gap-1"><Rotulo htmlFor="foto-protocolo">Protocolo</Rotulo><Campo id="foto-protocolo" value={protocolo} onChange={(evento) => setProtocolo(evento.target.value)} maxLength={500} required /></div><div className="grid gap-1"><Rotulo htmlFor="foto-arquivo">Imagem</Rotulo><Campo id="foto-arquivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(evento) => setArquivo(evento.target.files?.[0] ?? null)} required /></div><div className="grid gap-1"><Rotulo htmlFor="foto-observacoes">Observacoes</Rotulo><AreaTexto id="foto-observacoes" value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} maxLength={4000} /></div><div className="flex justify-end"><Botao type="submit" variante="primario" carregando={enviandoFoto} disabled={!arquivo || !consentimentoId}><UploadCloud size={16} />Enviar imagem</Botao></div></> : <EstadoVazio titulo="Consentimento ativo necessario" descricao="Registre ou renove um consentimento dentro do prazo de retencao antes de enviar imagens." />}</form> : null}
    <div className="grid gap-3"><h3 className="text-sm font-semibold text-tinta">Historico de consentimentos</h3>{itens.length ? itens.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-linha bg-white p-4"><div><p className="text-sm font-semibold text-tinta">{item.versao}</p><p className="mt-1 text-sm text-texto-suave">Registrado em {formatarData(item.consentidoEm)} · Retencao ate {formatarData(item.retencaoAte)}</p><p className="mt-1 text-xs font-medium text-texto-suave">{item.ativo ? 'Ativo' : `Revogado em ${item.revogadoEm ? formatarData(item.revogadoEm) : '-'}`}</p></div>{item.ativo && podeGerenciar ? <Botao type="button" variante="perigo" tamanho="sm" onClick={() => setParaRevogar(item)}><ShieldOff size={15} />Revogar</Botao> : null}</article>) : <EstadoVazio titulo="Nenhum consentimento registrado" descricao="A captura permanece indisponivel ate que um consentimento ativo exista e o vinculo seguro de arquivo seja entregue." />}</div>
    <div className="grid gap-3"><h3 className="text-sm font-semibold text-tinta">Series fotograficas</h3>{evolucoes.length ? evolucoes.map((item) => <article key={item.id} className="rounded-md border border-linha bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-tinta">{formatarData(item.capturadaEm)}</p><p className="mt-1 text-sm text-texto-suave">{item.protocolo}</p>{item.observacoes ? <p className="mt-2 text-sm text-texto-suave">{item.observacoes}</p> : null}</div><span className="text-xs font-medium text-texto-suave">{item.arquivos.length} imagem(ns)</span></div>{item.arquivos.length ? <div className="mt-3 flex flex-wrap gap-2">{item.arquivos.map((imagem) => <Botao key={imagem.id} type="button" tamanho="sm" variante="secundario" onClick={() => void abrirImagem(imagem.id)}><ExternalLink size={15} />{imagem.nomeArquivo || 'Abrir imagem'}</Botao>)}</div> : <p className="mt-3 text-sm text-texto-suave">Envio pendente ou imagem nao confirmada.</p>}</article>) : <EstadoVazio titulo="Nenhuma imagem clinica confirmada" descricao="As series confirmadas aparecerao aqui; imagens nao sao exibidas no portal do paciente." />}</div>
    <ModalConfirmacao aberto={Boolean(paraRevogar)} titulo="Revogar consentimento fotografico" mensagem="A revogacao impede novas capturas vinculadas a este consentimento. O historico sera preservado." rotuloConfirmar="Revogar consentimento" confirmando={salvando} aoCancelar={() => setParaRevogar(null)} aoConfirmar={() => void confirmarRevogacao()} />
  </section>;
}
