import { ConsoleShell } from '@/components/app/console-shell';
import { PainelIa } from '@/components/ia/painel-ia';

export default function IaPage() {
  return (
    <ConsoleShell titulo="Sugestoes assistidas" subtitulo="Revisão humana obrigatoria">
      <PainelIa />
    </ConsoleShell>
  );
}
