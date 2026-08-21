import { CreditCard, Download, RefreshCcw, Search, Smartphone, Undo2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/feedback';
import {
  chaveSolicitacaoAssinatura,
  classeStatusAssinatura,
  formatarData,
  resumirPayload,
  rotuloPlano,
  rotuloStatusAssinatura
} from './formatadores-operacoes';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaFilas({ controlador }: { controlador: PainelOperacoesControlador }) {
  const {
    areaAtiva,
    solicitacoesAssinatura,
    carregandoAssinatura,
    recarregarSolicitacoesAssinatura,
    aplicandoAssinaturaId,
    aplicarPlanoSolicitacao,
    dados,
    falhasPaginadas,
    filtrosOutbox,
    setFiltrosOutbox,
    carregando,
    exportarOutbox,
    filtrarOutbox,
    reprocessandoId,
    reprocessar,
    totalPaginasOutbox,
    trocarPaginaOutbox
  } = controlador;

  if (areaAtiva !== 'filas') return null;

  return (
    <>
      <Cartao hidden={areaAtiva !== 'filas'}>
        <CartaoCabecalho>
          <div className="flex items-center gap-2">
            <CreditCard size={19} className="text-primaria" />
            <h2 className="text-base font-semibold">Assinaturas</h2>
            <span className="text-sm text-texto-suave">{solicitacoesAssinatura?.total ?? 0} solicitações</span>
          </div>
          <Botao type="button" onClick={() => void recarregarSolicitacoesAssinatura()} disabled={carregandoAssinatura}>
            <RefreshCcw size={16} />
            {carregandoAssinatura ? 'Atualizando' : 'Atualizar fila'}
          </Botao>
        </CartaoCabecalho>
        <div className="divide-y divide-linha">
          {solicitacoesAssinatura?.itens.length ? (
            solicitacoesAssinatura.itens.map((solicitacao) => {
              const chave = chaveSolicitacaoAssinatura(solicitacao);
              const planoDestino = solicitacao.planoDesejado ?? solicitacao.planoAtualId;

              return (
                <div key={chave} className="grid gap-3 px-4 py-4 lg:grid-cols-[0.8fr_0.8fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{solicitacao.acao}</strong>
                      <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusAssinatura(solicitacao.status)}`}>
                        {rotuloStatusAssinatura(solicitacao.status)}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-texto-suave">Tenant: {solicitacao.tenantId}</p>
                    <p className="mt-1 text-xs text-texto-suave">{formatarData(solicitacao.solicitadoEm)}</p>
                  </div>
                  <div className="text-sm">
                    <p>
                      <span className="text-texto-suave">Atual: </span>
                      <strong>{solicitacao.planoAtual || rotuloPlano(solicitacao.planoAtualId)}</strong>
                    </p>
                    <p className="mt-1">
                      <span className="text-texto-suave">Desejado: </span>
                      <strong>{rotuloPlano(planoDestino)}</strong>
                    </p>
                  </div>
                  <div className="text-sm text-tinta">
                    <p>{solicitacao.observacao ?? 'Sem observação comercial.'}</p>
                    {solicitacao.resolvidoEm ? (
                      <p className="mt-1 text-xs text-texto-suave">Resolvido em {formatarData(solicitacao.resolvidoEm)}</p>
                    ) : null}
                  </div>
                  <div className="flex justify-start lg:justify-end">
                    {solicitacao.status === 'pendente' ? (
                      <Botao
                        type="button"
                        variante="primario"
                        onClick={() => void aplicarPlanoSolicitacao(solicitacao)}
                        disabled={aplicandoAssinaturaId === chave}
                      >
                        <CreditCard size={16} />
                        {aplicandoAssinaturaId === chave ? 'Aplicando' : `Aplicar ${rotuloPlano(planoDestino)}`}
                      </Botao>
                    ) : (
                      <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                        {solicitacao.planoAplicadoId ? `Plano ${rotuloPlano(solicitacao.planoAplicadoId)}` : 'Sem ação pendente'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <EstadoVazio titulo="Nenhuma solicitação de assinatura carregada." />
          )}
        </div>
      </Cartao>

      <section
        id="operacoes-filas-painel"
        role="tabpanel"
        aria-labelledby="operacoes-filas-aba"
        className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]"
      >
        <Cartao>
          <CartaoCabecalho>
            <div>
              <h2 className="text-base font-semibold">Outbox com falha</h2>
              <span className="text-sm text-texto-suave">{falhasPaginadas?.total ?? dados?.falhas.length ?? 0} eventos</span>
            </div>
            <Botao type="button" onClick={exportarOutbox} disabled={!dados?.falhas.length}>
              <Download size={16} />
              CSV
            </Botao>
          </CartaoCabecalho>
          <form onSubmit={filtrarOutbox} className="grid gap-2 border-b border-linha px-4 py-3 md:grid-cols-4">
            <input
              className="h-9 rounded-md border border-linha px-2 text-sm"
              placeholder="Tipo"
              value={filtrosOutbox.tipo}
              onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, tipo: evento.target.value }))}
            />
            <input
              type="datetime-local"
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosOutbox.inicio}
              onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, inicio: evento.target.value }))}
              aria-label="Início outbox"
            />
            <input
              type="datetime-local"
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosOutbox.fim}
              onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, fim: evento.target.value }))}
              aria-label="Fim outbox"
            />
            <Botao type="submit" disabled={carregando}>
              <Search size={16} />
              Filtrar
            </Botao>
          </form>
          <div className="divide-y divide-linha">
            {dados?.falhas.length ? (
              dados.falhas.map((falha) => (
                <div key={falha.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{falha.tipo}</strong>
                      <span className="rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo">
                        {falha.tentativas} tentativas
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-texto-suave">{falha.erro ?? 'Erro não informado'}</p>
                    <p className="mt-1 break-all text-xs text-texto-suave">{resumirPayload(falha.payload)}</p>
                    <p className="mt-1 text-xs text-texto-suave">{formatarData(falha.criadoEm)}</p>
                  </div>
                  <Botao onClick={() => reprocessar(falha.id)} disabled={reprocessandoId === falha.id}>
                    <Undo2 size={16} />
                    {reprocessandoId === falha.id ? 'Enviando' : 'Reprocessar'}
                  </Botao>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma falha carregada." />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-texto-suave">
              Página {falhasPaginadas?.pagina ?? 1} de {totalPaginasOutbox} | {falhasPaginadas?.total ?? 0} eventos
            </span>
            <div className="flex gap-2">
              <Botao
                type="button"
                onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) - 1)}
                disabled={!falhasPaginadas || falhasPaginadas.pagina <= 1 || carregando}
              >
                Anterior
              </Botao>
              <Botao
                type="button"
                onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) + 1)}
                disabled={!falhasPaginadas || falhasPaginadas.pagina >= totalPaginasOutbox || carregando}
              >
                Próxima
              </Botao>
            </div>
          </div>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <h2 className="text-base font-semibold">Sync mobile</h2>
            <Smartphone size={19} className="text-primaria" />
          </CartaoCabecalho>
          <div className="divide-y divide-linha">
            {dados?.sincronizacoes.length ? (
              dados.sincronizacoes.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{item.tipo}</strong>
                    <span
                      className={
                        item.status === 'sincronizado'
                          ? 'rounded-sm bg-sucesso-suave px-2 py-1 text-xs font-semibold text-sucesso'
                          : 'rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo'
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-texto-suave">{item.idLocal}</p>
                  <p className="mt-1 text-xs text-texto-suave">{item.recursoId ?? item.erro ?? '-'}</p>
                  <p className="mt-1 text-xs text-texto-suave">{formatarData(item.criadoEm)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma sincronizacao carregada." />
            )}
          </div>
        </Cartao>
      </section>
    </>
  );
}
