import { ConsoleShell } from '@/components/app/console-shell';
import { PainelGamificacao } from '@/components/gamificacao/painel-gamificacao';

export default function GamificacaoPage() {
  return (
    <ConsoleShell titulo="Gamificacao" subtitulo="Comunidade e conquistas">
      <PainelGamificacao />
    </ConsoleShell>
  );
}
