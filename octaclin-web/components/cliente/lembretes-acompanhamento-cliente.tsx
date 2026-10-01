'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';

interface ConfiguracaoLembretes {
  plano: { ativo: boolean; intervaloDias: number; ativadoEm?: string };
  tarefas: { ativo: boolean; antecedenciaHoras: number; ativadoEm?: string };
}

export function LembretesAcompanhamentoCliente() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoLembretes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    let ativo = true;
    void fetch('/api/cliente/lembretes-acompanhamento', { cache: 'no-store' }).then(async (resposta) => {
      if (!resposta.ok) throw new Error();
      return resposta.json() as Promise<ConfiguracaoLembretes>;
    }).then((dados) => { if (ativo) setConfiguracao(dados); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar os lembretes.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!configuracao || salvando) return;
    setSalvando(true);
    setErro(''); setSucesso('');
    try {
      const resposta = await fetch('/api/cliente/lembretes-acompanhamento', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: { ativo: configuracao.plano.ativo, intervaloDias: configuracao.plano.intervaloDias },
          tarefas: { ativo: configuracao.tarefas.ativo, antecedenciaHoras: configuracao.tarefas.antecedenciaHoras } })
      });
      if (!resposta.ok) throw new Error();
      setConfiguracao(await resposta.json() as ConfiguracaoLembretes);
      setSucesso('Lembretes atualizados. Novas ativações não incluem planos e tarefas anteriores.');
    } catch { setErro('Não foi possível salvar os lembretes.'); }
    finally { setSalvando(false); }
  }

  return <section className="rounded-md border border-linha bg-white p-4" aria-busy={carregando}>
    <h2 className="text-base font-semibold">Lembretes de acompanhamento</h2>
    <p className="mt-1 text-sm text-texto-suave">Desligados por padrão. A ativação vale para novos planos publicados e novas tarefas. Avisos genéricos aparecem no portal e seguem por um canal externo apenas quando permitido pelo paciente.</p>
    {carregando ? <p role="status" className="mt-3">Carregando configuração…</p> : null}
    {erro ? <p role="alert" className="mt-3 text-perigo">{erro}</p> : null}
    {sucesso ? <p role="status" className="mt-3 text-sucesso-forte">{sucesso}</p> : null}
    {configuracao ? <form onSubmit={(evento) => void salvar(evento)} className="mt-4 grid gap-4">
      <fieldset className="grid gap-2 rounded-md border border-linha p-3">
        <legend className="px-1 font-semibold">Plano alimentar</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={configuracao.plano.ativo} onChange={(evento) => setConfiguracao((atual) => atual && ({ ...atual, plano: { ...atual.plano, ativo: evento.target.checked } }))} />Enviar lembretes do plano</label>
        <label className="grid gap-1 text-sm">Intervalo em dias
          <input className="h-10 w-32 rounded-md border border-linha px-3" type="number" min={1} max={30} step={1} value={configuracao.plano.intervaloDias} onChange={(evento) => setConfiguracao((atual) => atual && ({ ...atual, plano: { ...atual.plano, intervaloDias: Number(evento.target.value) } }))} required />
        </label>
      </fieldset>
      <fieldset className="grid gap-2 rounded-md border border-linha p-3">
        <legend className="px-1 font-semibold">Tarefas do paciente</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={configuracao.tarefas.ativo} onChange={(evento) => setConfiguracao((atual) => atual && ({ ...atual, tarefas: { ...atual.tarefas, ativo: evento.target.checked } }))} />Avisar sobre tarefa próxima do vencimento</label>
        <label className="grid gap-1 text-sm">Antecedência em horas
          <input className="h-10 w-32 rounded-md border border-linha px-3" type="number" min={0} max={168} step={1} value={configuracao.tarefas.antecedenciaHoras} onChange={(evento) => setConfiguracao((atual) => atual && ({ ...atual, tarefas: { ...atual.tarefas, antecedenciaHoras: Number(evento.target.value) } }))} required />
        </label>
      </fieldset>
      <div><Botao type="submit" variante="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar lembretes'}</Botao></div>
    </form> : null}
  </section>;
}
