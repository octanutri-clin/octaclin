'use client';

import { createContext, type Dispatch, type ReactNode, type SetStateAction, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { obterPortalPaciente, type PortalPacienteApi } from '@/lib/portal-api';

interface ContextoPortalPaciente {
  portal: PortalPacienteApi | null;
  setPortal: Dispatch<SetStateAction<PortalPacienteApi | null>>;
  carregando: boolean;
  erroCarregamento: string | null;
  carregar: () => Promise<void>;
}

const ContextoPortal = createContext<ContextoPortalPaciente | null>(null);

export function PortalPacienteProvider({ children }: { children: ReactNode }) {
  const [portal, setPortal] = useState<PortalPacienteApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const carregamentoInicialIniciado = useRef(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      setPortal(await obterPortalPaciente());
    } catch (erroAtual) {
      setErroCarregamento(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar portal.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (carregamentoInicialIniciado.current) return;
    carregamentoInicialIniciado.current = true;
    void carregar();
  }, [carregar]);

  return (
    <ContextoPortal.Provider value={{ portal, setPortal, carregando, erroCarregamento, carregar }}>
      {children}
    </ContextoPortal.Provider>
  );
}

export function usePortalPaciente() {
  const contexto = useContext(ContextoPortal);
  if (!contexto) throw new Error('usePortalPaciente deve ser usado dentro de PortalPacienteProvider.');
  return contexto;
}
