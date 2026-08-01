import type { ReactNode } from 'react';
import { PortalPacienteProvider } from '@/components/portal/portal-contexto';

export default function LayoutPortalPaciente({ children }: { children: ReactNode }) {
  return <PortalPacienteProvider>{children}</PortalPacienteProvider>;
}
