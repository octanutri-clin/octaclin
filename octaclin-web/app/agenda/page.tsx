import { Suspense } from 'react';
import { ConsoleShell } from '@/components/app/console-shell';
import { PainelAgenda } from '@/components/agenda/painel-agenda';
import { EsqueletoPagina } from '@/components/ui/feedback';

export default function AgendaPage() {
  return (
    <ConsoleShell titulo="Agenda" subtitulo="Consultas e Google Calendar">
      <Suspense fallback={<EsqueletoPagina rotulo="Carregando agenda" />}>
        <PainelAgenda />
      </Suspense>
    </ConsoleShell>
  );
}
