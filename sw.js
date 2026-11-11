// Por Onde Andei — service worker
// Página do app: rede primeiro (pega atualização), com limite de tempo; internet ruim ou offline cai na cópia guardada.
// Arquivos de dados (mapas, listas): cópia guardada na hora, atualizando por trás para a próxima abertura.
// Bibliotecas e fontes: cache primeiro. Mapa de fundo fica no cache normal do navegador.
const V = '95';                    // muda a cada publicação, junto com os ?v= do index.html (mesmo número)
const VERSAO = 'poa-v' + V;
const DADOS = 'poa-dados-v1';      // dados pesados: sobrevivem às versões
const LIBS = 'poa-libs-v1';        // bibliotecas e fontes: idem
const ESPERA = 4000;               // ms de espera pela rede antes de usar a cópia da página
const CASCA = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  ...['app.css', 'js/base.js', 'js/bases.js', 'js/mapa.js', 'js/lista.js', 'js/rotulos-fotos.js', 'js/viagens.js', 'js/estatisticas.js', 'js/voos.js', 'js/inicio.js'].map(a => `./${a}?v=${V}`)];
const BASE_DADOS = ['./paises.json', './estados.json', './municipios-br.json', './aeroportos.json', './ranking-aeroportos.json', './aerolinhas.json', './aeronaves.json', './cias-historico.json'];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(VERSAO).then(c => c.addAll(CASCA)),
    // dados: só baixa o que ainda não está guardado
    caches.open(DADOS).then(c => Promise.all(BASE_DADOS.map(u => c.match(u).then(hit => hit || c.add(u))))),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => ![VERSAO, DADOS, LIBS].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const guarda = (nome, req, res) => { if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(nome).then(c => c.put(req, copia)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Dados do Supabase e buscas nunca vêm do cache
  if (url.hostname.endsWith('supabase.co') || url.hostname.includes('nominatim')) return;
  if (url.hostname.includes('openfreemap') || url.hostname.includes('openstreetmap.org') || url.hostname.includes('wikimedia.org')) return;

  const ehLib = url.hostname === 'cdn.jsdelivr.net' || url.hostname.includes('fonts.g');
  if (ehLib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => guarda(LIBS, req, res))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // arquivos de dados: responde com a cópia e atualiza por trás
  if (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.json')) {
    e.respondWith(caches.open(DADOS).then(c => c.match(req).then(hit => {
      const rede = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
      if (hit) { e.waitUntil(rede.catch(() => {})); return hit; }
      return rede.catch(() => new Response('', { status: 503, statusText: 'offline' }));
    })));
    return;
  }

  // página e demais arquivos do app: rede primeiro, mas sem ficar esperando internet ruim
  e.respondWith((async () => {
    const copia = await caches.match(req) || (req.mode === 'navigate' ? await caches.match('./index.html') : null);
    const rede = fetch(req).then(res => guarda(VERSAO, req, res));
    if (!copia) return rede.catch(() => new Response('', { status: 503, statusText: 'offline' }));
    e.waitUntil(rede.catch(() => {}));
    return Promise.race([rede, new Promise(ok => setTimeout(() => ok(copia), ESPERA))]).catch(() => copia);
  })());
});
