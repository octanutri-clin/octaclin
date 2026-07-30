'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Botao } from '@/components/ui/botao';
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

interface PortalShellProps {
  variante: 'sidebar' | 'tabs';
  marca?: MarcaShell;
  titulo: string;
  subtitulo: string;
  descricao?: ReactNode;
  navegacao: ItemNavegacaoShell[];
  navLabel?: string;
  navegacaoMobile?: ItemNavegacaoShell[];
  navLabelMobile?: string;
  acoes?: ReactNode;
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
  navLabel = 'Modulos',
  navegacaoMobile = [],
  navLabelMobile = 'Navegacao mobile',
  acoes,
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

  if (variante === 'sidebar') {
    return (
      <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
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
              {navegacao.map((item, indice) => {
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
                  {botaoSair}
                </div>
              </div>
            </header>
            <div className="mx-auto w-full px-4 py-4 lg:px-6 lg:py-5" style={{ maxWidth }}>
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
            {botaoSair}
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
                  className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium text-texto-suave hover:bg-white hover:text-tinta"
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
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium text-texto-suave hover:bg-superficie-hover hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
            >
              {item.icone ? <item.icone size={18} aria-hidden="true" /> : null}
              <span className="truncate">{item.rotulo}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className={cn('mx-auto grid w-full gap-4 px-4 py-5 lg:px-6', navegacaoMobile.length ? 'pb-24 md:pb-5' : '')} style={{ maxWidth }}>
        {children}
      </div>
    </main>
  );
}
