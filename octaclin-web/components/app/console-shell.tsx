'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  HeartPulse,
  Send,
  Settings,
  Smartphone,
  Stethoscope,
  Trophy,
  UsersRound,
  Zap
} from 'lucide-react';
import { obterSessao } from '@/lib/auth-api';
import { PortalShell } from '@/components/app/portal-shell';

const itens = [
  { href: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard, permissao: 'dashboard.ler', grupo: 'Clinica' },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDays, permissao: 'agenda.consultas.ler', grupo: 'Clinica' },
  { href: '/pacientes', rotulo: 'Pacientes', icone: HeartPulse, permissao: 'pacientes.listar', grupo: 'Clinica' },
  { href: '/questionarios', rotulo: 'Questionarios', icone: ClipboardList, permissao: 'questionarios.ler', grupo: 'Clinica' },
  { href: '/profissionais', rotulo: 'Profissionais', icone: Stethoscope, permissao: 'profissionais.ler', grupo: 'Clinica' },
  { href: '/comunicacoes', rotulo: 'Comunicacoes', icone: Send, permissao: 'comunicacoes.mensagens.ler', grupo: 'Relacionamento' },
  { href: '/automacoes', rotulo: 'Automacoes', icone: Zap, permissao: 'automacoes.gerenciar', grupo: 'Relacionamento' },
  { href: '/operacoes', rotulo: 'Operacoes', icone: Settings, permissao: 'operacoes.auditoria.ler', grupo: 'Administracao' },
  { href: '/ia', rotulo: 'IA', icone: Brain, permissao: 'ia.executar', grupo: 'Administracao' },
  { href: '/mobile', rotulo: 'Mobile', icone: Smartphone, permissao: 'mobile.operar', grupo: 'Administracao' },
  { href: '/gamificacao', rotulo: 'Gamificacao', icone: Trophy, permissao: 'gamificacao.gerenciar', grupo: 'Administracao' }
] as const;

interface ConsoleShellProps {
  titulo: string;
  subtitulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}

export function ConsoleShell({ titulo, subtitulo, acoes, children }: ConsoleShellProps) {
  const [permissoes, setPermissoes] = useState<string[] | null>(null);

  useEffect(() => {
    void obterSessao()
      .then((sessao) => setPermissoes(sessao?.permissoes?.length ? sessao.permissoes : null))
      .catch(() => setPermissoes(null));
  }, []);

  const itensVisiveis = useMemo(() => {
    if (!permissoes) return [];
    return itens.filter((item) => permissoes.includes(item.permissao));
  }, [permissoes]);

  return (
    <PortalShell
      variante="sidebar"
      marca={{ icone: UsersRound, rotulo: 'OctaClin', subrotulo: 'Console clinico' }}
      titulo={titulo}
      subtitulo={subtitulo}
      navegacao={itensVisiveis}
      navLabel="Modulos do console"
      acoes={acoes}
      maxWidth="1500px"
    >
      {children}
    </PortalShell>
  );
}
