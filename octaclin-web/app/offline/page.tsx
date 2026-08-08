export default function PaginaOffline() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo px-4 text-tinta">
      <section className="grid w-full max-w-md gap-3 rounded-lg border border-linha bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
        <h1 className="text-xl font-semibold">Sem conexao</h1>
        <p className="text-sm text-texto-suave">
          Reconecte-se para carregar suas informacoes. Operacoes salvas nesta sessao serao enviadas automaticamente.
        </p>
        <a
          href="/portal"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-primaria px-4 text-sm font-semibold text-white hover:bg-primaria-forte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
        >
          Tentar novamente
        </a>
      </section>
    </main>
  );
}
