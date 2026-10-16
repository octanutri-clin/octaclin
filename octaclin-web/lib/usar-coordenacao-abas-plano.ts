'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { obterSessao } from './auth-api';
import { CoordenacaoAbasPlano, type EstadoCoordenacaoAbasPlano } from './coordenacao-abas-plano';
import { chaveAbasPlano, criarCanalAbasPlano, criarTravaAbasPlano } from './coordenacao-abas-plano-nativa';

interface Opcoes {
  pacienteId: string;
  planoId?: string;
  habilitado: boolean;
  conferir: (signal: AbortSignal) => Promise<boolean>;
  drenar: () => Promise<void>;
  definirPosse: (permitida: boolean) => void;
}
/** Browser coordination never replaces BFF authorization or backend CAS. */
export function useCoordenacaoAbasPlano(opcoes: Opcoes) {
  const callbacks = useRef(opcoes);
  useLayoutEffect(() => { callbacks.current = opcoes; });
  const atual = useRef<CoordenacaoAbasPlano | null>(null);
  const geracao = useRef(0);
  const [visao, setVisao] = useState<{ estado: EstadoCoordenacaoAbasPlano; geracao: number }>({ estado: 'inicializando', geracao: 0 });
  const { pacienteId, planoId, habilitado } = opcoes;
  useEffect(() => {
    let desmontado = false;
    let ciclo = 0;
    const parar = () => {
      ciclo++;
      const anterior = atual.current; atual.current = null;
      anterior?.encerrar();
      geracao.current++;
      callbacks.current.definirPosse(false);
    };
    const iniciar = async (somenteConsulta = false) => {
      parar();
      const cicloAtual = ciclo;
      if (!habilitado || !planoId) return;
      setVisao({ estado: 'inicializando', geracao: geracao.current });
      try {
        const sessao = await obterSessao();
        if (desmontado || cicloAtual !== ciclo) return;
        if (!sessao?.tenantSlug) throw new Error('Sessão indisponível');
        const mesmoContexto = async () => {
          const vigente = await obterSessao();
          return Boolean(vigente && vigente.tenantSlug === sessao.tenantSlug && vigente.email === sessao.email && vigente.apiUrl === sessao.apiUrl);
        };
        let canal;
        let trava;
        try {
          const chave = await chaveAbasPlano(JSON.stringify([sessao.apiUrl, sessao.tenantSlug]), planoId);
          if (desmontado || cicloAtual !== ciclo) return;
          if (typeof navigator.locks?.request === 'function') trava = criarTravaAbasPlano(navigator.locks, chave);
          try { if (typeof BroadcastChannel === 'function') canal = criarCanalAbasPlano(chave); } catch { /* Web Locks e CAS ainda funcionam. */ }
        } catch { /* Sem APIs: modo legado com aviso, somente após leitura autorizada. */ }
        if (desmontado || cicloAtual !== ciclo) { canal?.fechar(); return; }
        const coordenacao = new CoordenacaoAbasPlano({
          instancia: crypto.randomUUID(), trava, canal, iniciarEmConsulta: somenteConsulta,
          conferir: async signal => {
            if (!(await mesmoContexto()) || signal.aborted) return false;
            return callbacks.current.conferir(signal);
          },
          drenar: () => callbacks.current.drenar(),
          notificar: () => {
            if (desmontado || atual.current !== coordenacao) return;
            if (!coordenacao.podeEditar) geracao.current++;
            callbacks.current.definirPosse(coordenacao.podeEditar);
            setVisao({ estado: coordenacao.estado, geracao: geracao.current });
          }
        });
        atual.current = coordenacao;
        await coordenacao.iniciar();
      } catch {
        if (!desmontado && cicloAtual === ciclo) {
          callbacks.current.definirPosse(false);
          setVisao({ estado: 'reconferir', geracao: geracao.current });
        }
      }
    };
    const revalidar = () => { if (document.visibilityState === 'visible') void atual.current?.revalidar(); };
    const restaurar = (evento: PageTransitionEvent) => { if (evento.persisted) void iniciar(true); };
    void iniciar();
    window.addEventListener('focus', revalidar);
    document.addEventListener('visibilitychange', revalidar);
    window.addEventListener('pagehide', parar);
    window.addEventListener('pageshow', restaurar);
    return () => {
      desmontado = true; parar();
      window.removeEventListener('focus', revalidar);
      document.removeEventListener('visibilitychange', revalidar);
      window.removeEventListener('pagehide', parar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, [pacienteId, planoId, habilitado]);
  return {
    estado: visao.estado,
    podeEditar: visao.estado === 'editando' || visao.estado === 'indisponivel',
    // O callback capturado por uma cópia antiga não volta a ser válido após retomar.
    permiteEscrever: () => atual.current?.podeEditar === true && visao.geracao === geracao.current,
    assumir: async () => { await atual.current?.assumir(); },
    revalidar: async () => { await atual.current?.revalidar(); }
  };
}
