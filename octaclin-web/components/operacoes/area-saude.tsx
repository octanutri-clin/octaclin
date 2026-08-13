import { Activity, AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { PainelOperacoesControlador } from './use-painel-operacoes';

export function AreaSaude({ controlador }: { controlador: PainelOperacoesControlador }) {
  const { areaAtiva, dados } = controlador;
  const metricas = [
    { rotulo: 'Pendentes', valor: dados?.resumo.outbox.pendente ?? 0, icone: RefreshCcw, cor: 'text-primaria' },
    { rotulo: 'Processando', valor: dados?.resumo.outbox.processando ?? 0, icone: Activity, cor: 'text-alerta' },
    { rotulo: 'Processados', valor: dados?.resumo.outbox.processado ?? 0, icone: CheckCircle2, cor: 'text-sucesso' },
    { rotulo: 'Falharam', valor: dados?.resumo.outbox.falhou ?? 0, icone: AlertTriangle, cor: 'text-perigo' }
  ];

  if (areaAtiva !== 'saude') return null;

  return (
    <section
      id="operacoes-saude-painel"
      role="tabpanel"
      aria-labelledby="operacoes-saude-aba"
      className="grid gap-3 md:grid-cols-4"
    >
      {metricas.map((item) => (
        <Cartao key={item.rotulo}>
          <CartaoConteudo>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-texto-suave">{item.rotulo}</span>
              <item.icone className={item.cor} size={20} />
            </div>
            <p className="mt-3 text-3xl font-bold">{item.valor}</p>
          </CartaoConteudo>
        </Cartao>
      ))}
    </section>
  );
}
