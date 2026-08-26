import { AlertTriangle, Search, Undo2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/feedback';
import { FiltrosFalhasComunicacao } from '@/lib/operacoes-api';
import { formatarData, rotuloCanalFalha, rotuloOrigemFalha } from './formatadores-operacoes';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaComunicacoes({ controlador }: { controlador: PainelOperacoesControlador }) {
  const {
    areaAtiva,
    falhasComunicacao,
    filtrosFalhasComunicacao,
    setFiltrosFalhasComunicacao,
    carregando,
    reprocessandoComunicacaoId,
    totalPaginasFalhasComunicacao,
    filtrarFalhasComunicacao,
    reprocessarComunicacao,
    trocarPaginaFalhasComunicacao
  } = controlador;

  if (areaAtiva !== 'comunicacoes') return null;

  return (
    <Cartao
      id="operacoes-comunicacoes-painel"
      role="tabpanel"
      aria-labelledby="operacoes-comunicacoes-aba"
    >
      <CartaoCabecalho className="flex-col items-start md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={19} className="text-perigo" />
            <h2 className="text-base font-semibold">Central de comunicação</h2>
            <span className="text-sm text-texto-suave">{falhasComunicacao?.total ?? 0} falhas</span>
          </div>
          <p className="mt-1 text-xs text-texto-suave">
            E-mail {falhasComunicacao?.resumo.email ?? 0} | WhatsApp {falhasComunicacao?.resumo.whatsapp ?? 0} | Google Calendar{' '}
            {falhasComunicacao?.resumo.googleCalendar ?? 0} | Outbox {falhasComunicacao?.resumo.outbox ?? 0}
          </p>
        </div>
        <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria-forte">
          {falhasComunicacao?.resumo.reprocessaveis ?? 0} reprocessaveis
        </span>
      </CartaoCabecalho>
      <form onSubmit={filtrarFalhasComunicacao} className="grid gap-2 border-b border-linha px-4 py-3 lg:grid-cols-[0.8fr_0.8fr_1fr_1fr_1fr_auto]">
        <select
          className="h-9 rounded-md border border-linha px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          value={filtrosFalhasComunicacao.origem}
          onChange={(evento) =>
            setFiltrosFalhasComunicacao((atual) => ({ ...atual, origem: evento.target.value as FiltrosFalhasComunicacao['origem'] }))
          }
          aria-label="Origem da falha"
        >
          <option value="">Origem</option>
          <option value="mensagem">Mensagem</option>
          <option value="outbox">Outbox</option>
          <option value="google_calendar">Google Calendar</option>
        </select>
        <select
          className="h-9 rounded-md border border-linha px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          value={filtrosFalhasComunicacao.canal}
          onChange={(evento) =>
            setFiltrosFalhasComunicacao((atual) => ({ ...atual, canal: evento.target.value as FiltrosFalhasComunicacao['canal'] }))
          }
          aria-label="Canal da falha"
        >
          <option value="">Canal</option>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="google_calendar">Google Calendar</option>
          <option value="outbox">Outbox</option>
        </select>
        <input
          className="h-9 rounded-md border border-linha px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          placeholder="Tipo/evento"
          value={filtrosFalhasComunicacao.tipo}
          onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, tipo: evento.target.value }))}
        />
        <input
          type="datetime-local"
          className="h-9 rounded-md border border-linha px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          value={filtrosFalhasComunicacao.inicio}
          onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, inicio: evento.target.value }))}
          aria-label="Início falhas comunicação"
        />
        <input
          type="datetime-local"
          className="h-9 rounded-md border border-linha px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          value={filtrosFalhasComunicacao.fim}
          onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, fim: evento.target.value }))}
          aria-label="Fim falhas comunicação"
        />
        <Botao type="submit" disabled={carregando}>
          <Search size={16} />
          Filtrar
        </Botao>
      </form>
      <div className="divide-y divide-linha">
        {falhasComunicacao?.itens.length ? (
          falhasComunicacao.itens.map((falha) => (
            <div key={falha.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_0.8fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{falha.tipo}</strong>
                  <span className="rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo">
                    {rotuloCanalFalha(falha.canal)}
                  </span>
                  <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria-forte">
                    {rotuloOrigemFalha(falha.origem)}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm text-texto-suave">{falha.erro ?? 'Erro não informado'}</p>
                <p className="mt-1 break-all text-xs text-texto-suave">{falha.resumo ?? falha.referenciaId}</p>
              </div>
              <div className="text-xs text-texto-suave">
                <p className="break-all">Referencia: {falha.referenciaId}</p>
                <p className="mt-1">Criado em {formatarData(falha.criadoEm)}</p>
                {falha.tentativas !== undefined ? <p className="mt-1">{falha.tentativas} tentativas</p> : null}
              </div>
              <Botao
                type="button"
                onClick={() => void reprocessarComunicacao(falha.id)}
                disabled={!falha.reprocessavel || reprocessandoComunicacaoId === falha.id}
              >
                <Undo2 size={16} />
                {reprocessandoComunicacaoId === falha.id ? 'Enviando' : 'Reprocessar'}
              </Botao>
            </div>
          ))
        ) : (
          <EstadoVazio titulo="Nenhuma falha de comunicação carregada." />
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-texto-suave">
          Página {falhasComunicacao?.pagina ?? 1} de {totalPaginasFalhasComunicacao} | {falhasComunicacao?.total ?? 0} falhas
        </span>
        <div className="flex gap-2">
          <Botao
            type="button"
            onClick={() => void trocarPaginaFalhasComunicacao((falhasComunicacao?.pagina ?? 1) - 1)}
            disabled={!falhasComunicacao || falhasComunicacao.pagina <= 1 || carregando}
          >
            Anterior
          </Botao>
          <Botao
            type="button"
            onClick={() => void trocarPaginaFalhasComunicacao((falhasComunicacao?.pagina ?? 1) + 1)}
            disabled={!falhasComunicacao || falhasComunicacao.pagina >= totalPaginasFalhasComunicacao || carregando}
          >
            Próxima
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}
