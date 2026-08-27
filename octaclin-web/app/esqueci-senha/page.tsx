import type { Metadata } from 'next';
import { EsqueciSenhaForm } from '@/components/auth/esqueci-senha-form';

export const metadata: Metadata = { title: 'Recuperar senha | OctaClin' };

export default function EsqueciSenhaPage() {
  return <EsqueciSenhaForm />;
}
