'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Fragment, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu as MenuIcon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Botao } from '@/components/ui/botao';
import { Esqueleto } from '@/components/ui/feedback';
import { Menu } from '@/components/ui/menu';
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
    <Menu
      className="w-72 p-3"
      gatilho={
        <button
          type="button"
          aria-label={`Abrir menu da conta: ${contextoUsuario.email}, ${contextoUsuario.papel}`}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-md border border-linha bg-white px-2 text-left text-sm transition-colors',
            'hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria'
          )}
        >
          <Avatar id={contextoUsuario.email} nome={contextoUsuario.email} tamanho="sm" />
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-44 truncate text-xs font-semibold text-tinta">{contextoUsuario.email}</span>
            <span className="block text-xs text-texto-suave">{contextoUsuario.papel}</span>
          </span>
          <ChevronDown size={15} className="text-texto-suave" aria-hidden="true" />
        </button>
      }
    >
      <p className="px-1 text-xs font-semibold uppercase text-texto-sutil">Workspace</p>
      <p className="mt-1 truncate px-1 text-sm font-semibold text-tinta">{contextoUsuario.workspace}</p>
      <p className="mt-3 truncate px-1 text-sm text-texto-suave">{contextoUsuario.email}</p>
      <p className="px-1 text-xs text-texto-sutil">{contextoUsuario.papel}</p>
      <div className="mt-3 border-t border-linha pt-2">{botaoSair}</div>
    </Menu>
  ) : botaoSair;

  if (variante === 'sidebar') {
    const itemAtivo = navegacao.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    const renderizarItensNavegacao = (modo: 'mobile' | 'desktop') => navegacao.map((item, indice) => {
      const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Fragment key={`${modo}-${item.href}`}>
          {item.grupo && item.grupo !== navegacao[indice - 1]?.grupo ? (
            <p className={cn(
              'px-3 pt-3 text-xs font-semibold uppercase text-neutro-500 first:pt-0',
              modo === 'desktop' ? 'hidden lg:block' : ''
            )}>
              {item.grupo}
            </p>
          ) : null}
          <Link
            href={item.href as Route}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-md border-l-[3px] px-3 text-sm font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
              modo === 'desktop' ? 'shrink-0' : 'w-full',
              ativo
                ? 'border-l-primaria bg-white/10 text-white'
                : 'border-l-transparent text-neutro-400 hover:bg-white/5 hover:text-white'
            )}
          >
            {item.icone ? <item.icone size={17} className="shrink-0" aria-hidden="true" /> : null}
            <span className="whitespace-nowrap">{item.rotulo}</span>
          </Link>
        </Fragment>
      );
    });

    return (
      <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
        <a
          href="#conteudo-principal"
          className="fixed left-3 top-3 z-[60] -translate-y-20 rounded-md bg-tinta px-3 py-2 text-sm font-semibold text-white focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        <div className="grid min-h-screen min-w-0 lg:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="sticky top-0 z-20 min-w-0 overflow-hidden bg-neutro-900 text-white lg:h-screen lg:overflow-visible">
            {marca ? (
              <div className="flex items-center gap-2 px-3 py-2.5 lg:px-4 lg:py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primaria text-white">
                  <marca.icone size={19} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{marca.rotulo}</p>
                  <p className="text-xs text-neutro-400">{marca.subrotulo}</p>
                </div>
              </div>
            ) : null}
            <details className="group border-t border-neutro-800 lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primaria [&::-webkit-details-marker]:hidden">
                <MenuIcon size={18} aria-hidden="true" />
                <span>Módulos</span>
                <span className="ml-auto truncate text-xs font-medium text-neutro-400">{itemAtivo?.rotulo ?? 'Escolha uma área'}</span>
                <ChevronDown size={16} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <nav aria-label={`${navLabel} no celular`} className="grid max-h-[65vh] gap-1 overflow-y-auto px-2 pb-3">
                {navegacaoCarregando ? (
                  <div className="grid gap-2 px-1 py-1" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, indice) => <Esqueleto key={indice} className="h-11 w-full" />)}
                  </div>
                ) : renderizarItensNavegacao('mobile')}
              </nav>
            </details>
            <nav
              aria-label={navLabel}
              className="hidden min-w-0 max-w-full gap-1 border-t border-neutro-800 px-2 py-3 lg:grid"
            >
              {navegacaoCarregando ? (
                <div className="grid min-w-56 gap-2 px-1 py-1 lg:min-w-0" aria-hidden="true">
                  {Array.from({ length: 4 }, (_, indice) => <Esqueleto key={indice} className="h-11 w-full" />)}
                </div>
              ) : renderizarItensNavegacao('desktop')}
            </nav>
          </aside>

          <section className="min-w-0">
            <header className="border-b border-linha bg-white">
              <div
                className="mx-auto flex w-full flex-col gap-3 px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between lg:px-5"
                style={{ maxWidth }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-texto-suave">{subtitulo}</p>
                  <h1 className="text-xl font-semibold text-tinta [text-wrap:balance]">{titulo}</h1>
                </div>
                <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
                  {acoes}
                  {menuConta}
                </div>
              </div>
            </header>
            <div id="conteudo-principal" className="mx-auto w-full scroll-mt-24 px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5" style={{ maxWidth }}>
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
