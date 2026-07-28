import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { PainelAgenda } from '@/components/agenda/painel-agenda';

export default function AgendaPage() {
  return (
    <ConsoleShell titulo="Agenda" subtitulo="Consultas e Google Calendar">
      <Suspense fallback={null}>
        <PainelAgenda />
      </Suspense>
    </ConsoleShell>
  );
}
