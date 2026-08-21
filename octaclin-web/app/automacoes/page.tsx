import { ConsoleShell } from '@/components/app/console-shell';
import { PainelAutomacoes } from '@/components/automacoes/painel-automacoes';

export default function AutomacoesPage() {
  return (
    <ConsoleShell titulo="Automações" subtitulo="Quando acontecer, fazer com segurança">
      <PainelAutomacoes />
    </ConsoleShell>
  );
}
