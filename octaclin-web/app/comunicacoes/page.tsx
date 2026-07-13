import { ConsoleShell } from '@/components/app/console-shell';
import { PainelComunicacoes } from '@/components/comunicacoes/painel-comunicacoes';

export default function ComunicacoesPage() {
  return (
    <ConsoleShell titulo="Comunicacoes" subtitulo="Canais e mensagens">
      <PainelComunicacoes />
    </ConsoleShell>
  );
}
