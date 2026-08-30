import { SessoesAtivas } from '@/components/conta/sessoes-ativas';
import { MfaConta } from '@/components/conta/mfa-conta';

export const metadata = { title: 'Sessoes da conta | OctaClin' };

export default function PaginaSessoesConta() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-lg font-semibold text-tinta">Segurança da conta</h1>
      <p className="mb-4 text-sm text-texto-suave">
        Revise onde sua conta está conectada e encerre acessos que você não reconhece.
      </p>
      <div className="grid gap-4">
        <MfaConta />
        <SessoesAtivas />
      </div>
    </main>
  );
}
