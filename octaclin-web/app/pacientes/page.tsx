import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { ListaPacientes } from '@/components/cadastros/lista-pacientes';
import { EsqueletoPagina } from '@/components/ui/feedback';

export default function PacientesPage() {
  return (
    <ConsoleShell titulo="Pacientes" subtitulo="Acompanhamento clinico">
      <Suspense fallback={<EsqueletoPagina rotulo="Carregando pacientes" />}>
        <ListaPacientes />
      </Suspense>
    </ConsoleShell>
  );
}
