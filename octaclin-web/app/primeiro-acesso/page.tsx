import { PrimeiroAcessoForm } from '@/components/auth/primeiro-acesso-form';

export default async function PrimeiroAcessoPage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  return <PrimeiroAcessoForm tokenInicial={searchParams.token} />;
}
