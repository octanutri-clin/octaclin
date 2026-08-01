import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { ListaPacientes } from '@/components/cadastros/lista-pacientes';

export default function PacientesPage() {
  return (
    <ConsoleShell titulo="Pacientes" subtitulo="Acompanhamento clinico">
      <Suspense fallback={null}>
        <ListaPacientes />
      </Suspense>
    </ConsoleShell>
  );
}
