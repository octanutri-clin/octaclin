import { ConsoleShell } from '@/components/app/console-shell';
import { PainelGamificacao } from '@/components/gamificacao/painel-gamificacao';

export default function GamificacaoPage() {
  return (
    <ConsoleShell titulo="Metas e adesao" subtitulo="Recurso opcional por paciente">
      <PainelGamificacao />
    </ConsoleShell>
  );
}
