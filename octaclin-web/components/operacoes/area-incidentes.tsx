import { AlertTriangle } from 'lucide-react';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { EstadoVazio } from '@/components/ui/feedback';
import { classeSeveridadeAlerta, rotuloStatusAlertas } from './formatadores-operacoes';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaIncidentes({ controlador }: { controlador: PainelOperacoesControlador }) {
  const { areaAtiva, alertasOperacionais } = controlador;

  if (areaAtiva !== 'incidentes') return null;

  return (
    <Cartao
      id="operacoes-incidentes-painel"
      role="tabpanel"
      aria-labelledby="operacoes-incidentes-aba"
    >
      <CartaoCabecalho className="flex-col items-start md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={19} className={alertasOperacionais?.status === 'critico' ? 'text-perigo' : 'text-alerta'} />
            <h2 className="text-base font-semibold">Alertas operacionais</h2>
            <span className="text-sm text-texto-suave">{alertasOperacionais?.resumo.total ?? 0} ativos</span>
          </div>
          <p className="mt-1 text-xs text-texto-suave">
            Criticos {alertasOperacionais?.resumo.criticos ?? 0} | Atencao {alertasOperacionais?.resumo.atencao ?? 0} | Informativos{' '}
            {alertasOperacionais?.resumo.informativos ?? 0}
          </p>
        </div>
        <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
          {rotuloStatusAlertas(alertasOperacionais?.status ?? 'ok')}
        </span>
      </CartaoCabecalho>
      {alertasOperacionais?.itens.length ? (
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {alertasOperacionais.itens.slice(0, 6).map((alerta) => (
            <article key={alerta.id} className={`rounded-lg border p-3 ${classeSeveridadeAlerta(alerta.severidade)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{alerta.titulo}</h3>
                  <p className="mt-1 text-xs">{alerta.mensagem}</p>
                </div>
                <span className="shrink-0 rounded-sm bg-white/70 px-2 py-1 text-[11px] font-semibold uppercase">
                  {alerta.severidade}
                </span>
              </div>
              <p className="mt-2 text-xs">{alerta.acaoSugerida}</p>
              {typeof alerta.valor === 'number' ? <p className="mt-2 text-xs font-semibold">Valor: {alerta.valor}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EstadoVazio titulo="Nenhum alerta ativo" descricao="Health, filas e integracoes sem alerta operacional no momento." />
      )}
    </Cartao>
  );
}
