'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { Etiqueta } from '@/components/ui/etiqueta';
import {
  LIMIAR_DIVERGENCIA_NUTRICIONAL,
  desviosDasMetas,
  totaisPrevistos,
  type DesvioMeta,
  type MetasPrevistas,
  type RefeicaoPrevista
} from '@/lib/nutricao-plano';

const KCAL_POR_GRAMA = { carboidratosG: 4, proteinasG: 4, gordurasG: 9 } as const;

function formatar(valor: number | undefined, casas = 0) {
  if (valor === undefined) return null;
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function percentual(fracao: number) {
  return `${(fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

/**
 * Barra de desvio ancorada na meta. O preenchimento e a leitura secundaria: a
 * frase acima ja diz total, meta e diferenca, para que a informacao nao dependa
 * de cor nem de enxergar a barra.
 */
function BarraDesvio({ desvio }: { desvio: DesvioMeta }) {
  const proporcao = desvio.zerado ? 0 : Math.min(2, desvio.total / desvio.meta);
  const larguraMeta = 50;
  const largura = Math.min(100, (proporcao / 2) * 100);
  const acima = desvio.divergencia > 0;

  return (
    <li className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-sm font-medium text-tinta">{desvio.rotulo}</span>
        <span className="text-xs tabular-nums text-texto-suave">
          {formatar(desvio.total)} de {formatar(desvio.meta)}
          {desvio.zerado ? null : (
            <>
              {' '}
              <span className={desvio.excedeLimiar ? 'font-semibold text-perigo' : 'text-texto-suave'}>
                ({acima ? '+' : '-'}
                {percentual(Math.abs(desvio.divergencia))})
              </span>
            </>
          )}
        </span>
      </div>
      {/* Decorativa de proposito: a linha acima ja diz total, meta e desvio em
          texto. Expor a barra como `role="img"` faria o leitor de tela repetir
          a mesma informacao logo depois de le-la. */}
      <div aria-hidden="true" className="relative h-2 overflow-hidden rounded-full bg-superficie">
        <div
          className={`h-full rounded-full ${desvio.excedeLimiar ? 'bg-perigo' : 'bg-sucesso-forte'}`}
          style={{ width: `${largura}%` }}
        />
        {/* Marca da meta: referencia fixa para ler o desvio sem calcular. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-tinta/40"
          style={{ left: `${larguraMeta}%` }}
        />
      </div>
    </li>
  );
}

export interface PainelNutricionalProps {
  refeicoes: RefeicaoPrevista[];
  pesoTotalGramas: number;
  metas?: MetasPrevistas;
  /**
   * Metas foram calculadas pelo servidor num rascunho salvo. Se o profissional
   * ja mexeu em formula, fator ou ajuste, elas estao desatualizadas e a
   * comparacao precisa dizer isso em vez de fingir precisao.
   */
  metasDesatualizadas?: boolean;
}

export function PainelNutricional({
  refeicoes,
  pesoTotalGramas,
  metas,
  metasDesatualizadas = false
}: PainelNutricionalProps) {
  const [aberto, setAberto] = useState(true);

  // No desktop o painel e uma coluna propria e fica aberto. No mobile ele e uma
  // folha sobre o formulario: abrir cobrindo 60% da tela ao carregar esconderia
  // justamente o que o profissional veio editar, entao ela comeca recolhida.
  // So no efeito, e nao no estado inicial, para o servidor e a hidratacao
  // renderizarem a mesma coisa.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setAberto(false);
  }, []);

  const totais = totaisPrevistos(refeicoes);
  const desvios = metas ? desviosDasMetas(totais, metas) : [];
  const excedentes = desvios.filter((desvio) => desvio.excedeLimiar);

  const energiaDosMacros =
    totais.carboidratosG * KCAL_POR_GRAMA.carboidratosG +
    totais.proteinasG * KCAL_POR_GRAMA.proteinasG +
    totais.gordurasG * KCAL_POR_GRAMA.gordurasG;

  const macros = [
    { rotulo: 'Carboidratos', gramas: totais.carboidratosG, kcalPorGrama: KCAL_POR_GRAMA.carboidratosG },
    { rotulo: 'Proteínas', gramas: totais.proteinasG, kcalPorGrama: KCAL_POR_GRAMA.proteinasG },
    { rotulo: 'Gorduras', gramas: totais.gordurasG, kcalPorGrama: KCAL_POR_GRAMA.gordurasG }
  ];

  return (
    <details
      open={aberto}
      onToggle={(evento) => setAberto((evento.currentTarget as HTMLDetailsElement).open)}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-white shadow-cartao lg:sticky lg:top-4 lg:z-0 lg:rounded-md lg:border"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria [&::-webkit-details-marker]:hidden">
        <span className="grid gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
            Previa nutricional
          </span>
          <span className="text-lg font-semibold tabular-nums text-tinta">
            {formatar(totais.energiaKcal)} kcal
          </span>
        </span>
        <span className="flex items-center gap-2">
          {metas ? (
            excedentes.length ? (
              <Etiqueta variante="perigo" className="gap-1">
                <AlertTriangle aria-hidden="true" size={13} />
                {excedentes.length} desvio{excedentes.length > 1 ? 's' : ''}
              </Etiqueta>
            ) : (
              <Etiqueta variante="sucesso" className="gap-1">
                <CheckCircle2 aria-hidden="true" size={13} />
                Dentro das metas
              </Etiqueta>
            )
          ) : null}
          <ChevronDown
            aria-hidden="true"
            size={18}
            className={`text-texto-suave transition-transform motion-reduce:transition-none ${aberto ? 'rotate-180' : ''}`}
          />
        </span>
        <span className="sr-only">{aberto ? 'Recolher previa nutricional' : 'Expandir previa nutricional'}</span>
      </summary>

      {/* Sem `aria-live` aqui: os totais mudam a cada tecla digitada e uma
          regiao viva deste tamanho faria o leitor de tela reler macros e todas
          as barras de desvio a cada digito. Quem anuncia e so a frase de
          alerta abaixo, que muda apenas ao cruzar o limiar.
          O `pb-20` no mobile deixa o conteudo passar por baixo da barra de
          acoes flutuante em vez de terminar escondido atras dela. */}
      <div className="max-h-[60vh] overflow-y-auto border-t border-linha px-4 pb-20 pt-4 lg:max-h-none lg:pb-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          {macros.map(({ rotulo, gramas, kcalPorGrama }) => (
            <div key={rotulo} className="grid gap-0.5">
              <dt className="text-xs text-texto-suave">{rotulo}</dt>
              <dd className="text-sm font-semibold tabular-nums text-tinta">
                {formatar(gramas, 1)} g
                {energiaDosMacros > 0 ? (
                  <span className="ml-1 font-normal text-texto-suave">
                    {percentual((gramas * kcalPorGrama) / energiaDosMacros)}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
          <div className="grid gap-0.5">
            <dt className="text-xs text-texto-suave">Peso total</dt>
            <dd className="text-sm font-semibold tabular-nums text-tinta">{formatar(pesoTotalGramas, 0)} g</dd>
          </div>
        </dl>

        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-linha pt-3">
          {([
            ['Fibras', totais.fibrasG, 'g'] as const,
            ['Sodio', totais.sodioMg, 'mg'] as const
          ]).map(([rotulo, valor, unidade]) => (
            <div key={rotulo} className="grid gap-0.5">
              <dt className="text-xs text-texto-suave">{rotulo}</dt>
              <dd className="text-sm font-semibold tabular-nums text-tinta">
                {valor === undefined ? (
                  // Um item sem o dado torna o total desconhecido. Exibir zero
                  // afirmaria algo que a fonte nao diz.
                  <span className="font-normal text-texto-suave">Dado incompleto</span>
                ) : (
                  `${formatar(valor, 1)} ${unidade}`
                )}
              </dd>
            </div>
          ))}
        </dl>

        {metas ? (
          <div className="mt-4 grid gap-3 border-t border-linha pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                Comparacao com as metas
              </p>
              <span className="text-xs text-texto-suave">
                Limite de {percentual(LIMIAR_DIVERGENCIA_NUTRICIONAL)}
              </span>
            </div>
            <ul className="grid gap-3">
              {desvios.map((desvio) => (
                <BarraDesvio key={desvio.rotulo} desvio={desvio} />
              ))}
            </ul>
            {excedentes.length ? (
              <p role="status" className="flex gap-2 rounded-md bg-perigo-suave p-2 text-xs text-perigo">
                <AlertTriangle aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                <span>
                  A publicação exige justificativa enquanto houver desvio acima de{' '}
                  {percentual(LIMIAR_DIVERGENCIA_NUTRICIONAL)}.
                </span>
              </p>
            ) : null}
            {metasDesatualizadas ? (
              <p className="flex gap-2 text-xs text-texto-suave">
                <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                <span>Metas da última versão salva. Salve o rascunho para recalcular com os parametros atuais.</span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 flex gap-2 border-t border-linha pt-3 text-xs text-texto-suave">
            <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            <span>Salve o rascunho para o servidor calcular as metas e comparar com estes totais.</span>
          </p>
        )}

        <p className="mt-3 text-xs text-texto-suave">
          Previa calculada nesta tela. O valor oficial e recalculado pelo servidor ao salvar.
        </p>
      </div>
    </details>
  );
}
