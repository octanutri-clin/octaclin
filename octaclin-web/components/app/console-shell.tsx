'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  BrainCircuit,
  ClipboardList,
  HeartPulse,
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
import { classesBotao } from '@/components/ui/botao';
import { Dica } from '@/components/ui/dica';

const itens = [
  { href: '/dashboard', rotulo: 'Hoje', icone: LayoutDashboard, permissao: 'dashboard.ler', grupo: 'Clinica', papeis: ['SuperAdmin', 'Professional'] },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDays, permissao: 'agenda.consultas.ler', grupo: 'Clinica', papeis: undefined },
  { href: '/pacientes', rotulo: 'Pacientes', icone: HeartPulse, permissao: 'pacientes.listar', grupo: 'Clinica', papeis: undefined },
  { href: '/questionarios', rotulo: 'Formulários', icone: ClipboardList, permissao: 'questionarios.ler', grupo: 'Clínica', papeis: undefined },
  { href: '/comunicacoes', rotulo: 'Comunicações', icone: Send, permissao: 'comunicacoes.mensagens.ler', grupo: 'Relacionamento', papeis: undefined },
  { href: '/automacoes', rotulo: 'Automações', icone: Zap, permissao: 'automacoes.gerenciar', grupo: 'Relacionamento', papeis: undefined },
  { href: '/ia', rotulo: 'IA assistida', icone: BrainCircuit, permissao: 'ia.executar', grupo: 'Ferramentas', papeis: ['SuperAdmin', 'Professional'] },
  { href: '/gamificacao', rotulo: 'Metas e adesao', icone: Trophy, permissao: 'gamificacao.gerenciar', grupo: 'Ferramentas', papeis: ['SuperAdmin', 'Professional'] },
  { href: '/profissionais', rotulo: 'Profissionais', icone: Stethoscope, permissao: 'profissionais.ler', grupo: 'Gestao', papeis: undefined },
  { href: '/operacoes', rotulo: 'Operacoes', icone: Settings, permissao: 'operacoes.auditoria.ler', grupo: 'SuperAdmin', papeis: ['SuperAdmin'] }
] as const;

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
    .join(' ');
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

  const permissoes = sessao?.permissoes ?? [];
  const itensVisiveis = itens.filter((item) =>
    permissoes.includes(item.permissao)
    && (!item.papeis || Boolean(sessao?.papel && item.papeis.some((papel) => papel === sessao.papel)))
  );

  const atalhos = sessao ? (
    <>
      <PaletaComandos sessao={sessao} />
      {permissoes.includes('agenda.consultas.criar') ? (
        <AtalhoShell href="/agenda#novo-agendamento" rotulo="Agendar" icone={<CalendarPlus size={16} />} />
      ) : null}
      {permissoes.includes('pacientes.gerenciar') ? (
        <AtalhoShell href="/pacientes#novo-paciente" rotulo="Novo paciente" icone={<UserRoundPlus size={16} />} />
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
        papel: nomesPapel[sessao.papel ?? ''] ?? 'Usuario',
        workspace: humanizarWorkspace(sessao.tenantSlug)
      } : undefined}
      navLabel="Módulos do console"
      acoes={<>{atalhos}{acoes}</>}
      maxWidth="1500px"
    >
      {children}
    </PortalShell>
  );
}
