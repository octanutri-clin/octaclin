'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Camera, ShieldCheck, ShieldOff } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { listarConsentimentosFotograficos, registrarConsentimentoFotografico, revogarConsentimentoFotografico, type ConsentimentoFotograficoApi } from '@/lib/consentimentos-fotograficos-api';

function formatarData(valor: string) {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

interface AbaEvolucaoFotograficaProps { pacienteId: string; podeGerenciar: boolean; }

export function AbaEvolucaoFotografica({ pacienteId, podeGerenciar }: AbaEvolucaoFotograficaProps) {
  const [itens, setItens] = useState<ConsentimentoFotograficoApi[]>([]);
  const [versao, setVersao] = useState('foto-v1');
  const [retencaoAte, setRetencaoAte] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [paraRevogar, setParaRevogar] = useState<ConsentimentoFotograficoApi | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setItens(await listarConsentimentosFotograficos(pacienteId)); }
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

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando consentimentos fotograficos" />;

  return <section className="grid gap-4">
    <div className="flex items-start gap-3 rounded-md border border-linha bg-white p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria"><Camera size={19} /></div><div><h2 className="text-base font-semibold text-tinta">Evolucao fotografica</h2><p className="mt-1 text-sm text-texto-suave">O consentimento e obrigatorio e revogavel. A captura de imagens ainda nao esta liberada.</p></div></div>
    {erro ? <AlertaOperacional mensagem={erro} /> : null}
    {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
    {podeGerenciar ? <form onSubmit={registrar} className="grid gap-3 rounded-md border border-linha bg-white p-4"><div><h3 className="text-sm font-semibold text-tinta">Registrar consentimento</h3><p className="mt-1 text-sm text-texto-suave">Registre a versao aceita e o prazo de retencao antes de qualquer captura futura.</p></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><Rotulo htmlFor="foto-versao">Versao do consentimento</Rotulo><Campo id="foto-versao" value={versao} onChange={(evento) => setVersao(evento.target.value)} maxLength={40} required /></div><div className="grid gap-1"><Rotulo htmlFor="foto-retencao">Retencao ate</Rotulo><Campo id="foto-retencao" type="date" value={retencaoAte} onChange={(evento) => setRetencaoAte(evento.target.value)} required /></div></div><div className="grid gap-1"><Rotulo htmlFor="foto-evidencia">Evidencia do aceite</Rotulo><AreaTexto id="foto-evidencia" value={evidencia} onChange={(evento) => setEvidencia(evento.target.value)} maxLength={4000} /></div><div className="flex justify-end"><Botao type="submit" variante="primario" carregando={salvando}><ShieldCheck size={16} />Registrar consentimento</Botao></div></form> : null}
    <div className="grid gap-3"><h3 className="text-sm font-semibold text-tinta">Historico de consentimentos</h3>{itens.length ? itens.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-linha bg-white p-4"><div><p className="text-sm font-semibold text-tinta">{item.versao}</p><p className="mt-1 text-sm text-texto-suave">Registrado em {formatarData(item.consentidoEm)} · Retencao ate {formatarData(item.retencaoAte)}</p><p className="mt-1 text-xs font-medium text-texto-suave">{item.ativo ? 'Ativo' : `Revogado em ${item.revogadoEm ? formatarData(item.revogadoEm) : '-'}`}</p></div>{item.ativo && podeGerenciar ? <Botao type="button" variante="perigo" tamanho="sm" onClick={() => setParaRevogar(item)}><ShieldOff size={15} />Revogar</Botao> : null}</article>) : <EstadoVazio titulo="Nenhum consentimento registrado" descricao="A captura permanece indisponivel ate que um consentimento ativo exista e o vinculo seguro de arquivo seja entregue." />}</div>
    <ModalConfirmacao aberto={Boolean(paraRevogar)} titulo="Revogar consentimento fotografico" mensagem="A revogacao impede novas capturas vinculadas a este consentimento. O historico sera preservado." rotuloConfirmar="Revogar consentimento" confirmando={salvando} aoCancelar={() => setParaRevogar(null)} aoConfirmar={() => void confirmarRevogacao()} />
  </section>;
}
