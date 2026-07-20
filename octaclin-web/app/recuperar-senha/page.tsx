import { RecuperarSenhaForm } from '@/components/auth/recuperar-senha-form';

export default function RecuperarSenhaPage({ searchParams }: { searchParams: { token?: string } }) {
  return <RecuperarSenhaForm tokenInicial={searchParams.token} />;
}
