'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Search,
  Send,
  Settings,
  Stethoscope,
  Trophy,
  UserRoundPlus,
  Zap,
  type LucideIcon
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Modal } from '@/components/ui/modal';
import type { SessaoPublica } from '@/lib/auth-api';
import { listarPacientes, type PacienteResumo } from '@/lib/cadastros-api';
import {
  comandosPermitidos,
  filtrarComandos,
  resolverAtalho,
  type ComandoPaleta
} from '@/lib/paleta-comandos';
import { cn } from '@/lib/utils';

const ICONES: Record<string, LucideIcon> = {
  'navegar-dashboard': LayoutDashboard,
  'navegar-agenda': CalendarDays,
  'navegar-pacientes': HeartPulse,
  'navegar-questionarios': ClipboardList,
  'navegar-comunicacoes': Send,
  'navegar-automacoes': Zap,
  'navegar-ia': BrainCircuit,
  'navegar-gamificacao': Trophy,
  'navegar-profissionais': Stethoscope,
  'navegar-operacoes': Settings,
  'novo-agendamento': CalendarPlus,
  'novo-paciente': UserRoundPlus
};

interface OpcaoPaleta {
  id: string;
  rotulo: string;
  descricao: string;
  href: string;
  grupo: string;
  icone: LucideIcon;
}

function alvoEditavel(alvo: EventTarget | null) {
  return alvo instanceof HTMLElement
    && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName));
}

function opcaoComando(comando: ComandoPaleta): OpcaoPaleta {
  return {
    id: comando.id,
    rotulo: comando.rotulo,
    descricao: comando.descricao,
    href: comando.href,
    grupo: comando.grupo,
    icone: ICONES[comando.id] ?? Search
  };
}

function opcaoPaciente(paciente: PacienteResumo): OpcaoPaleta {
  return {
    id: `paciente-${paciente.id}`,
    rotulo: paciente.nome,
    descricao: 'Abrir prontuário',
    href: `/pacientes/${paciente.id}`,
    grupo: 'Pacientes',
    icone: HeartPulse
  };
}

