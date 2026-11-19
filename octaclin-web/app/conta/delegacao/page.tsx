import { DelegacaoCarteira } from '@/components/equipe/delegacao-carteira';

export const metadata = { title: 'Colaboradores na sua carteira | OctaClin' };

export default function PaginaDelegacaoCarteira() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <DelegacaoCarteira />
    </main>
  );
}
