import { ConsoleShell } from '@/components/app/console-shell';
import { FilaRevisaoCheckins } from '@/components/pacientes/fila-revisao-checkins';

export default function RevisoesCheckinsPage() {
  return <ConsoleShell titulo="Revisão de registros de hábitos" subtitulo="Leia o registro antes de confirmar a revisão">
    <FilaRevisaoCheckins />
  </ConsoleShell>;
}
