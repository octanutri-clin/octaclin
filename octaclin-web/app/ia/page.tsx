import { ConsoleShell } from '@/components/app/console-shell';
import { PainelIa } from '@/components/ia/painel-ia';

export default function IaPage() {
  return (
    <ConsoleShell titulo="IA clinica" subtitulo="Modelos assistivos">
      <PainelIa />
    </ConsoleShell>
  );
}
