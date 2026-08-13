import { Download, History, Scale, Search } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/feedback';
import { FiltrosSolicitacoesLgpd } from '@/lib/operacoes-api';
import {
  classeStatusLgpd,
  formatarData,
  pluralizarItensRetencao,
  rotuloAcaoRetencao,
  rotuloStatusLgpd,
  rotuloTipoLgpd
} from './formatadores-operacoes';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaLgpd({ controlador }: { controlador: PainelOperacoesControlador }) {
  const {
    areaAtiva,
    solicitacoesLgpd,
    filtrosLgpd,
    setFiltrosLgpd,
    carregandoLgpd,
    retencaoDados,
    programandoRetencao,
    programarRetencaoLgpd,
    filtrarLgpd,
    detalheLgpd,
    carregandoDetalheLgpd,
    atualizandoLgpdProtocolo,
    carregarDetalheLgpd,
    atualizarLgpd,
    exportarSolicitacaoLgpd,
    preparandoRespostaProtocolo,
    prepararRespostaLgpd,
    respostaLgpd,
    copiarRespostaLgpd,
    totalPaginasLgpd,
    trocarPaginaLgpd
  } = controlador;

  if (areaAtiva !== 'lgpd') return null;

  return (
    <Cartao
      id="operacoes-lgpd-painel"
      role="tabpanel"
      aria-labelledby="operacoes-lgpd-aba"
    >
      <CartaoCabecalho className="flex-col items-start lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Scale size={19} className="text-primaria" />
          <h2 className="text-base font-semibold">Solicitacoes LGPD</h2>
          <span className="text-sm text-texto-suave">{solicitacoesLgpd?.total ?? 0} protocolos</span>
        </div>
        <form onSubmit={filtrarLgpd} className="grid gap-2 md:grid-cols-3">
          <select
            className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
            value={filtrosLgpd.status}
            onChange={(evento) =>
              setFiltrosLgpd((atual) => ({ ...atual, status: evento.target.value as FiltrosSolicitacoesLgpd['status'] }))
            }
            aria-label="Status LGPD"
          >
            <option value="">Todos os status</option>
            <option value="recebida">Recebida</option>
            <option value="em_tratamento">Em tratamento</option>
            <option value="concluida">Concluida</option>
            <option value="indeferida">Indeferida</option>
          </select>
          <select
            className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
            value={filtrosLgpd.tipo}
            onChange={(evento) =>
              setFiltrosLgpd((atual) => ({ ...atual, tipo: evento.target.value as FiltrosSolicitacoesLgpd['tipo'] }))
            }
            aria-label="Tipo LGPD"
          >
            <option value="">Todos os tipos</option>
            <option value="retificacao">Retificacao</option>
            <option value="exclusao">Exclusao</option>
          </select>
          <Botao type="submit" disabled={carregandoLgpd}>
            <Search size={16} />
            {carregandoLgpd ? 'Filtrando' : 'Filtrar'}
          </Botao>
        </form>
      </CartaoCabecalho>
      <div className="border-b border-linha bg-superficie px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold">Retencao e exclusao programada</h3>
            <p className="mt-1 text-sm text-texto-suave">
              {pluralizarItensRetencao(retencaoDados?.resumo.totalVencidos ?? 0)} | Politica {retencaoDados?.versao ?? '-'}
            </p>
          </div>
          <Botao type="button" variante="primario" onClick={() => void programarRetencaoLgpd()} disabled={programandoRetencao}>
            <History size={16} />
            {programandoRetencao ? 'Programando' : 'Programar retencao LGPD'}
          </Botao>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {retencaoDados?.resumo.itens.length ? (
            retencaoDados.resumo.itens.map((item) => {
              const politica = retencaoDados.politicas.find((politicaAtual) => politicaAtual.id === item.politicaId);

              return (
                <article key={item.politicaId} className="rounded-md border border-linha bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{item.rotulo}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                      {rotuloAcaoRetencao(item.acao)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-tinta">{politica?.descricao ?? 'Politica operacional cadastrada.'}</p>
                  <p className="mt-2 text-xs text-texto-suave">
                    {item.vencidos} vencidos desde {formatarData(item.corteEm)} | {item.diasRetencao} dias
                  </p>
                </article>
              );
            })
          ) : (
            <EstadoVazio titulo="Nenhuma politica de retencao carregada." />
          )}
        </div>
      </div>
      <div className="divide-y divide-linha">
        {solicitacoesLgpd?.itens.length ? (
          solicitacoesLgpd.itens.map((solicitacao) => (
            <div key={solicitacao.protocolo} className="grid gap-3 px-4 py-4 lg:grid-cols-[0.9fr_1fr_0.75fr_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{solicitacao.protocolo}</strong>
                  <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusLgpd(solicitacao.status)}`}>
                    {rotuloStatusLgpd(solicitacao.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-texto-suave">{rotuloTipoLgpd(solicitacao.tipo)}</p>
                <p className="mt-1 break-all text-xs text-texto-suave">Paciente: {solicitacao.pacienteId}</p>
              </div>
              <div>
                <p className="text-sm text-tinta">{solicitacao.detalhes ?? 'Sem detalhes informados.'}</p>
                <p className="mt-1 text-xs text-texto-suave">
                  Ultima tratativa: {solicitacao.ultimaTratativa ?? 'Sem tratativa registrada.'}
                </p>
              </div>
              <div className="text-xs text-texto-suave">
                <p>Aberta: {formatarData(solicitacao.abertoEm)}</p>
                <p className="mt-1">Atualizada: {formatarData(solicitacao.atualizadoEm)}</p>
                <p className="mt-1 break-all">Responsavel: {solicitacao.responsavelId ?? '-'}</p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Botao
                  type="button"
                  onClick={() => void carregarDetalheLgpd(solicitacao.protocolo)}
                  disabled={carregandoDetalheLgpd && detalheLgpd?.protocolo === solicitacao.protocolo}
                  aria-label={`Ver detalhes ${solicitacao.protocolo}`}
                >
                  {carregandoDetalheLgpd && detalheLgpd?.protocolo === solicitacao.protocolo ? 'Carregando' : 'Ver detalhes'}
                </Botao>
                {solicitacao.status === 'recebida' ? (
                  <Botao
                    type="button"
                    onClick={() => void atualizarLgpd(solicitacao.protocolo, 'em_tratamento')}
                    disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                  >
                    {atualizandoLgpdProtocolo === solicitacao.protocolo ? 'Atualizando' : 'Iniciar tratativa'}
                  </Botao>
                ) : null}
                {solicitacao.status !== 'concluida' ? (
                  <Botao
                    type="button"
                    variante="primario"
                    onClick={() => void atualizarLgpd(solicitacao.protocolo, 'concluida')}
                    disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                  >
                    Concluir
                  </Botao>
                ) : null}
                {solicitacao.status !== 'indeferida' && solicitacao.status !== 'concluida' ? (
                  <Botao
                    type="button"
                    variante="perigo"
                    onClick={() => void atualizarLgpd(solicitacao.protocolo, 'indeferida')}
                    disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                  >
                    Indeferir
                  </Botao>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EstadoVazio titulo="Nenhuma solicitacao LGPD carregada." />
        )}
      </div>
      {detalheLgpd ? (
        <div className="border-t border-linha bg-superficie px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-semibold">Detalhe do protocolo {detalheLgpd.protocolo}</h3>
              <p className="mt-1 text-sm text-texto-suave">
                {rotuloTipoLgpd(detalheLgpd.tipo)} | {rotuloStatusLgpd(detalheLgpd.status)} | Paciente {detalheLgpd.pacienteId}
              </p>
            </div>
            <Botao
              type="button"
              onClick={() => exportarSolicitacaoLgpd(detalheLgpd.protocolo)}
              aria-label={`Exportar protocolo ${detalheLgpd.protocolo}`}
            >
              <Download size={16} />
              CSV
            </Botao>
            <Botao
              type="button"
              variante="primario"
              onClick={() => void prepararRespostaLgpd(detalheLgpd.protocolo)}
              disabled={preparandoRespostaProtocolo === detalheLgpd.protocolo}
              aria-label={`Preparar resposta ${detalheLgpd.protocolo}`}
            >
              {preparandoRespostaProtocolo === detalheLgpd.protocolo ? 'Preparando' : 'Preparar resposta'}
            </Botao>
          </div>
          <div className="mt-4 grid gap-3">
            {detalheLgpd.historico.map((evento) => (
              <article key={evento.id} className="rounded-md border border-linha bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{evento.tipo}</strong>
                    <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusLgpd(evento.status)}`}>
                      {rotuloStatusLgpd(evento.status)}
                    </span>
                  </div>
                  <span className="text-xs text-texto-suave">{formatarData(evento.criadoEm)}</span>
                </div>
                <p className="mt-2 text-sm text-tinta">{evento.detalhes ?? 'Sem detalhes.'}</p>
                <p className="mt-1 break-all text-xs text-texto-suave">Responsavel: {evento.responsavelId ?? '-'}</p>
              </article>
            ))}
          </div>
          {respostaLgpd ? (
            <div className="mt-4 rounded-md border border-linha bg-white p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold">Resposta ao paciente</h3>
                  <p className="mt-1 text-xs text-texto-suave">
                    Canais sugeridos: {respostaLgpd.canaisSugeridos.join(', ')}
                  </p>
                </div>
                <Botao
                  type="button"
                  onClick={() => void copiarRespostaLgpd(respostaLgpd)}
                  aria-label={`Copiar resposta ${respostaLgpd.protocolo}`}
                >
                  Copiar resposta
                </Botao>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-linha bg-superficie p-3">
                  <p className="text-xs font-semibold text-texto-suave">Email</p>
                  <p className="mt-1 text-sm font-semibold">{respostaLgpd.assuntoEmail}</p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-texto-suave">{respostaLgpd.corpoEmail}</pre>
                </div>
                <div className="rounded-md border border-linha bg-superficie p-3">
                  <p className="text-xs font-semibold text-texto-suave">WhatsApp</p>
                  <p className="mt-2 break-words text-sm text-tinta">{respostaLgpd.textoWhatsapp}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-texto-suave">
          Pagina {solicitacoesLgpd?.pagina ?? 1} de {totalPaginasLgpd} | {solicitacoesLgpd?.total ?? 0} protocolos
        </span>
        <div className="flex gap-2">
          <Botao
            type="button"
            onClick={() => void trocarPaginaLgpd((solicitacoesLgpd?.pagina ?? 1) - 1)}
            disabled={!solicitacoesLgpd || solicitacoesLgpd.pagina <= 1 || carregandoLgpd}
          >
            Anterior
          </Botao>
          <Botao
            type="button"
            onClick={() => void trocarPaginaLgpd((solicitacoesLgpd?.pagina ?? 1) + 1)}
            disabled={!solicitacoesLgpd || solicitacoesLgpd.pagina >= totalPaginasLgpd || carregandoLgpd}
          >
            Proxima
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}
