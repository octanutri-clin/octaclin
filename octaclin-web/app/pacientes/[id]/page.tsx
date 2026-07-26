import { ConsoleShell } from '@/components/app/console-shell';
import { ProntuarioPaciente } from '@/components/pacientes/prontuario-paciente';

interface PacienteProntuarioPageProps {
  params: Promise<{ id: string }>;
}

export default async function PacienteProntuarioPage(props: PacienteProntuarioPageProps) {
  const params = await props.params;
  return (
    <ConsoleShell titulo="Prontuario do paciente" subtitulo="Linha do tempo clinica">
      <ProntuarioPaciente pacienteId={params.id} />
    </ConsoleShell>
  );
}
