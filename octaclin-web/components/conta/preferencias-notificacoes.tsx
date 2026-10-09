'use client';

import { useEffect, useState } from 'react';
import {
  obterPreferenciasNotificacoes,
  salvarPreferenciasNotificacoes,
  type ModoEntregaNotificacaoApi,
  type PreferenciasNotificacaoApi
} from '@/lib/notificacoes-api';

const tipos = [
  ['formulario_respondido', 'Formulários respondidos'],
  ['tarefa_concluida', 'Tarefas concluídas'],
  ['automacao_executada', 'Automações executadas']
] as const;
const modos: Array<{ valor: ModoEntregaNotificacaoApi; rotulo: string }> = [
  { valor: 'imediato', rotulo: 'Imediato' },
  { valor: 'diario', rotulo: 'Resumo diário' },
  { valor: 'semanal', rotulo: 'Resumo semanal' },
  { valor: 'silenciado', rotulo: 'Silenciado' }
];

export function PreferenciasNotificacoes() {
  const [preferencias, setPreferencias] = useState<PreferenciasNotificacaoApi | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [tentativaLeitura, setTentativaLeitura] = useState(0);

  useEffect(() => {
    let ativo = true;
    obterPreferenciasNotificacoes().then((resultado) => { if (ativo) { setPreferencias(resultado); setErro(''); } })
      .catch(() => { if (ativo) setErro('Não foi possível carregar suas preferências. Tente novamente.'); });
    return () => { ativo = false; };
  }, [tentativaLeitura]);

  if (!preferencias) return <div className="space-y-2">
    <p role={erro ? 'alert' : 'status'} className="text-sm text-tinta-suave">{erro || 'Carregando preferências…'}</p>
    {erro ? <button type="button" className="text-sm text-primaria underline" onClick={() => { setErro(''); setTentativaLeitura((atual) => atual + 1); }}>Tentar novamente</button> : null}
  </div>;
  const elegiveis = new Set(preferencias.classesElegiveis);
  const alterarModo = (tipo: keyof PreferenciasNotificacaoApi['modos'], valor: ModoEntregaNotificacaoApi) => {
    setPreferencias((atual) => atual ? { ...atual, modos: { ...atual.modos, [tipo]: valor } } : atual);
    setSalvo(false);
  };
  const salvar = async () => {
    setSalvando(true); setErro(''); setSalvo(false);
    try {
      try { new Intl.DateTimeFormat('pt-BR', { timeZone: preferencias.timezone }).format(new Date()); }
      catch { setErro('Informe um fuso horário IANA válido, como America/Sao_Paulo.'); setSalvando(false); return; }
      if (preferencias.emailResumo && !Object.values(preferencias.modos).some((modo) => modo === 'diario' || modo === 'semanal')) {
        setErro('Ative pelo menos um resumo diário ou semanal antes de habilitar o e-mail.');
        setSalvando(false);
        return;
      }
      setPreferencias(await salvarPreferenciasNotificacoes(preferencias));
      setSalvo(true);
    } catch {
      setErro('Não foi possível salvar. Suas alterações ainda não foram aplicadas.');
    } finally { setSalvando(false); }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="opcionais-titulo" className="space-y-3">
        <h2 id="opcionais-titulo" className="font-semibold">Notificações opcionais</h2>
        <p className="text-sm text-tinta-suave">As alterações valem para eventos novos. Resumos internos aparecem no sino quando você abrir o console após o horário escolhido.</p>
        {!preferencias.classesElegiveis.length ? <p className="rounded bg-superficie p-3 text-sm text-tinta-suave">As notificações opcionais não estão disponíveis para seu perfil. Você continua recebendo mensagens, solicitações de agendamento e falhas de envio imediatamente.</p> : null}
        {tipos.map(([tipo, rotulo]) => (
          <label key={tipo} className="grid gap-2 rounded-md border border-borda p-3 sm:grid-cols-[1fr_14rem] sm:items-center">
            <span>{rotulo}</span>
            <select aria-label={rotulo} value={preferencias.modos[tipo]} disabled={!elegiveis.has(tipo)}
              onChange={(evento) => alterarModo(tipo, evento.target.value as ModoEntregaNotificacaoApi)}
              className="min-h-10 rounded border border-borda bg-superficie px-3 text-sm disabled:opacity-60">
              {modos.map((modo) => <option key={modo.valor} value={modo.valor}>{modo.rotulo}</option>)}
            </select>
          </label>
        ))}
      </section>

      <section aria-labelledby="obrigatorias-titulo" className="space-y-2">
        <h2 id="obrigatorias-titulo" className="font-semibold">Sempre imediatas</h2>
        <p className="text-sm text-tinta-suave">Estas notificações permanecem ativas para proteger o acompanhamento da sua conta.</p>
        <ul className="list-inside list-disc text-sm">
          <li>Mensagens recebidas</li><li>Solicitações de agendamento</li><li>Falhas de envio</li>
        </ul>
      </section>

      <section className="space-y-2">
        <label htmlFor="timezone-notificacoes" className="font-semibold">Fuso horário</label>
        <p className="text-sm text-tinta-suave">Usado para calcular o horário dos resumos: 9h diariamente ou às segundas-feiras.</p>
        <input id="timezone-notificacoes" value={preferencias.timezone}
          onChange={(evento) => { setPreferencias({ ...preferencias, timezone: evento.target.value }); setSalvo(false); }}
          autoComplete="off" spellCheck={false} className="min-h-11 w-full rounded border border-borda bg-superficie px-3 text-sm" />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Resumo por e-mail</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={preferencias.emailResumo} disabled={!preferencias.classesElegiveis.length}
            onChange={(evento) => { setPreferencias({ ...preferencias, emailResumo: evento.target.checked }); setSalvo(false); }} />
          Enviar também por e-mail quando um resumo for gerado
        </label>
        <p className="text-xs text-tinta-suave">Uma única tentativa por resumo. Se o envio não puder ser confirmado, o e-mail não será reenviado.</p>
      </section>

      {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}
      {salvo ? <p role="status" className="text-sm text-sucesso-forte">Preferências salvas.</p> : null}
      <button type="button" onClick={salvar} disabled={salvando} className="min-h-11 rounded-md bg-primaria px-4 font-medium text-white disabled:opacity-60">
        {salvando ? 'Salvando…' : 'Salvar preferências'}
      </button>
    </div>
  );
}
