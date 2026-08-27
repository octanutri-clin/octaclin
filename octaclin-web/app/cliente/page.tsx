import type { Metadata } from 'next';
import { PortalCliente } from '@/components/cliente/portal-cliente';

export const metadata: Metadata = { title: 'Portal do cliente | OctaClin' };

export default function ClientePage() {
  return <PortalCliente />;
}
