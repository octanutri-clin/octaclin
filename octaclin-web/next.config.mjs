import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  typedRoutes: true,
  /**
   * Redirecionamentos de rota ficam aqui, e nao em `redirect()` dentro de page.tsx.
   * Com o `loading.tsx` de raiz, o `redirect()` de server component cai dentro do
   * boundary de Suspense: o Next responde HTTP 200 com o esqueleto e so redireciona
   * depois, no cliente. Quem nao executa JS — monitor, crawler, curl, smoke de CI —
   * recebe uma pagina de carregamento eterna no lugar do destino.
   * Em `redirects()` o desvio sai como 308 na camada de roteamento, antes de render.
   */
  async redirects() {
    return [
      { source: '/', destination: '/dashboard', permanent: false },
      { source: '/mobile', destination: '/operacoes', permanent: false }
    ];
  }
};

export default nextConfig;
