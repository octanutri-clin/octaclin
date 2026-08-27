import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PortalPacienteProvider } from '@/components/portal/portal-contexto';

export const metadata: Metadata = { title: 'Portal do paciente | OctaClin' };

export default function LayoutPortalPaciente({ children }: { children: ReactNode }) {
  return <PortalPacienteProvider>{children}</PortalPacienteProvider>;
}
