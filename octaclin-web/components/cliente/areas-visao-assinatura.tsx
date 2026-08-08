'use client';

import { AlertTriangle, Ban, Building2, CheckCircle2, CreditCard, RefreshCcw, Send } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import {
  calcularPercentualSaas,
  descreverAlertaSaas,
  formatarData,
  formatarLimiteSaas,
  recursosSaas,
  rotuloStatusAssinatura
} from './portal-cliente-dominio';
import { PortalClienteController } from './use-portal-cliente';

type Props = { portal: PortalClienteController };

export function AreaVisaoGeralCliente({ portal }: Props) {
  const { areaAtiva, etapasAtivacao, etapasConcluidas, indicadores } = portal;
  if (areaAtiva !== 'ativacao') return null;

  return (
    <div
      id="conta-cliente-ativacao-painel"
      role="tabpanel"
      aria-labelledby="conta-cliente-ativacao-aba"
      className="grid gap-4"
    >
      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo icone={<CheckCircle2 className="h-4 w-4" />}>Ativacao da clinica</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <p className="text-sm text-texto-suave">
            {etapasConcluidas} de {etapasAtivacao.length} etapas concluidas
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {etapasAtivacao.map((etapa) => (
              <div
                key={etapa.rotulo}
                className="flex min-h-11 items-center gap-2 rounded-md border border-linha bg-superficie px-3 text-sm"
              >
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${etapa.concluida ? 'text-sucesso-forte' : 'text-texto-sutil'}`}
                  aria-hidden="true"
                />
                <span>
                  {etapa.rotulo}: {etapa.concluida ? 'concluido' : 'pendente'}
                </span>
              </div>
            ))}
          </div>
        </CartaoConteudo>
      </Cartao>
      <Cartao id="conta" className="scroll-mt-4">
        <CartaoCabecalho>
          <CartaoTitulo icone={<Building2 className="h-4 w-4" />}>Resumo da conta</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-3 md:grid-cols-3">
          {indicadores.map((indicador) => (
            <article key={indicador.rotulo} className="rounded-md border border-linha bg-superficie p-3">
              <p className="text-xs text-texto-suave">{indicador.rotulo}</p>
              <p className="mt-1 break-words text-base font-semibold">{indicador.valor}</p>
              <p className="mt-1 text-xs text-texto-suave">{indicador.detalhe}</p>
            </article>
          ))}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}

export function AreaAssinaturaUsoCliente({ portal }: Props) {
  const {
    areaAtiva,
    resumo,
    bloqueioAssinatura,
    alertasAssinatura,
    planoRecomendado,
    erroAssinatura,
    sucessoAssinatura,
    enviandoAssinatura,
    solicitarAjusteAssinatura
  } = portal;
  if (areaAtiva !== 'assinatura' && areaAtiva !== 'consumo') return null;

  return (
    <Cartao id="assinatura" className="scroll-mt-4">
      <CartaoCabecalho>
        <CartaoTitulo icone={<CreditCard className="h-4 w-4" />}>
          {areaAtiva === 'assinatura' ? 'Assinatura' : 'Consumo'}
        </CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-3">
        {areaAtiva === 'assinatura' ? (
          <article className="rounded-md border border-linha bg-superficie p-3">
            <p className="text-xs text-texto-suave">Status</p>
            <p className="mt-1 text-base font-semibold">{resumo?.assinatura.plano ?? 'Carregando plano'}</p>
            <p className="mt-1 text-sm text-texto-suave">
              {resumo ? `${rotuloStatusAssinatura(resumo.assinatura.status)}.` : 'Atualizando assinatura da conta.'}
            </p>
            {resumo?.assinatura.renovacaoEm ? (
              <p className="mt-1 text-xs font-medium text-texto-forte">
                Renova em {formatarData(resumo.assinatura.renovacaoEm)}
              </p>
            ) : null}
            {bloqueioAssinatura ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-perigo-borda bg-white px-3 py-2 text-sm text-perigo">
                <Ban size={16} className="mt-0.5 shrink-0" />
                <span>Novas acoes estao bloqueadas, mas os dados existentes continuam disponiveis.</span>
              </div>
            ) : null}
          </article>
        ) : null}

        {areaAtiva === 'consumo' ? (
          <div className="grid gap-2">
            {recursosSaas.map((recurso) => {
              const uso = resumo?.assinatura.uso[recurso.chave] ?? 0;
              const limite = resumo?.assinatura.limites[recurso.chave] ?? null;
              const percentual = calcularPercentualSaas(uso, limite);
              const alerta = alertasAssinatura.find((item) => item.recurso === recurso.chave);

              return (
                <article key={recurso.chave} className="rounded-md border border-linha bg-superficie p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{recurso.rotulo}</p>
                      {alerta ? (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            alerta.status === 'excedido' ? 'text-perigo' : 'text-alerta-forte'
                          }`}
                        >
                          {descreverAlertaSaas(alerta.status)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-texto-suave">Dentro do limite</p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {formatarLimiteSaas(uso, limite, recurso.chave)}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${alerta?.status === 'excedido' ? 'bg-perigo' : 'bg-primaria'}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {areaAtiva === 'assinatura' ? (
          <article className="rounded-md border border-linha bg-superficie p-3">
            <p className="text-xs text-texto-suave">Plano recomendado</p>
            <p className="mt-1 text-base font-semibold">{planoRecomendado?.nome ?? 'Carregando recomendacao'}</p>
            <p className="mt-1 text-sm text-texto-suave">
              {planoRecomendado?.detalhe ?? 'Avaliando uso atual da conta.'}
            </p>
            {erroAssinatura ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-perigo-borda bg-white px-3 py-2 text-sm text-perigo">
                <AlertTriangle size={16} />
                {erroAssinatura}
              </div>
            ) : null}
            {sucessoAssinatura ? (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-sucesso-borda bg-white px-3 py-2 text-sm text-sucesso-forte">
                <CheckCircle2 size={16} />
                {sucessoAssinatura}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {planoRecomendado?.id ? (
                <Botao
                  type="button"
                  variante="primario"
                  disabled={Boolean(enviandoAssinatura)}
                  onClick={() => solicitarAjusteAssinatura('upgrade', planoRecomendado.id)}
                  aria-label={`Solicitar upgrade para ${planoRecomendado.nome}`}
                >
                  <Send size={16} />
                  {enviandoAssinatura === 'upgrade'
                    ? 'Enviando'
                    : `Solicitar upgrade para ${planoRecomendado.nome}`}
                </Botao>
              ) : null}
              <Botao
                type="button"
                variante="secundario"
                disabled={Boolean(enviandoAssinatura)}
                onClick={() => solicitarAjusteAssinatura('revisao_limite')}
              >
                <RefreshCcw size={16} />
                {enviandoAssinatura === 'revisao_limite' ? 'Enviando' : 'Pedir revisao de limite'}
              </Botao>
            </div>
          </article>
        ) : null}
      </CartaoConteudo>
    </Cartao>
  );
}
