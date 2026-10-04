import type { Metadata } from 'next';
import { ConsoleShell } from '@/components/app/console-shell';
import { IntegracoesApiCliente } from '@/components/cliente/integracoes-api-cliente';

export const metadata: Metadata = { title: 'Integrações | OctaClin' };

export default function IntegracoesProfissionalPage() {
  return (
    <ConsoleShell titulo="Integrações" subtitulo="Acesse somente os escopos e eventos liberados pelo gestor da clínica.">
      <IntegracoesApiCliente modo="profissional" />
    </ConsoleShell>
  );
}
