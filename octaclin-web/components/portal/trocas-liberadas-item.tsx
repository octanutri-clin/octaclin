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
}

interface Opcao {
  id?: string;
  descricao: string;
  porcao: string;
  preferida: boolean;
}

export function TrocasLiberadasItem({ item, descricaoPorcao }: TrocasLiberadasItemProps) {
  // `undefined` significa "seguindo o alimento principal", que e o estado em que
  // todo plano publicado comeca.
  const [escolhida, definirEscolhida] = React.useState(item.escolhaAtualSubstituicaoId);
  const [pendente, definirPendente] = React.useState<Opcao | null>(null);
  const [salvando, definirSalvando] = React.useState(false);
  const [erro, definirErro] = React.useState<string | null>(null);
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
  const recolhidas = !expandida && limite !== undefined ? item.substituicoes.length - limite : 0;
  const visiveis = recolhidas > 0 ? opcoes.slice(0, limite! + 1) : opcoes;

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
      <ul className="mt-1 grid gap-1" role="radiogroup" aria-labelledby={`trocas-${item.id}`}>
        {visiveis.map((opcao) => {
          const selecionada = opcao.id === escolhida;
          return (
            <li key={opcao.id ?? 'principal'}>
              <button
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
                  {opcao.preferida ? (
                    <Etiqueta className="ml-1 align-middle">
                      <Star className="h-3 w-3" aria-hidden />
                      Recomendada
                    </Etiqueta>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {recolhidas > 0 ? (
        <Botao
          type="button"
          variante="secundario"
          className="mt-1 print:hidden"
          onClick={() => definirExpandida(true)}
        >
          Ver mais {recolhidas} {recolhidas === 1 ? 'opcao' : 'opcoes'}
        </Botao>
      ) : null}

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
