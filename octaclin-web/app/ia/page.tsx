import { ConsoleShell } from '@/components/app/console-shell';
import { PainelIa } from '@/components/ia/painel-ia';

export default function IaPage() {
  return (
    <ConsoleShell titulo="Sugestões assistidas" subtitulo="Revisão humana obrigatória">
      <PainelIa />
    </ConsoleShell>
  );
}
