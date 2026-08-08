'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { assinarMudancasFila, contarOperacoesPwa, processarOperacoesPwa } from '@/lib/pwa-private-queue';

interface EventoInstalacaoPwa extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface EstadoPwa {
  online: boolean;
  instalavel: boolean;
  pendentes: number;
  processando: boolean;
  instalar(): Promise<void>;
}

const ContextoPwa = createContext<EstadoPwa>({
  online: true,
  instalavel: false,
  pendentes: 0,
  processando: false,
  instalar: async () => undefined
});

export function PwaRuntime({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [eventoInstalacao, setEventoInstalacao] = useState<EventoInstalacaoPwa | null>(null);

  const atualizarPendentes = useCallback(async () => setPendentes(await contarOperacoesPwa()), []);
  const sincronizar = useCallback(async () => {
    setProcessando(true);
    try {
      await processarOperacoesPwa();
      await atualizarPendentes();
    } finally {
      setProcessando(false);
    }
  }, [atualizarPendentes]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void atualizarPendentes();

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    }

    const aoFicarOnline = () => {
      setOnline(true);
      void sincronizar();
    };
    const aoFicarOffline = () => setOnline(false);
    const aoPedirInstalacao = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacao(evento as EventoInstalacaoPwa);
    };
    window.addEventListener('online', aoFicarOnline);
    window.addEventListener('offline', aoFicarOffline);
    window.addEventListener('beforeinstallprompt', aoPedirInstalacao);
    const desassinar = assinarMudancasFila(() => void atualizarPendentes());
    if (navigator.onLine) void sincronizar();

    return () => {
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('offline', aoFicarOffline);
      window.removeEventListener('beforeinstallprompt', aoPedirInstalacao);
      desassinar();
    };
  }, [atualizarPendentes, sincronizar]);

  const instalar = useCallback(async () => {
    if (!eventoInstalacao) return;
    await eventoInstalacao.prompt();
    await eventoInstalacao.userChoice;
    setEventoInstalacao(null);
  }, [eventoInstalacao]);

  const valor = useMemo(() => ({
    online,
    instalavel: Boolean(eventoInstalacao),
    pendentes,
    processando,
    instalar
  }), [eventoInstalacao, instalar, online, pendentes, processando]);

  return <ContextoPwa.Provider value={valor}>{children}</ContextoPwa.Provider>;
}

export function usePwa() {
  return useContext(ContextoPwa);
}
