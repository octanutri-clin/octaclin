import { ConsoleShell } from '@/components/app/console-shell';
import { PainelOperacoes } from '@/components/operacoes/painel-operacoes';

export default function OperacoesPage() {
  return (
    <ConsoleShell titulo="Confiabilidade OctaClin" subtitulo="Operacoes">
      <PainelOperacoes />
    </ConsoleShell>
  );
}
