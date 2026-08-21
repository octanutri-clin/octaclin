import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { PainelDashboard } from '@/components/dashboard/painel-dashboard';
import { EsqueletoPagina } from '@/components/ui/feedback';

export default function DashboardPage() {
  return (
    <ConsoleShell titulo="Hoje" subtitulo="Rotina diária do profissional">
      <Suspense fallback={<EsqueletoPagina rotulo="Carregando painel clínico" />}>
        <PainelDashboard />
      </Suspense>
    </ConsoleShell>
  );
}
