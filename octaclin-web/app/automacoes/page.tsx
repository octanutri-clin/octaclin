import { ConsoleShell } from '@/components/app/console-shell';
import { PainelAutomacoes } from '@/components/automacoes/painel-automacoes';

export default function AutomacoesPage() {
  return (
    <ConsoleShell titulo="Automacoes" subtitulo="Quando acontecer, fazer com seguranca">
      <PainelAutomacoes />
    </ConsoleShell>
  );
}
