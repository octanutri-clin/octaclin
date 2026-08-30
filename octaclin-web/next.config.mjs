import { fileURLToPath } from 'node:url';

const raizFrontend = fileURLToPath(new URL('.', import.meta.url));

const cabecalhosSeguranca = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: raizFrontend,
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
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: cabecalhosSeguranca
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }
        ]
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }]
      },
      {
        source: '/portal/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }]
      },
      {
        source: '/portal',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }]
      }
    ];
  }
};

export default nextConfig;
