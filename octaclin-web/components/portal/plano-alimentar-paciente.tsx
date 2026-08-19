'use client';

import { CalendarDays, Printer, Target } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { TrocasLiberadasItem } from '@/components/portal/trocas-liberadas-item';
import type { PlanoAlimentarPacienteApi } from '@/lib/portal-api';

interface PlanoAlimentarPacienteProps {
  plano?: PlanoAlimentarPacienteApi;
}

function formatarNumero(valor: number, casasDecimais = 0) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: casasDecimais,
    minimumFractionDigits: casasDecimais
  }).format(valor);
}

function formatarData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data de publicacao indisponivel';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(data);
}

function descricaoPorcao(quantidade: number, unidade: string, porcaoGramas: number) {
  const quantidadeFormatada = formatarNumero(quantidade, quantidade % 1 === 0 ? 0 : 1);
  const porcao = porcaoGramas > 0 ? ` (${formatarNumero(porcaoGramas)} g)` : '';
  return `${quantidadeFormatada} ${unidade}${porcao}`;
}

export function PlanoAlimentarPaciente({ plano }: PlanoAlimentarPacienteProps) {
  if (!plano) {
    return (
      <Cartao className="print:hidden">
        <CartaoCabecalho>
          <CartaoTitulo icone={<Target className="h-4 w-4" />}>Plano alimentar</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <p className="text-sm text-texto-suave">Seu plano alimentar ainda nao esta disponivel. Quando ele for publicado, aparecera aqui.</p>
        </CartaoConteudo>
      </Cartao>
    );
  }

  const metas = [
    plano.metaEnergeticaKcal !== undefined ? { rotulo: 'Energia', valor: `${formatarNumero(plano.metaEnergeticaKcal)} kcal` } : null,
    plano.macros?.carboidratosG !== undefined ? { rotulo: 'Carboidratos', valor: `${formatarNumero(plano.macros.carboidratosG)} g` } : null,
    plano.macros?.proteinasG !== undefined ? { rotulo: 'Proteinas', valor: `${formatarNumero(plano.macros.proteinasG)} g` } : null,
    plano.macros?.gordurasG !== undefined ? { rotulo: 'Gorduras', valor: `${formatarNumero(plano.macros.gordurasG)} g` } : null
  ].filter((meta): meta is { rotulo: string; valor: string } => meta !== null);

  return (
    <Cartao className="folha-documento print:border-0 print:shadow-none">
      <CartaoCabecalho className="print:block">
        <div className="min-w-0">
          <CartaoTitulo icone={<Target className="h-4 w-4 print:hidden" />}>{plano.titulo}</CartaoTitulo>
          <p className="mt-1 flex items-center gap-1 text-xs text-texto-suave">
            <CalendarDays className="h-3.5 w-3.5 print:hidden" />
            Publicado em {formatarData(plano.publicadoEm)}
          </p>
        </div>
        <Botao type="button" variante="secundario" className="print:hidden" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir ou salvar PDF
        </Botao>
      </CartaoCabecalho>
      <CartaoConteudo className="gap-5 print:gap-4">
        {plano.objetivo ? (
          <section aria-labelledby="objetivo-plano-alimentar">
            <h3 id="objetivo-plano-alimentar" className="text-sm font-semibold text-tinta">Objetivo</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texto-suave">{plano.objetivo}</p>
          </section>
        ) : null}

        {plano.orientacoes ? (
          <section aria-labelledby="orientacoes-plano-alimentar">
            <h3 id="orientacoes-plano-alimentar" className="text-sm font-semibold text-tinta">Orientacoes gerais</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texto-suave">{plano.orientacoes}</p>
          </section>
        ) : null}

        {metas.length ? (
          <section aria-labelledby="metas-plano-alimentar">
            <h3 id="metas-plano-alimentar" className="text-sm font-semibold text-tinta">Metas do plano</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metas.map((meta) => (
                <div key={meta.rotulo} className="border-l-2 border-primaria bg-superficie px-3 py-2">
                  <dt className="text-xs text-texto-suave">{meta.rotulo}</dt>
                  <dd className="mt-1 text-sm font-semibold text-tinta">{meta.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section aria-labelledby="refeicoes-plano-alimentar" className="grid gap-3">
          <h3 id="refeicoes-plano-alimentar" className="text-sm font-semibold text-tinta">Refeicoes</h3>
          {plano.refeicoes.length ? (
            plano.refeicoes.map((refeicao) => (
              <article key={refeicao.id} className="border border-linha bg-superficie p-3 print:break-inside-avoid">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-tinta">{refeicao.nome}</h4>
                  {refeicao.horarioLocal ? <Etiqueta>{refeicao.horarioLocal}</Etiqueta> : null}
                </div>
                {refeicao.orientacoes ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-texto-suave">{refeicao.orientacoes}</p> : null}
                <ul className="mt-3 grid gap-3" aria-label={`Itens de ${refeicao.nome}`}>
                  {refeicao.itens.map((item) => (
                    <li key={item.id} className="border-t border-linha pt-3 first:border-t-0 first:pt-0">
                      <p className="break-words text-sm font-medium text-tinta">{item.descricao}</p>
                      <p className="mt-1 text-xs text-texto-suave">{descricaoPorcao(item.quantidade, item.unidade, item.porcaoGramas)}</p>
                      <TrocasLiberadasItem item={item} descricaoPorcao={descricaoPorcao} />
                    </li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma refeicao foi incluida nesta versao do plano.</p>
          )}
        </section>
      </CartaoConteudo>
    </Cartao>
  );
}
