import { Download, History, Search } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/feedback';
import { formatarData, resumirMetadados } from './formatadores-operacoes';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaAuditoria({ controlador }: { controlador: PainelOperacoesControlador }) {
  const {
    areaAtiva,
    dados,
    filtrosAuditoria,
    setFiltrosAuditoria,
    carregandoAuditoria,
    filtrarAuditoria,
    exportarAuditoria,
    auditoriaPaginada,
    totalPaginasAuditoria,
    trocarPaginaAuditoria
  } = controlador;

  if (areaAtiva !== 'auditoria') return null;

  return (
    <Cartao
      id="operacoes-auditoria-painel"
      role="tabpanel"
      aria-labelledby="operacoes-auditoria-aba"
    >
      <CartaoCabecalho className="flex-col items-start lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <History size={19} className="text-primaria" />
          <h2 className="text-base font-semibold">Auditoria sensivel</h2>
          <span className="text-sm text-texto-suave">{dados?.auditoria.length ?? 0} eventos</span>
        </div>
        <form onSubmit={filtrarAuditoria} className="grid gap-2 md:grid-cols-3 lg:grid-cols-8">
          <select
            className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
            value={filtrosAuditoria.acao}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, acao: evento.target.value }))}
            aria-label="Ação"
          >
            <option value="">Todas as ações</option>
            <option value="pacientes.listar_dados_sensiveis">Pacientes - listar</option>
            <option value="pacientes.obter_dados_sensiveis">Pacientes - detalhe</option>
            <option value="profissionais.listar_dados_sensiveis">Profissionais - listar</option>
            <option value="profissionais.obter_dados_sensiveis">Profissionais - detalhe</option>
          </select>
          <input
            className="h-9 rounded-md border border-linha px-2 text-sm"
            placeholder="Recurso"
            value={filtrosAuditoria.recursoTipo}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoTipo: evento.target.value }))}
          />
          <input
            className="h-9 rounded-md border border-linha px-2 text-sm"
            placeholder="Identificador do recurso"
            value={filtrosAuditoria.recursoId}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoId: evento.target.value }))}
          />
          <input
            className="h-9 rounded-md border border-linha px-2 text-sm"
            placeholder="ID usuário"
            value={filtrosAuditoria.usuarioId}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, usuarioId: evento.target.value }))}
          />
          <input
            type="datetime-local"
            className="h-9 rounded-md border border-linha px-2 text-sm"
            value={filtrosAuditoria.inicio}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, inicio: evento.target.value }))}
            aria-label="Inicio"
          />
          <input
            type="datetime-local"
            className="h-9 rounded-md border border-linha px-2 text-sm"
            value={filtrosAuditoria.fim}
            onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, fim: evento.target.value }))}
            aria-label="Fim"
          />
          <Botao type="submit" disabled={carregandoAuditoria}>
            <Search size={16} />
            {carregandoAuditoria ? 'Filtrando' : 'Filtrar'}
          </Botao>
          <Botao type="button" onClick={exportarAuditoria} disabled={!dados?.auditoria.length}>
            <Download size={16} />
            CSV
          </Botao>
        </form>
      </CartaoCabecalho>
      <div className="divide-y divide-linha">
        {dados?.auditoria.length ? (
          dados.auditoria.map((evento) => (
            <div key={evento.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{evento.acao}</strong>
                  <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                    {evento.recursoTipo ?? 'recurso'}
                  </span>
                </div>
                <p className="mt-1 break-all text-xs text-texto-suave">{evento.recursoId ?? '-'}</p>
                <p className="mt-1 text-xs text-texto-suave">{formatarData(evento.criadoEm)}</p>
              </div>
              <div className="text-xs text-texto-suave">
                <p className="break-all">Usuário: {evento.usuarioId ?? '-'}</p>
                <p className="mt-1 break-all">IP: {evento.ip ?? '-'}</p>
                <p className="mt-1 break-all">Agent: {evento.userAgent ?? '-'}</p>
              </div>
              <p className="break-all text-xs text-texto-suave">{resumirMetadados(evento.metadados)}</p>
            </div>
          ))
        ) : (
          <EstadoVazio titulo="Nenhum evento de auditoria carregado." />
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-texto-suave">
          Página {auditoriaPaginada?.pagina ?? 1} de {totalPaginasAuditoria} | {auditoriaPaginada?.total ?? 0} eventos
        </span>
        <div className="flex gap-2">
          <Botao
            type="button"
            onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) - 1)}
            disabled={!auditoriaPaginada || auditoriaPaginada.pagina <= 1 || carregandoAuditoria}
          >
            Anterior
          </Botao>
          <Botao
            type="button"
            onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) + 1)}
            disabled={!auditoriaPaginada || auditoriaPaginada.pagina >= totalPaginasAuditoria || carregandoAuditoria}
          >
            Próxima
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}
