import { ConsoleShell } from '@/components/app/console-shell';
import { FormularioPaciente } from '@/components/cadastros/formulario-paciente';

export default function NovoPacientePage() {
  return <ConsoleShell titulo="Novo paciente" subtitulo="Cadastro clínico"><FormularioPaciente /></ConsoleShell>;
}
