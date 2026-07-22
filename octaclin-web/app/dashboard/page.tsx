import { ConsoleShell } from '@/components/app/console-shell';
import { PainelDashboard } from '@/components/dashboard/painel-dashboard';

export default function DashboardPage() {
  return (
    <ConsoleShell titulo="Dashboard" subtitulo="Rotina diaria do profissional">
      <PainelDashboard />
    </ConsoleShell>
  );
}