export function PaletaComandos({ sessao }: { sessao: SessaoPublica }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [erroBusca, setErroBusca] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const campoBuscaRef = useRef<HTMLInputElement>(null);
  const sequenciaRef = useRef<string[]>([]);
  const temporizadorSequenciaRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const comandos = useMemo(
    () => comandosPermitidos({ papel: sessao.papel, permissoes: sessao.permissoes }),
    [sessao.papel, sessao.permissoes]
  );
  const comandosFiltrados = useMemo(() => filtrarComandos(comandos, busca), [busca, comandos]);
  const podeBuscarPacientes = sessao.permissoes.includes('pacientes.listar')
    && sessao.permissoes.includes('pacientes.ler');
  const opcoes = useMemo(
    () => [...comandosFiltrados.map(opcaoComando), ...pacientes.map(opcaoPaciente)],
    [comandosFiltrados, pacientes]
  );
  const indiceSelecionado = Math.min(indiceAtivo, Math.max(0, opcoes.length - 1));

  const fechar = useCallback(() => {
    setAberta(false);
    setBusca('');
    setPacientes([]);
    setErroBusca(false);
  }, []);

  const executar = useCallback((href: string) => {
    fechar();
    const destino = new URL(href, window.location.origin);
    if (destino.pathname === window.location.pathname && destino.hash) {
      window.history.replaceState(null, '', `${destino.pathname}${destino.search}${destino.hash}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    router.push(href as Route);
  }, [fechar, router]);

  useEffect(() => {
    setIndiceAtivo(0);
  }, [busca, pacientes]);

  useEffect(() => {
    if (!aberta) return;
    const quadro = requestAnimationFrame(() => campoBuscaRef.current?.focus());
    return () => cancelAnimationFrame(quadro);
  }, [aberta]);

  useEffect(() => {
    const termo = busca.trim();
    if (!aberta || !podeBuscarPacientes || termo.length < 3) {
      setPacientes([]);
      setBuscandoPacientes(false);
      setErroBusca(false);
      return;
    }

    let cancelada = false;
    setBuscandoPacientes(true);
    setErroBusca(false);
    const temporizador = setTimeout(() => {
      void listarPacientes({ pagina: 1, limite: 8, busca: termo })
        .then((resposta) => {
          if (!cancelada) setPacientes(resposta.itens);
        })
        .catch(() => {
          if (!cancelada) {
            setPacientes([]);
            setErroBusca(true);
          }
        })
        .finally(() => {
          if (!cancelada) setBuscandoPacientes(false);
        });
    }, 250);

    return () => {
      cancelada = true;
      clearTimeout(temporizador);
    };
  }, [aberta, busca, podeBuscarPacientes]);

  useEffect(() => {
    function limparSequencia() {
      sequenciaRef.current = [];
      if (temporizadorSequenciaRef.current) clearTimeout(temporizadorSequenciaRef.current);
    }

    function aoTeclar(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        if (aberta) fechar();
        else setAberta(true);
        return;
      }
      if (aberta || evento.repeat || evento.ctrlKey || evento.metaKey || evento.altKey || alvoEditavel(evento.target)) return;

      const tecla = evento.key.toLowerCase();
      if (!sequenciaRef.current.length) {
        if (tecla !== 'g' && tecla !== 'n') return;
        evento.preventDefault();
        sequenciaRef.current = [tecla];
        temporizadorSequenciaRef.current = setTimeout(limparSequencia, 900);
        return;
      }

      const sequencia = [...sequenciaRef.current, tecla];
      const comando = resolverAtalho(comandos, sequencia);
      limparSequencia();
      if (!comando) return;
      evento.preventDefault();
      executar(comando.href);
    }

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      limparSequencia();
    };
  }, [aberta, comandos, executar, fechar]);

  function aoTeclarBusca(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!opcoes.length) return;
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setIndiceAtivo((atual) => (atual + 1) % opcoes.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndiceAtivo((atual) => (atual - 1 + opcoes.length) % opcoes.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      executar(opcoes[indiceSelecionado]?.href ?? opcoes[0].href);
    }
  }

  return (
    <>
      <Botao type="button" variante="secundario" onClick={() => setAberta(true)} aria-label="Buscar no OctaClin. Atalho Control K">
        <Search size={16} aria-hidden="true" />
        <span className="hidden xl:inline">Buscar</span>
      </Botao>
      <Modal aberto={aberta} aoFechar={fechar} titulo="Buscar no OctaClin" className="max-w-2xl">
        <div className="grid gap-3">
          <div className="relative">
            <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
            <Campo
              ref={campoBuscaRef}
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              onKeyDown={aoTeclarBusca}
              placeholder="Digite uma tela, ação ou paciente"
              className="pl-10"
              role="combobox"
              aria-expanded="true"
              aria-controls="opcoes-paleta"
              aria-autocomplete="list"
              aria-activedescendant={opcoes.length ? `opcao-paleta-${indiceSelecionado}` : undefined}
            />
          </div>

          <div id="opcoes-paleta" role="listbox" aria-label="Resultados" className="max-h-[58vh] overflow-y-auto">
            {opcoes.map((opcao, indice) => {
              const Icone = opcao.icone;
              const exibirGrupo = indice === 0 || opcoes[indice - 1].grupo !== opcao.grupo;
              return (
                <Fragment key={opcao.id}>
                  {exibirGrupo ? <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase text-texto-sutil first:pt-0">{opcao.grupo}</p> : null}
                  <button
                    id={`opcao-paleta-${indice}`}
                    type="button"
                    role="option"
                    aria-selected={indiceSelecionado === indice}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    onClick={() => executar(opcao.href)}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primaria',
                      indiceSelecionado === indice ? 'bg-superficie-hover' : 'hover:bg-superficie-hover'
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-superficie text-primaria">
                      <Icone size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-texto-forte">{opcao.rotulo}</span>
                      <span className="block truncate text-xs text-texto-suave">{opcao.descricao}</span>
                    </span>
                  </button>
                </Fragment>
              );
            })}
            {!opcoes.length && !buscandoPacientes && !erroBusca ? (
              <p className="px-3 py-8 text-center text-sm text-texto-suave">Nenhum resultado encontrado.</p>
            ) : null}
            {buscandoPacientes ? (
              <p className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-texto-suave">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Buscando pacientes
              </p>
            ) : null}
            {erroBusca ? (
              <p className="px-3 py-3 text-center text-sm text-perigo">Não foi possível buscar pacientes.</p>
            ) : null}
          </div>

          <p className="sr-only" aria-live="polite">
            {buscandoPacientes ? 'Buscando pacientes.' : erroBusca ? 'Não foi possível buscar pacientes.' : `${opcoes.length} resultados.`}
          </p>
        </div>
      </Modal>
    </>
  );
}
