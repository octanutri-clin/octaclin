import { ConsoleShell } from '@/components/app/console-shell';
import { PainelComunicacoes } from '@/components/comunicacoes/painel-comunicacoes';

export default function ComunicacoesPage() {
  return (
    <ConsoleShell titulo="Comunicações" subtitulo="Conversas e relacionamento com pacientes">
      <PainelComunicacoes />
    </ConsoleShell>
  );
}
