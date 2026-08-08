import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OctaClin - Portal do paciente',
    short_name: 'OctaClin',
    description: 'Acompanhe consultas, plano e check-ins no portal OctaClin.',
    start_url: '/portal',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F8FA',
    theme_color: '#247BA0',
    lang: 'pt-BR',
    categories: ['health', 'medical'],
    icons: [
      { src: '/icons/octaclin-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/octaclin-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/octaclin-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
