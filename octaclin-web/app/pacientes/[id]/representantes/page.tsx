import { ConsoleShell } from '@/components/app/console-shell';
import { RepresentantesPaciente } from '@/components/equipe/representantes-paciente';

interface PaginaRepresentantesProps {
  params: Promise<{ id: string }>;
}

export default async function PaginaRepresentantesPaciente(props: PaginaRepresentantesProps) {
  const { id } = await props.params;
  return (
    <ConsoleShell titulo="Prontuário do paciente" subtitulo="Quem acompanha pelo portal">
      <div className="mx-auto w-full max-w-3xl">
        <RepresentantesPaciente pacienteId={id} />
      </div>
    </ConsoleShell>
  );
}
