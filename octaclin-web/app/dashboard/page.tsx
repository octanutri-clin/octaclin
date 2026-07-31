import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { PainelDashboard } from '@/components/dashboard/painel-dashboard';
import { EsqueletoPagina } from '@/components/ui/feedback';

export default function DashboardPage() {
  return (
    <ConsoleShell titulo="Dashboard" subtitulo="Rotina diaria do profissional">
      <Suspense fallback={<EsqueletoPagina rotulo="Carregando painel clinico" />}>
        <PainelDashboard />
      </Suspense>
    </ConsoleShell>
  );
}
