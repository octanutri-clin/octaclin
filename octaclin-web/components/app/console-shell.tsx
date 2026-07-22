'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Brain,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Send,
  Settings,
  Smartphone,
  Stethoscope,
  Trophy,
  UsersRound,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { obterSessao } from '@/lib/auth-api';

const itens = [
  { href: '/questionarios', rotulo: 'Questionarios', icone: ClipboardList, permissao: 'questionarios.ler' },
  { href: '/comunicacoes', rotulo: 'Comunicacoes', icone: Send, permissao: 'comunicacoes.mensagens.ler' },
  { href: '/agenda', rotulo: 'Agenda', icone: CalendarDays, permissao: 'agenda.consultas.ler' },
  { href: '/automacoes', rotulo: 'Automacoes', icone: Zap, permissao: 'automacoes.gerenciar' },
  { href: '/ia', rotulo: 'IA', icone: Brain, permissao: 'ia.executar' },
  { href: '/mobile', rotulo: 'Mobile', icone: Smartphone, permissao: 'mobile.operar' },
  { href: '/gamificacao', rotulo: 'Gamificacao', icone: Trophy, permissao: 'gamificacao.gerenciar' },
  { href: '/operacoes', rotulo: 'Operacoes', icone: Settings, permissao: 'operacoes.auditoria.ler' },
  { href: '/pacientes', rotulo: 'Pacientes', icone: HeartPulse, permissao: 'pacientes.listar' },
  { href: '/profissionais', rotulo: 'Profissionais', icone: Stethoscope, permissao: 'profissionais.ler' }
] as const;

interface ConsoleShellProps {
  titulo: string;
  subtitulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}

export function ConsoleShell({ titulo, subtitulo, acoes, children }: ConsoleShellProps) {
  const pathname = usePathname();
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
    <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 min-w-0 overflow-hidden border-b border-linha bg-white lg:h-screen lg:overflow-visible lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 px-4 py-3 lg:px-5 lg:py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primaria text-white">
              <UsersRound size={19} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">OctaClin</p>
              <p className="text-xs text-[#596273]">Console clinico</p>
            </div>
          </div>
          <nav
            aria-label="Modulos do console"
            className="flex min-w-0 max-w-full gap-1 overflow-x-auto border-t border-linha px-3 py-2 [scrollbar-width:none] lg:grid lg:overflow-visible lg:px-3 lg:py-3 [&::-webkit-scrollbar]:hidden"
          >
            {itensVisiveis.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  aria-current={ativo ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#596273] transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                    ativo ? 'bg-[#eaf3f7] text-primaria' : 'hover:bg-[#eef3f6] hover:text-tinta'
                  )}
                >
                  <item.icone size={17} className="shrink-0" />
                  <span className="whitespace-nowrap">{item.rotulo}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-linha bg-white">
            <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between lg:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-[#596273]">{subtitulo}</p>
                <h1 className="text-xl font-semibold text-tinta">{titulo}</h1>
              </div>
              {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div> : null}
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6 lg:py-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
