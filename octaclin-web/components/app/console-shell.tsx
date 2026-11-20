'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  BrainCircuit,
  ClipboardList,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Send,
  Settings,
  Stethoscope,
  Trophy,
  UserRoundPlus,
  UsersRound,
  Zap
} from 'lucide-react';
import { obterSessao, type SessaoPublica } from '@/lib/auth-api';
import { PortalShell } from '@/components/app/portal-shell';
import { PaletaComandos } from '@/components/app/paleta-comandos';
import { SinoNotificacoes } from '@/components/app/sino-notificacoes';
import { equipeRestricoesDisponivel } from '@/lib/restricoes-equipe-api';
import { TEXTOS_EQUIPE_RESTRICOES } from '@/lib/textos-equipe-restricoes';
import { classesBotao } from '@/components/ui/botao';
import { Dica } from '@/components/ui/dica';
import { modulosConsolePermitidos, type IconeModuloConsole } from '@/lib/navegacao-console';

const ICONES_MODULOS: Record<IconeModuloConsole, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  agenda: CalendarDays,
  pacientes: HeartPulse,
  formularios: ClipboardList,
  comunicacoes: Send,
  automacoes: Zap,
  ia: BrainCircuit,
  gamificacao: Trophy,
  profissionais: Stethoscope,
  integracoes: KeyRound,
  operacoes: Settings
};

const nomesPapel: Record<string, string> = {
  SuperAdmin: 'SuperAdmin',
  Professional: 'Profissional',
  Collaborator: 'Colaborador',
  Patient: 'Paciente',
  Client: 'Gestor da conta'
};

function humanizarWorkspace(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ')
    .replace(/\bClinica\b/g, 'Clínica');
}

interface ConsoleShellProps {
  titulo: string;
  subtitulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}

function AtalhoShell({ href, rotulo, icone }: { href: string; rotulo: string; icone: ReactNode }) {
  return (
    <Dica texto={rotulo}>
      <Link href={href as Route} aria-label={rotulo} className={classesBotao()}>
        {icone}
        <span className="hidden xl:inline">{rotulo}</span>
      </Link>
    </Dica>
  );
}

export function ConsoleShell({ titulo, subtitulo, acoes, children }: ConsoleShellProps) {
  const [sessao, setSessao] = useState<SessaoPublica | null>();

  useEffect(() => {
    void obterSessao().then(setSessao).catch(() => setSessao(null));
  }, []);

  // FOOD06 P3-6 (NUX-08, decisão de 2026-11-19): entrada da delegação no menu da conta, só para o titular e só com a área
  // de restrições ligada na web e no tenant. Pergunta só quando o menu abre (sem custo na carga das telas). É só
  // navegação: a página e o backend continuam decidindo.
  const [delegacaoDisponivel, setDelegacaoDisponivel] = useState(false);
  const perguntouDelegacao = useRef(false);
  const ehTitular = sessao?.papel === 'Professional';
  const aoAbrirMenuConta = useCallback(() => {
    if (!ehTitular || perguntouDelegacao.current) return;
    perguntouDelegacao.current = true;
    void equipeRestricoesDisponivel().then(setDelegacaoDisponivel);
  }, [ehTitular]);
  const linksConta = ehTitular && delegacaoDisponivel
    ? [{ href: '/conta/delegacao', rotulo: TEXTOS_EQUIPE_RESTRICOES.tituloDelegacao, icone: <UsersRound size={16} /> }]
    : [];

  const permissoes = sessao?.permissoes ?? [];
  const itensVisiveis = modulosConsolePermitidos({ papel: sessao?.papel, permissoes }).map((modulo) => ({
    href: modulo.href,
    rotulo: modulo.rotulo,
    grupo: modulo.grupo,
    icone: ICONES_MODULOS[modulo.icone]
  }));

  const atalhos = sessao ? (
    <>
      <PaletaComandos sessao={sessao} />
      {permissoes.includes('agenda.consultas.criar') ? (
        <AtalhoShell href="/agenda#novo-agendamento" rotulo="Agendar" icone={<CalendarPlus size={16} />} />
      ) : null}
      {permissoes.includes('pacientes.gerenciar') ? (
        <AtalhoShell href="/pacientes/novo" rotulo="Novo paciente" icone={<UserRoundPlus size={16} />} />
      ) : null}
      {permissoes.includes('console.acessar') ? <SinoNotificacoes /> : null}
    </>
  ) : null;

  return (
    <PortalShell
      variante="sidebar"
      marca={{ icone: UsersRound, rotulo: 'OctaClin', subrotulo: 'Console clínico' }}
      titulo={titulo}
      subtitulo={subtitulo}
      navegacao={itensVisiveis}
      navegacaoCarregando={sessao === undefined}
      contextoUsuario={sessao ? {
        email: sessao.email,
        papel: nomesPapel[sessao.papel ?? ''] ?? 'Usuário',
        workspace: humanizarWorkspace(sessao.tenantSlug)
      } : undefined}
      navLabel="Módulos do console"
      linksConta={linksConta}
      aoAbrirMenuConta={aoAbrirMenuConta}
      acoes={<>{atalhos}{acoes}</>}
      maxWidth="1500px"
    >
      {children}
    </PortalShell>
  );
}
