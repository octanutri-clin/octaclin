'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Botao } from '@/components/ui/botao';
import { Esqueleto } from '@/components/ui/feedback';
import { sair } from '@/lib/auth-api';

export interface ItemNavegacaoShell {
  href: string;
  rotulo: string;
  icone?: LucideIcon;
  grupo?: string;
}

interface MarcaShell {
  icone: LucideIcon;
  rotulo: string;
  subrotulo: string;
}

interface ContextoUsuarioShell {
  email: string;
  papel: string;
  workspace: string;
}

interface PortalShellProps {
  variante: 'sidebar' | 'tabs';
  marca?: MarcaShell;
  titulo: string;
  subtitulo: string;
  descricao?: ReactNode;
  navegacao: ItemNavegacaoShell[];
  navegacaoCarregando?: boolean;
  navLabel?: string;
  navegacaoMobile?: ItemNavegacaoShell[];
  navLabelMobile?: string;
  acoes?: ReactNode;
  contextoUsuario?: ContextoUsuarioShell;
  maxWidth?: string;
  children: ReactNode;
}

export function PortalShell({
  variante,
  marca,
  titulo,
  subtitulo,
  descricao,
  navegacao,
  navegacaoCarregando = false,
  navLabel = 'Modulos',
  navegacaoMobile = [],
  navLabelMobile = 'Navegacao mobile',
  acoes,
  contextoUsuario,
  maxWidth = '1180px',
  children
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function encerrarSessao() {
    await sair();
    router.replace('/login');
  }

  const botaoSair = (
    <Botao type="button" variante="fantasma" onClick={encerrarSessao}>
      <LogOut size={16} />
      Sair
    </Botao>
  );

  const menuConta = contextoUsuario ? (
    <details className="relative">
      <summary
        aria-label="Abrir menu da conta"
        className={cn(
          'flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-linha bg-white px-2 text-left text-sm transition-colors',
          'hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria [&::-webkit-details-marker]:hidden'
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria-forte">
          <UserRound size={17} aria-hidden="true" />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-44 truncate text-xs font-semibold text-tinta">{contextoUsuario.email}</span>
          <span className="block text-xs text-texto-suave">{contextoUsuario.papel}</span>
        </span>
        <ChevronDown size={15} className="text-texto-suave" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-linha bg-white p-3 shadow-lg">
        <p className="text-xs font-semibold uppercase text-texto-sutil">Workspace</p>
        <p className="mt-1 truncate text-sm font-semibold text-tinta">{contextoUsuario.workspace}</p>
        <p className="mt-3 truncate text-sm text-texto-suave">{contextoUsuario.email}</p>
        <p className="text-xs text-texto-sutil">{contextoUsuario.papel}</p>
        <div className="mt-3 border-t border-linha pt-2">{botaoSair}</div>
      </div>
    </details>
  ) : botaoSair;

  if (variante === 'sidebar') {
    return (
      <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
        <a
          href="#conteudo-principal"
          className="fixed left-3 top-3 z-[60] -translate-y-20 rounded-md bg-tinta px-3 py-2 text-sm font-semibold text-white focus:translate-y-0"
        >
          Pular para o conteudo
        </a>
        <div className="grid min-h-screen min-w-0 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="sticky top-0 z-20 min-w-0 overflow-hidden border-b border-linha bg-white lg:h-screen lg:overflow-visible lg:border-b-0 lg:border-r">
            {marca ? (
              <div className="flex items-center gap-2 px-4 py-3 lg:px-5 lg:py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primaria text-white">
                  <marca.icone size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{marca.rotulo}</p>
                  <p className="text-xs text-texto-suave">{marca.subrotulo}</p>
                </div>
              </div>
            ) : null}
            <nav
              aria-label={navLabel}
              className="flex min-w-0 max-w-full gap-1 overflow-x-auto border-t border-linha px-3 py-2 [scrollbar-width:none] lg:grid lg:overflow-visible lg:px-3 lg:py-3 [&::-webkit-scrollbar]:hidden"
            >
              {navegacaoCarregando ? (
                <div className="grid min-w-56 gap-2 px-1 py-1 lg:min-w-0" aria-hidden="true">
                  {Array.from({ length: 4 }, (_, indice) => <Esqueleto key={indice} className="h-11 w-full" />)}
                </div>
              ) : navegacao.map((item, indice) => {
                const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Fragment key={item.href}>
                    {item.grupo && item.grupo !== navegacao[indice - 1]?.grupo ? (
                      <p className="hidden px-3 pt-3 text-xs font-semibold uppercase text-texto-sutil first:pt-0 lg:block">
                        {item.grupo}
                      </p>
                    ) : null}
                    <Link
                      href={item.href as Route}
                      aria-current={ativo ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-texto-suave transition-colors',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                        ativo ? 'bg-primaria-suave text-primaria' : 'hover:bg-superficie-hover hover:text-tinta'
                      )}
                    >
                      {item.icone ? <item.icone size={17} className="shrink-0" /> : null}
                      <span className="whitespace-nowrap">{item.rotulo}</span>
                    </Link>
                  </Fragment>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            <header className="border-b border-linha bg-white">
              <div
                className="mx-auto flex w-full flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between lg:px-6"
                style={{ maxWidth }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-texto-suave">{subtitulo}</p>
                  <h1 className="text-xl font-semibold text-tinta">{titulo}</h1>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {acoes}
                  {menuConta}
                </div>
              </div>
            </header>
            <div id="conteudo-principal" className="mx-auto w-full scroll-mt-24 px-4 py-4 lg:px-6 lg:py-5" style={{ maxWidth }}>
              {children}
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={cn('min-h-screen overflow-x-hidden bg-fundo text-tinta', navegacaoMobile.length ? 'pb-20 md:pb-0' : '')}>
      <header className="border-b border-linha bg-white">
        <div
          className="mx-auto flex w-full flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between lg:px-6"
          style={{ maxWidth }}
        >
          <div className="min-w-0">
            {marca ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria text-white">
                  <marca.icone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-texto-suave">{marca.rotulo}</p>
                  <h1 className="text-xl font-semibold">{titulo}</h1>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase text-texto-suave">{subtitulo}</p>
                <h1 className="text-xl font-semibold">{titulo}</h1>
              </>
            )}
            {descricao ? <div className="mt-2 max-w-2xl text-sm text-texto-suave">{descricao}</div> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {acoes}
            {menuConta}
          </div>
        </div>
        {navegacao.length ? (
          <div className="mx-auto w-full px-4 pb-4 lg:px-6" style={{ maxWidth }}>
            <nav
              aria-label={navLabel}
              className={cn(
                'gap-1 overflow-x-auto rounded-lg border border-linha bg-superficie p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                navegacaoMobile.length ? 'hidden md:flex' : 'flex'
              )}
            >
              {navegacao.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium hover:bg-white hover:text-tinta',
                    pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'bg-white text-primaria' : 'text-texto-suave'
                  )}
                >
                  {item.rotulo}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      {navegacaoMobile.length ? (
        <nav
          aria-label={navLabelMobile}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-linha bg-white px-2 py-2 shadow-[0_-1px_3px_rgba(31,41,55,0.08)] md:hidden"
        >
          {navegacaoMobile.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
              className={cn(
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium hover:bg-superficie-hover hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'text-primaria' : 'text-texto-suave'
              )}
            >
              {item.icone ? <item.icone size={18} aria-hidden="true" /> : null}
              <span className="truncate">{item.rotulo}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div id="conteudo-principal" className={cn('mx-auto grid w-full scroll-mt-24 gap-4 px-4 py-5 lg:px-6', navegacaoMobile.length ? 'pb-24 md:pb-5' : '')} style={{ maxWidth }}>
        {children}
      </div>
    </main>
  );
}
