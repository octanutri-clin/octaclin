'use client';

import { useId } from 'react';
import type { PreferenciasExibicaoRefeicoesApi } from '@/lib/preferencias-apresentacao-plano';

const campos: Array<{ chave: keyof PreferenciasExibicaoRefeicoesApi; rotulo: string; ajuda: string }> = [
  { chave: 'horario', rotulo: 'Horários', ajuda: 'Exibe o horário informado para cada refeição.' },
  { chave: 'macros', rotulo: 'Metas de macronutrientes', ajuda: 'Exibe as metas já calculadas ou registradas no plano.' },
  { chave: 'medidasCaseiras', rotulo: 'Medidas caseiras', ajuda: 'Exibe quantidade e unidade junto do peso em gramas.' },
  { chave: 'orientacoes', rotulo: 'Orientações', ajuda: 'Exibe as orientações gerais e de cada refeição.' },
  { chave: 'substituicoesExpandidas', rotulo: 'Substituições abertas inicialmente', ajuda: 'Quando desligado, as alternativas liberadas começam recolhidas e podem ser abertas.' },
  { chave: 'modoCompacto', rotulo: 'Modo compacto', ajuda: 'Reduz o espaçamento visual sem alterar o conteúdo do plano.' }
];

export function PreferenciasApresentacaoPlano({
  profissional,
  paciente,
  aoAlterar,
  desabilitado = false,
  refeicoes,
  metas
}: {
  profissional: PreferenciasExibicaoRefeicoesApi;
  paciente: PreferenciasExibicaoRefeicoesApi;
  aoAlterar: (conjunto: 'profissional' | 'paciente', campo: keyof PreferenciasExibicaoRefeicoesApi, valor: boolean) => void;
  desabilitado?: boolean;
  refeicoes: Array<{
    chaveCliente: string;
    nome: string;
    horarioLocal?: string;
    orientacoes?: string;
    itens: Array<{
      chaveCliente: string;
      descricao: string;
      quantidade: number | string;
      unidade: string;
      porcaoGramas: number | string;
      substituicoes: Array<{ chaveCliente: string; descricao: string; quantidade: number | string; unidade: string; porcaoGramas: number | string; preferida: boolean }>;
    }>;
  }>;
  metas?: { carboidratosG: number; proteinasG: number; gordurasG: number; energiaKcal: number };
}) {
  const id = useId();
  const conjuntos = [
    { chave: 'profissional' as const, rotulo: 'Visualização do profissional', valores: profissional },
    { chave: 'paciente' as const, rotulo: 'Portal e impressão/PDF do paciente', valores: paciente }
  ];

  return (
    <section data-pa05-preferencias className="grid gap-3 rounded-md border border-linha bg-white p-4" aria-labelledby={`${id}-titulo`}>
      <div>
        <h3 id={`${id}-titulo`} className="text-base font-semibold text-tinta">Preferências de exibição</h3>
        <p className="mt-1 text-sm text-texto-suave">Controlam somente a apresentação. Não alteram alimentos, quantidades, cálculos, liberações ou escolhas registradas.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {conjuntos.map((conjunto) => (
          <fieldset key={conjunto.chave} className="grid content-start gap-3 rounded-md border border-linha p-3">
            <legend className="px-1 text-sm font-semibold text-tinta">{conjunto.rotulo}</legend>
            {campos.map((campo, indice) => {
              const campoId = `${id}-${conjunto.chave}-${indice}`;
              return (
                <div key={campo.chave} className="grid gap-0.5">
                  <label htmlFor={campoId} className="flex min-h-11 items-center gap-2 text-sm font-medium text-tinta">
                    <input
                      id={campoId}
                      type="checkbox"
                      checked={conjunto.valores[campo.chave]}
                      disabled={desabilitado}
                      onChange={(evento) => aoAlterar(conjunto.chave, campo.chave, evento.target.checked)}
                    />
                    {campo.rotulo}
                  </label>
                  <p className="pl-6 text-xs text-texto-suave">{campo.ajuda}</p>
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      <section className="grid gap-3 border-t border-linha pt-3" aria-label="Prévia profissional">
        <div>
          <h4 className="text-sm font-semibold text-tinta">Prévia profissional</h4>
          <p className="text-xs text-texto-suave">Prévia local do rascunho, sem alterar os campos de edição e validação acima.</p>
        </div>
        {profissional.macros && metas ? (
          <dl className={`grid grid-cols-2 ${profissional.modoCompacto ? 'gap-1' : 'gap-2'} sm:grid-cols-4`}>
            {[
              ['Energia', `${metas.energiaKcal.toLocaleString('pt-BR')} kcal`],
              ['Carboidratos', `${metas.carboidratosG.toLocaleString('pt-BR')} g`],
              ['Proteínas', `${metas.proteinasG.toLocaleString('pt-BR')} g`],
              ['Gorduras', `${metas.gordurasG.toLocaleString('pt-BR')} g`]
            ].map(([rotulo, valor]) => <div key={rotulo} className="rounded bg-superficie px-2 py-1"><dt className="text-xs text-texto-suave">{rotulo}</dt><dd className="text-sm font-medium text-tinta">{valor}</dd></div>)}
          </dl>
        ) : null}
        <div className={`grid ${profissional.modoCompacto ? 'gap-2' : 'gap-3'}`}>
          {refeicoes.map((refeicao) => (
            <article key={refeicao.chaveCliente} className="border border-linha bg-superficie p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h5 className="text-sm font-semibold text-tinta">{refeicao.nome || 'Refeição sem nome'}</h5>
                {profissional.horario && refeicao.horarioLocal ? <span className="text-xs text-texto-suave">{refeicao.horarioLocal}</span> : null}
              </div>
              {profissional.orientacoes && refeicao.orientacoes ? <p className="mt-1 whitespace-pre-wrap text-xs text-texto-suave">{refeicao.orientacoes}</p> : null}
              <ul className="mt-2 grid gap-1">
                {refeicao.itens.map((item) => (
                  <li key={item.chaveCliente} className="text-xs text-tinta">
                    <span className="font-medium">{item.descricao || 'Alimento sem descrição'}</span>
                    {profissional.medidasCaseiras ? ` — ${item.quantidade.toLocaleString('pt-BR')} ${item.unidade}` : ''} ({item.porcaoGramas.toLocaleString('pt-BR')} g)
                    {item.substituicoes.length ? (
                      <details className="mt-1 pl-3 text-texto-suave" open={profissional.substituicoesExpandidas || undefined}>
                        <summary className="cursor-pointer">Substituições ({item.substituicoes.length})</summary>
                        <ul className="mt-1 grid gap-1">{item.substituicoes.map((substituicao) => <li key={substituicao.chaveCliente}>{substituicao.descricao}{profissional.medidasCaseiras ? ` — ${substituicao.quantidade.toLocaleString('pt-BR')} ${substituicao.unidade}` : ''} ({substituicao.porcaoGramas.toLocaleString('pt-BR')} g){substituicao.preferida ? ' · recomendada' : ''}</li>)}</ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
