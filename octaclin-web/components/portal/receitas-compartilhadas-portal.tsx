'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Botao } from '@/components/ui/botao';
import { Aviso } from '@/components/ui/feedback';
import { usePortalPaciente } from '@/components/portal/portal-contexto';
import {
  atualizarConsentimentoReceitasPortal,
  listarReceitasCompartilhadasPortal,
  obterChavePublicaPushReceitasPortal,
  obterConsentimentoReceitasPortal,
  obterReceitaCompartilhadaPortal,
  registrarPushReceitasPortal,
  revogarPushReceitasPortal,
  type ConsentimentoReceitaApi,
  type ReceitaCompartilhadaPortalApi
} from '@/lib/plano-alimentar-api';

function base64ParaBytes(valor: string): Uint8Array<ArrayBuffer> {
  const normalizado = valor.replace(/-/g, '+').replace(/_/g, '/');
  const binario = window.atob(normalizado.padEnd(normalizado.length + ((4 - normalizado.length % 4) % 4), '='));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let indice = 0; indice < binario.length; indice += 1) bytes[indice] = binario.charCodeAt(indice);
  return bytes;
}

export function ReceitasCompartilhadasPortal() {
  const { portal, carregando: carregandoPortal } = usePortalPaciente();
  const [receitas, setReceitas] = useState<ReceitaCompartilhadaPortalApi[]>([]);
  const [consentimento, setConsentimento] = useState<ConsentimentoReceitaApi>({ email: false, whatsapp: false, push: false });
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Awaited<ReturnType<typeof obterReceitaCompartilhadaPortal>> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [lista, preferencias] = await Promise.all([listarReceitasCompartilhadasPortal(), obterConsentimentoReceitasPortal()]);
      setReceitas(lista);
      setConsentimento(preferencias);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as receitas.');
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  async function abrir(id: string) {
    setOcupado(true); setErro(null); setAviso(null);
    try {
      const resultado = await obterReceitaCompartilhadaPortal(id);
      setSelecionada(id); setDetalhe(resultado);
      setReceitas((atuais) => atuais.map((item) => item.id === id ? { ...item, visualizadoEm: new Date().toISOString() } : item));
    } catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir esta receita.'); }
    finally { setOcupado(false); }
  }

  async function salvarConsentimento(canal: keyof ConsentimentoReceitaApi, ativo: boolean) {
    if (canal === 'push') {
      if (!ativo) {
        const registro = await navigator.serviceWorker?.getRegistration();
        const subscription = await registro?.pushManager.getSubscription();
        if (subscription) { await revogarPushReceitasPortal(subscription.endpoint); await subscription.unsubscribe(); }
        const atualizado = await atualizarConsentimentoReceitasPortal({ ...consentimento, push: false });
        setConsentimento(atualizado); setAviso('Avisos push de receitas desativados.');
        return;
      }
      const capability = await obterChavePublicaPushReceitasPortal();
      if (!capability.chavePublica || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Avisos push não estão disponíveis neste dispositivo.');
      }
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') throw new Error('Permissão de notificações não concedida.');
      const registro = await navigator.serviceWorker.ready;
      const subscription = await registro.pushManager.getSubscription() ?? await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(capability.chavePublica) });
      const atualizado = await atualizarConsentimentoReceitasPortal({ ...consentimento, push: true });
      try { await registrarPushReceitasPortal(portal!.paciente.id, subscription); }
      catch (falha) { await atualizarConsentimentoReceitasPortal({ ...atualizado, push: false }); await subscription.unsubscribe(); throw falha; }
      setConsentimento(atualizado); setAviso('Avisos push de receitas ativados.');
      return;
    }
    const atualizado = await atualizarConsentimentoReceitasPortal({ ...consentimento, [canal]: ativo });
    setConsentimento(atualizado);
    setAviso(ativo ? 'Consentimento registrado para este canal.' : 'Consentimento revogado para este canal.');
  }

  async function alterar(canal: keyof ConsentimentoReceitaApi, ativo: boolean) {
    setOcupado(true); setErro(null); setAviso(null);
    try { await salvarConsentimento(canal, ativo); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : 'Não foi possível atualizar sua preferência.'); }
    finally { setOcupado(false); }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 p-4 sm:p-6">
      <Cartao>
        <CartaoCabecalho><CartaoTitulo icone={<BookOpenCheck className="h-5 w-5" />}>Receitas compartilhadas</CartaoTitulo></CartaoCabecalho>
        <CartaoConteudo className="grid gap-4">
          <p className="text-sm text-texto-suave">Receitas enviadas pela sua equipe ficam disponíveis apenas nesta área autenticada.</p>
          {erro ? <Aviso variante="erro" mensagem={erro} /> : null}
          {aviso ? <Aviso variante="sucesso" mensagem={aviso} /> : null}
          {carregando || carregandoPortal ? <p role="status">Carregando receitas...</p> : receitas.length ? receitas.map((receita) => (
            <article key={receita.id} className="rounded-md border border-linha p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-semibold">{receita.nome}</h2><p className="text-sm text-texto-suave">Enviada em {receita.enviadoEm ? new Date(receita.enviadoEm).toLocaleString('pt-BR') : 'data não informada'}</p></div>
                <Botao type="button" variante="secundario" onClick={() => selecionada === receita.id ? (setSelecionada(null), setDetalhe(null)) : void abrir(receita.id)} disabled={ocupado} aria-expanded={selecionada === receita.id}>
                  {selecionada === receita.id ? <><ChevronUp size={16} /> Fechar</> : <><ChevronDown size={16} /> Abrir receita</>}
                </Botao>
              </div>
              {selecionada === receita.id && detalhe?.id === receita.id ? <div className="mt-4 grid gap-3 border-t border-linha pt-3">
                {detalhe.receita.conteudo.instrucoes ? <p className="whitespace-pre-wrap text-sm">{detalhe.receita.conteudo.instrucoes}</p> : null}
                <ul className="grid gap-2">{detalhe.receita.conteudo.itens.map((item, indice) => <li key={`${indice}-${item.descricao ?? item.alimentoComposicaoId ?? 'item'}`} className="rounded bg-superficie p-3 text-sm">{item.descricao ?? 'Alimento'} · {item.quantidade} {item.unidade}</li>)}</ul>
              </div> : null}
            </article>
          )) : <p className="rounded-md border border-linha p-4 text-sm">Nenhuma receita foi compartilhada com você.</p>}
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho><CartaoTitulo icone={<Bell className="h-5 w-5" />}>Avisos sobre novas receitas</CartaoTitulo></CartaoCabecalho>
        <CartaoConteudo className="grid gap-3">
          <p className="text-sm text-texto-suave">Os avisos externos só informam que há uma receita no portal. O conteúdo sempre fica protegido aqui.</p>
          {(['email', 'whatsapp'] as const).map((canal) => <label key={canal} className="flex items-center gap-3 rounded border border-linha p-3 text-sm">
            <input type="checkbox" checked={consentimento[canal]} disabled={ocupado} onChange={(evento) => void alterar(canal, evento.target.checked)} />
            Receber avisos por {canal === 'email' ? 'e-mail' : 'WhatsApp'}
          </label>)}
          <label className="flex items-center gap-3 rounded border border-linha p-3 text-sm">
            <input type="checkbox" checked={consentimento.push} disabled={ocupado} onChange={(evento) => void alterar('push', evento.target.checked)} />
            Receber avisos push neste dispositivo
          </label>
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
