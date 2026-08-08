const CACHE_PUBLICO = 'octaclin-publico-v1';
const RECURSOS_PUBLICOS = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/octaclin-192.png',
  '/icons/octaclin-512.png',
  '/icons/octaclin-maskable-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE_PUBLICO).then((cache) => cache.addAll(RECURSOS_PUBLICOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE_PUBLICO).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;
  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (requisicao.mode === 'navigate') {
    evento.respondWith(fetch(requisicao).catch(() => caches.match('/offline')));
    return;
  }

  const recursoEstatico = url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest';
  if (!recursoEstatico) return;

  evento.respondWith(
    caches.match(requisicao).then((armazenado) => armazenado || fetch(requisicao).then((resposta) => {
      if (resposta.ok) void caches.open(CACHE_PUBLICO).then((cache) => cache.put(requisicao, resposta.clone()));
      return resposta;
    }))
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo !== 'PURGAR_DADOS_PRIVADOS') return;
  evento.waitUntil(
    caches.keys().then((chaves) => Promise.all(
      chaves.filter((chave) => chave.startsWith('octaclin-privado-')).map((chave) => caches.delete(chave))
    ))
  );
});
