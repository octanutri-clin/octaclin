'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChaveKitInicialClinicaApi,
  EstadoKitInicialClinicaApi,
  instalarKitInicialCliente,
  obterKitInicialCliente
} from '@/lib/onboarding-operacoes-api';
import { KitInicialSeletor } from '@/components/kit-inicial/kit-inicial-seletor';

export function KitInicialClinicaCliente({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [estado, setEstado] = useState<EstadoKitInicialClinicaApi | null>(null);
  const [selecionadas, setSelecionadas] = useState<ChaveKitInicialClinicaApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true);
    setErro(null);
    try {
      setEstado(await obterKitInicialCliente(signal));
    } catch (erroAtual) {
      if (signal?.aborted) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível carregar o kit inicial.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!podeGerenciar) return;
    const controlador = new AbortController();
    queueMicrotask(() => { if (!controlador.signal.aborted) void carregar(controlador.signal); });
    return () => controlador.abort();
  }, [carregar, podeGerenciar]);

  function alternar(chave: ChaveKitInicialClinicaApi) {
    setSelecionadas((atuais) => atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]);
  }

  async function confirmar(): Promise<boolean> {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await instalarKitInicialCliente(selecionadas);
      setEstado(resultado);
      setSelecionadas([]);
      setSucesso(resultado.instalacao.reutilizado
        ? 'Os itens selecionados já estavam instalados. O estado foi atualizado.'
        : 'Kit inicial instalado. A equipe profissional pode revisar os materiais e completar as estruturas.');
      return true;
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível instalar o kit.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  if (!podeGerenciar) return null;
  return <KitInicialSeletor
    estado={estado}
    carregando={carregando}
    salvando={salvando}
    erro={erro}
    sucesso={sucesso}
    selecionadas={selecionadas}
    aoAlternar={alternar}
    aoSelecionarPendentes={() => setSelecionadas(estado?.itens.filter((item) => !item.instalado).map((item) => item.chave) ?? [])}
    aoRecarregar={() => void carregar()}
    aoConfirmar={confirmar}
  />;
}
