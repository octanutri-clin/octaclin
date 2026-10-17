import type { CanalAbasPlano, TravaAbasPlano } from './coordenacao-abas-plano';

/** Chave local pseudonimizada. Não registrar, persistir ou usar como autorização. */
export async function chaveAbasPlano(tenant: string, plano: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([tenant, plano]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `octaclin-pa07-v1-${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** ifAvailable evita fila surpresa; liberar é idempotente. Nunca usar steal. */
export function criarTravaAbasPlano(gerente: LockManager, chave: string): TravaAbasPlano {
  return { adquirir: signal => new Promise((resolver, rejeitar) => {
    if (signal.aborted) { rejeitar(new DOMException('Aquisição encerrada', 'AbortError')); return; }
    // A plataforma proíbe signal com ifAvailable. Não há fila: conferir antes
    // e dentro do callback libera qualquer aquisição entregue após cleanup.
    void gerente.request(chave, { mode: 'exclusive', ifAvailable: true }, async trava => {
      if (signal.aborted) { rejeitar(new DOMException('Aquisição encerrada', 'AbortError')); return; }
      if (!trava) { resolver(null); return; }
      await new Promise<void>(liberar => { resolver(liberar); });
    }).catch(rejeitar);
  }) };
}

export function criarCanalAbasPlano(chave: string): CanalAbasPlano {
  const canal = new BroadcastChannel(chave);
  let fechado = false;
  const ouvintes = new Set<(evento: MessageEvent<unknown>) => void>();
  return {
    enviar: mensagem => { if (!fechado) canal.postMessage(mensagem); },
    ouvir: fn => {
      if (fechado) return () => {};
      const ouvinte = (evento: MessageEvent<unknown>) => fn(evento.data);
      ouvintes.add(ouvinte); canal.addEventListener('message', ouvinte);
      return () => { ouvintes.delete(ouvinte); canal.removeEventListener('message', ouvinte); };
    },
    fechar: () => {
      if (fechado) return;
      fechado = true;
      for (const ouvinte of ouvintes) canal.removeEventListener('message', ouvinte);
      ouvintes.clear(); canal.close();
    }
  };
}
