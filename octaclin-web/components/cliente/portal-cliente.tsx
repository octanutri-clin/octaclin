'use client';

import Link from 'next/link';
import { Building2, CreditCard, ShieldCheck, UsersRound } from 'lucide-react';

const navegacao = [
  { href: '#conta', rotulo: 'Conta' },
  { href: '#assinatura', rotulo: 'Assinatura' },
  { href: '#usuarios', rotulo: 'Usuarios' }
] as const;

const indicadores = [
  { rotulo: 'Unidade ativa', valor: 'Clinica Carla', detalhe: 'Tenant clinica-carla' },
  { rotulo: 'Plano atual', valor: 'Plano gratuito', detalhe: 'Base sem custo para validacao inicial' },
  { rotulo: 'Perfis separados', valor: '3 areas', detalhe: 'Cliente, profissional e paciente' }
] as const;

export function PortalCliente() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-fundo text-tinta">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between lg:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#596273]">Conta OctaClin</p>
            <h1 className="text-xl font-semibold">Portal do cliente</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#596273]">
              Area administrativa da conta, separada das rotinas assistenciais e dos acessos dos pacientes.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 py-2 text-sm font-medium text-[#343c4b]">
            <ShieldCheck className="h-4 w-4 text-primaria" />
            Acesso profissional separado
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-4 lg:px-6">
          <nav aria-label="Navegacao do cliente" className="flex gap-1 overflow-x-auto rounded-lg border border-linha bg-[#f8fafb] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navegacao.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium text-[#596273] hover:bg-white hover:text-tinta"
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1180px] gap-4 px-4 py-5 lg:px-6">
        <section id="conta" className="scroll-mt-4 rounded-lg border border-linha bg-white">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <Building2 className="h-4 w-4 text-[#596273]" />
            <h2 className="text-sm font-semibold">Resumo da conta</h2>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {indicadores.map((indicador) => (
              <article key={indicador.rotulo} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">{indicador.rotulo}</p>
                <p className="mt-1 break-words text-base font-semibold">{indicador.valor}</p>
                <p className="mt-1 text-xs text-[#596273]">{indicador.detalhe}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section id="assinatura" className="scroll-mt-4 rounded-lg border border-linha bg-white">
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <CreditCard className="h-4 w-4 text-[#596273]" />
              <h2 className="text-sm font-semibold">Assinatura</h2>
            </div>
            <div className="grid gap-3 p-4">
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Status</p>
                <p className="mt-1 text-base font-semibold">Plano gratuito</p>
                <p className="mt-1 text-sm text-[#596273]">Ambiente pronto para evoluir cobranca, limites e ciclo de faturamento.</p>
              </article>
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Proxima integracao</p>
                <p className="mt-1 text-sm font-semibold">Gateway de pagamento</p>
              </article>
            </div>
          </section>

          <section id="usuarios" className="scroll-mt-4 rounded-lg border border-linha bg-white">
            <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
              <UsersRound className="h-4 w-4 text-[#596273]" />
              <h2 className="text-sm font-semibold">Usuarios</h2>
            </div>
            <div className="grid gap-3 p-4">
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Gestor da conta</p>
                <p className="mt-1 break-words text-base font-semibold">gestor@octaclin.local</p>
                <p className="mt-1 text-sm text-[#596273]">Permite administrar dados comerciais sem acesso clinico automatico.</p>
              </article>
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Separacao de acesso</p>
                <p className="mt-1 text-sm font-semibold">Profissionais e pacientes usam areas isoladas.</p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
