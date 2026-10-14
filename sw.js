// Por Onde Andei — service worker
// Página e mapas: rede primeiro (pega atualização), cache se estiver offline.
// Bibliotecas e fontes: cache primeiro. Mapa de fundo fica no cache normal do navegador.
const VERSAO = 'poa-v52';
const BASE = ['./', './index.html', './manifest.json', './paises.json', './estados.json', './municipios-br.json', './aeroportos.json', './ranking-aeroportos.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Dados do Supabase e buscas nunca vêm do cache
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('nominatim')) return;

  const ehLib = url.hostname === 'cdn.jsdelivr.net' || url.hostname.includes('fonts.g');
  if (url.hostname.includes('openfreemap') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('wikimedia.org')) return;
  if (ehLib) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return res;
      }))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
