import type { Metadata } from 'next';
import { PrimeiroAcessoForm } from '@/components/auth/primeiro-acesso-form';

export const metadata: Metadata = { title: 'Primeiro acesso | OctaClin' };

export default async function PrimeiroAcessoPage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  return <PrimeiroAcessoForm tokenInicial={searchParams.token} />;
}
