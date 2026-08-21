import { ConsoleShell } from '@/components/app/console-shell';
import { ListaProfissionais } from '@/components/cadastros/lista-profissionais';

export default function ProfissionaisPage() {
  return (
    <ConsoleShell titulo="Profissionais" subtitulo="Equipe clínica">
      <ListaProfissionais />
    </ConsoleShell>
  );
}
