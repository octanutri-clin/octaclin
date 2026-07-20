import { HeartPulse } from 'lucide-react';

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-fundo px-6 py-10 text-tinta">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-linha bg-white p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primaria text-white">
          <HeartPulse size={21} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[#596273]">OctaClin</p>
          <h1 className="mt-1 text-2xl font-semibold">Portal do paciente</h1>
          <p className="mt-2 text-sm text-[#596273]">
            Seu acesso ja esta separado do console profissional. As telas do portal serao ativadas nas proximas fases.
          </p>
        </div>
      </section>
    </main>
  );
}
