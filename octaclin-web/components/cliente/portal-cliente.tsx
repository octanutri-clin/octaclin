'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CreditCard, ShieldCheck, UsersRound } from 'lucide-react';
import { obterResumoPortalCliente, ResumoPortalClienteApi } from '@/lib/cliente-api';

const navegacao = [
  { href: '#conta', rotulo: 'Conta' },
  { href: '#assinatura', rotulo: 'Assinatura' },
  { href: '#usuarios', rotulo: 'Usuarios' }
] as const;

function formatarQuantidade(valor: number, singular: string, plural: string) {
  return `${valor} ${valor === 1 ? singular : plural}`;
}

export function PortalCliente() {
  const [resumo, setResumo] = useState<ResumoPortalClienteApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    void obterResumoPortalCliente()
      .then((dados) => {
        if (!ativo) return;
        setResumo(dados);
      })
      .catch((erroAtual) => {
        if (!ativo) return;
        setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar conta.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const indicadores = useMemo(
    () => [
      {
        rotulo: 'Unidade ativa',
        valor: resumo?.conta.nome ?? 'Carregando conta',
        detalhe: resumo ? resumo.conta.slug : 'Atualizando dados da conta'
      },
      {
        rotulo: 'Plano atual',
        valor: resumo?.assinatura.plano ?? 'Carregando plano',
        detalhe: resumo ? `Status ${resumo.assinatura.status}` : 'Validando assinatura'
      },
      {
        rotulo: 'Usuarios ativos',
        valor: resumo ? formatarQuantidade(resumo.usuarios.totalAtivos, 'usuario ativo', 'usuarios ativos') : 'Carregando usuarios',
        detalhe: resumo
          ? `${formatarQuantidade(resumo.usuarios.clientes, 'cliente', 'clientes')} na conta`
          : 'Separando perfis'
      }
    ],
    [resumo]
  );

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
            {resumo ? <p className="mt-2 break-words text-sm font-medium text-[#343c4b]">{resumo.conta.nome}</p> : null}
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

      <section className="mx-auto grid w-full max-w-[1180px] gap-4 px-4 py-5 lg:px-6" aria-busy={carregando}>
        {erro ? (
          <section className="flex items-start gap-3 rounded-lg border border-[#efb8ad] bg-white p-4" aria-live="polite">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fff4f1] text-perigo">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Conta indisponivel</h2>
              <p className="mt-1 break-words text-sm text-[#596273]">{erro}</p>
            </div>
          </section>
        ) : null}

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
                <p className="mt-1 text-base font-semibold">{resumo?.assinatura.plano ?? 'Carregando plano'}</p>
                <p className="mt-1 text-sm text-[#596273]">
                  {resumo ? `Assinatura ${resumo.assinatura.status} com origem ${resumo.assinatura.origem}.` : 'Atualizando assinatura da conta.'}
                </p>
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
                <p className="mt-1 break-words text-base font-semibold">{resumo?.acesso.usuarioId ?? 'Carregando usuario'}</p>
                <p className="mt-1 text-sm text-[#596273]">
                  {resumo ? `${resumo.acesso.papel} com escopo ${resumo.acesso.escopoDados}.` : 'Validando escopo da sessao.'}
                </p>
              </article>
              <article className="rounded-md border border-linha bg-[#f8fafb] p-3">
                <p className="text-xs text-[#596273]">Separacao de acesso</p>
                <p className="mt-1 text-sm font-semibold">
                  {resumo
                    ? `${formatarQuantidade(resumo.usuarios.profissionais, 'profissional', 'profissionais')} e ${formatarQuantidade(
                        resumo.usuarios.pacientes,
                        'paciente',
                        'pacientes'
                      )}`
                    : 'Profissionais e pacientes usam areas isoladas.'}
                </p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
