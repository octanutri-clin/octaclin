import { PrimeiroAcessoForm } from '@/components/auth/primeiro-acesso-form';

export default function PrimeiroAcessoPage({ searchParams }: { searchParams: { token?: string } }) {
  return <PrimeiroAcessoForm tokenInicial={searchParams.token} />;
}
