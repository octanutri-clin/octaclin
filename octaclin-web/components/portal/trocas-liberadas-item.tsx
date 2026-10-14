'use client';

import * as React from 'react';
import { Check, Star } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Aviso } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { registrarEscolhaSubstituicaoPaciente } from '@/lib/portal-api';
import type { ItemPlanoAlimentarPacienteApi } from '@/lib/portal-api';
import { cn } from '@/lib/utils';

interface TrocasLiberadasItemProps {
  item: ItemPlanoAlimentarPacienteApi;
  descricaoPorcao: (quantidade: number, unidade: string, porcaoGramas: number) => string;
  substituicoesExpandidas?: boolean;
  somenteLeitura?: boolean;
}

interface Opcao {
  id?: string;
  descricao: string;
  porcao: string;
  preferida: boolean;
}

export function TrocasLiberadasItem({ item, descricaoPorcao, substituicoesExpandidas, somenteLeitura = false }: TrocasLiberadasItemProps) {
  // `undefined` significa "seguindo o alimento principal", que e o estado em que
  // todo plano publicado comeca.
  const [escolhida, definirEscolhida] = React.useState(item.escolhaAtualSubstituicaoId);
  const [pendente, definirPendente] = React.useState<Opcao | null>(null);
  const [salvando, definirSalvando] = React.useState(false);
  const [erro, definirErro] = React.useState<string | null>(null);
  const [substituicoesAbertas, definirSubstituicoesAbertas] = React.useState(substituicoesExpandidas !== false);
  const [expandida, definirExpandida] = React.useState(false);

  const opcoes: Opcao[] = [
    {
      descricao: item.descricao,
      porcao: descricaoPorcao(item.quantidade, item.unidade, item.porcaoGramas),
      preferida: false
    },
    ...item.substituicoes.map((substituicao) => ({
      id: substituicao.id,
      descricao: substituicao.descricao,
      porcao: descricaoPorcao(substituicao.quantidade, substituicao.unidade, substituicao.porcaoGramas),
      preferida: substituicao.preferida
    }))
  ];

  // O limite conta as alternativas, e nao o principal: o alimento principal
  // sempre aparece, senao o paciente perde a referencia do que esta trocando.
  const limite = item.substituicoesVisiveisInicialmente;
  const recolhidasPorPreferencia = !substituicoesAbertas;
  const visiveisIniciais = recolhidasPorPreferencia
    ? opcoes.slice(0, 1)
    : !expandida && limite !== undefined
      ? opcoes.slice(0, limite! + 1)
      : opcoes;
  // A escolha registrada permanece identificada mesmo quando estiver fora
  // do grupo aberto ou do limite inicial; isso não libera nova alternativa.
  const opcaoEscolhida = opcoes.find((opcao) => opcao.id === escolhida);
  const visiveis = opcaoEscolhida && !visiveisIniciais.includes(opcaoEscolhida)
    ? [...visiveisIniciais, opcaoEscolhida]
    : visiveisIniciais;
  const recolhidas = opcoes.length - visiveis.length;

  async function confirmar() {
    if (!pendente) return;
    definirSalvando(true);
    definirErro(null);
    try {
      await registrarEscolhaSubstituicaoPaciente(item.id, pendente.id);
      definirEscolhida(pendente.id);
      definirPendente(null);
    } catch (falha: unknown) {
      definirErro(
        falha instanceof Error && falha.message ? falha.message : 'Nao foi possivel registrar a troca. Tente novamente.'
      );
    } finally {
      definirSalvando(false);
    }
  }

  if (!item.substituicoes.length) return null;

  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-texto-suave" id={`trocas-${item.id}`}>
        Trocas liberadas
      </p>
      <ul className="mt-1 grid gap-1 print:hidden" role={somenteLeitura ? undefined : 'radiogroup'} aria-labelledby={`trocas-${item.id}`}>
        {visiveis.map((opcao) => {
          const selecionada = opcao.id === escolhida;
          return (
            <li key={opcao.id ?? 'principal'}>
              {somenteLeitura ? (
                <p className={`border px-2 py-1.5 text-xs ${selecionada ? 'border-primaria bg-superficie font-medium text-tinta' : 'border-linha bg-white text-texto-suave'}`}>
                  {opcao.descricao} - {opcao.porcao}{opcao.id === undefined ? ' (alimento principal)' : ''}{opcao.preferida ? ' (recomendada)' : ''}
                  {selecionada ? ' — opção atual' : ''}
                </p>
              ) : <button
                type="button"
                role="radio"
                aria-checked={selecionada}
                disabled={salvando}
                onClick={() => (selecionada ? undefined : definirPendente(opcao))}
                className={cn(
                  'flex w-full items-start gap-2 border px-2 py-1.5 text-left text-xs transition',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                  selecionada
                    ? 'border-primaria bg-superficie font-medium text-tinta'
                    : 'border-linha bg-white text-texto-suave hover:border-primaria'
                )}
              >
                <span aria-hidden className="mt-0.5 shrink-0">
                  {selecionada ? <Check className="h-3.5 w-3.5 text-primaria" /> : <span className="block h-3.5 w-3.5 border border-linha" />}
                </span>
                <span className="min-w-0 break-words">
                  {opcao.descricao} - {opcao.porcao}
                  {opcao.id === undefined ? ' (alimento principal)' : ''}
                  {selecionada ? ' — opção atual' : ''}
                  {opcao.preferida ? (
                    <Etiqueta className="ml-1 align-middle">
                      <Star className="h-3 w-3" aria-hidden />
                      Recomendada
                    </Etiqueta>
                  ) : null}
                </span>
              </button>}
            </li>
          );
        })}
      </ul>

      {recolhidas > 0 ? (
        <Botao
          type="button"
          variante="secundario"
          className="mt-1 print:hidden"
          onClick={() => recolhidasPorPreferencia ? definirSubstituicoesAbertas(true) : definirExpandida(true)}
        >
          {recolhidasPorPreferencia ? `Ver substituições (${recolhidas})` : `Ver mais ${recolhidas} ${recolhidas === 1 ? 'opção' : 'opções'}`}
        </Botao>
      ) : null}

      <ul className="hidden print:grid print:gap-1" aria-label={`Todas as substituições liberadas de ${item.descricao}`}>
        {opcoes.map((opcao) => (
          <li key={opcao.id ?? 'principal'} className="text-xs text-texto-suave">
            {opcao.descricao} — {opcao.porcao}{opcao.id === undefined ? ' (alimento principal)' : ''}{opcao.preferida ? ' (recomendada)' : ''}
            {opcao.id === escolhida ? ' — opção atual' : ''}
          </li>
        ))}
      </ul>

      {erro ? <Aviso variante="erro" mensagem={erro} className="mt-2" aoFechar={() => definirErro(null)} /> : null}

      <Modal
        aberto={pendente !== null}
        aoFechar={() => (salvando ? undefined : definirPendente(null))}
        titulo="Confirmar troca"
        descricao={
          pendente
            ? pendente.id
              ? `Voce vai passar a seguir "${pendente.descricao} - ${pendente.porcao}" no lugar de "${item.descricao}". Seu profissional recebe o registro dessa troca.`
              : `Voce vai voltar ao alimento principal, "${item.descricao}". Seu profissional recebe o registro dessa troca.`
            : undefined
        }
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Botao type="button" variante="secundario" disabled={salvando} onClick={() => definirPendente(null)}>
            Cancelar
          </Botao>
          <Botao type="button" disabled={salvando} onClick={confirmar}>
            {salvando ? 'Registrando...' : 'Confirmar troca'}
          </Botao>
        </div>
      </Modal>
    </div>
  );
}
