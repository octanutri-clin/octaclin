import { ConsoleShell } from '@/components/app/console-shell';
import { FormularioPaciente } from '@/components/cadastros/formulario-paciente';

interface EditarPacientePageProps { params: Promise<{ id: string }> }

export default async function EditarPacientePage({ params }: EditarPacientePageProps) {
  const { id } = await params;
  return <ConsoleShell titulo="Editar paciente" subtitulo="Dados cadastrais e acompanhamento"><FormularioPaciente pacienteId={id} /></ConsoleShell>;
}
