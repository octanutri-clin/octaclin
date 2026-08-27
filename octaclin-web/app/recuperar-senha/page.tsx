import type { Metadata } from 'next';
import { RecuperarSenhaForm } from '@/components/auth/recuperar-senha-form';

export const metadata: Metadata = { title: 'Nova senha | OctaClin' };

export default async function RecuperarSenhaPage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  return <RecuperarSenhaForm tokenInicial={searchParams.token} />;
}
