import { ConsoleShell } from '@/components/app/console-shell';
import { ProntuarioPaciente } from '@/components/pacientes/prontuario-paciente';

interface PacienteProntuarioPageProps {
  params: { id: string };
}

export default function PacienteProntuarioPage({ params }: PacienteProntuarioPageProps) {
  return (
    <ConsoleShell titulo="Prontuario do paciente" subtitulo="Linha do tempo clinica">
      <ProntuarioPaciente pacienteId={params.id} />
    </ConsoleShell>
  );
}
