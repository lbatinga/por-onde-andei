'use strict';
/* ================= Mapa ================= */
let mapa, camadaPaises, camadaEstados, camadaPinos, camadaRotPaises, camadaRotEstados, fundo;
function corToken(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
// Mapa de fundo: OpenFreeMap (vetorial, sem chave), com todos os nomes trocados para português
async function estiloEmPortugues() {
  for (const nome of ['liberty', 'positron']) {
    try {
      const r = await fetch(`https://tiles.openfreemap.org/styles/${nome}`);
      if (!r.ok) continue;
      const st = await r.json();
      for (const ly of st.layers || []) {
        const tf = ly.layout && ly.layout['text-field'];
        if (ly.type === 'symbol' && tf && JSON.stringify(tf).includes('name'))
          ly.layout['text-field'] = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']];
      }
      return st;
    } catch {}
  }
  return null;
}
async function colocaFundo() {
  const atrib = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Natural Earth';
  try {
    if (!L.maplibreGL || !window.maplibregl) throw 0;
    const st = await estiloEmPortugues(); if (!st) throw 0;
    fundo = L.maplibreGL({ style: st, attribution: atrib }).addTo(mapa);
    fundo.vetorial = true;
  } catch {
    // sem WebGL ou sem conexão com o OpenFreeMap: mapa simples do OpenStreetMap
    fundo = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Natural Earth' }).addTo(mapa);
  }
}
// Botão "onde estou": centraliza o mapa na posição do aparelho e mostra um ponto azul
let pontoEuAqui;
function criaBotaoLocalizar() {
  const C = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar ctl-local');
      div.innerHTML = '<a href="#" role="button" title="Ir para onde estou" aria-label="Ir para onde estou"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3 3 10.5l7.5 2.9L13.4 21z"/></svg></a>';
      L.DomEvent.disableClickPropagation(div);
      div.querySelector('a').onclick = ev => { ev.preventDefault(); irParaMim(div); };
      return div;
    },
  });
  return new C();
}
// altura da lista que flutua sobre o mapa (só no celular)
const alturaLista = () => { const p = $('#painel'); return p && innerWidth < 900 ? p.getBoundingClientRect().height : 0; };
// centraliza um ponto no pedaço do mapa que está à vista (acima da lista), não na tela toda
function centraVisivel(ll, zoom) {
  const z = zoom ?? mapa.getZoom(), h = alturaLista();
  const p = mapa.project(L.latLng(ll), z).add([0, h / 2]);
  mapa.setView(mapa.unproject(p, z), z);
}
// Botão "ver tudo": enquadra todos os seus lugares da lista aberta (fica logo abaixo do "onde estou")
function verTudo() {
  // enquadra só onde você esteve (os "quero ir" ficam na lista, mas não puxam o mapa)
  const todos = camadaPinos.getLayers(), estive = todos.filter(m => m.options.esteve);
  let ls = estive.length ? estive : todos;
  if (!todos.length && (S.aba === 'paises' || S.aba === 'estados')) {
    calcula();
    const caixas = S.aba === 'paises' ? [...paisesVis].map(id => S.paisPorId.get(id)?.maior) : [...estadosVis].map(id => S.estadoPorId.get(id)?.bbox);
    ls = caixas.filter(Boolean).map(b => L.rectangle([[b[1], b[0]], [b[3], b[2]]]));
  }
  // no celular a lista cobre a parte de baixo do mapa: enquadra só na parte visível
  const sobre = alturaLista();
  if (ls.length) mapa.fitBounds(L.featureGroup(ls).getBounds().pad(0.1), { paddingTopLeft: [20, 20], paddingBottomRight: [20, sobre + 20] }); else mapa.setView([0, 0], 2);
}
function criaBotaoVerTudo() {
  const C = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar ctl-local');
      div.innerHTML = '<a href="#" role="button" title="Ver todos os meus lugares" aria-label="Ver todos os meus lugares"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></a>';
      L.DomEvent.disableClickPropagation(div);
      div.querySelector('a').onclick = ev => { ev.preventDefault(); verTudo(); };
      return div;
    },
  });
  return new C();
}
function irParaMim(div) {
  if (!navigator.geolocation) return toast('Este aparelho não informa a localização');
  div.classList.add('buscando');
  navigator.geolocation.getCurrentPosition(p => {
    div.classList.remove('buscando');
    const ll = [p.coords.latitude, p.coords.longitude];
    if (pontoEuAqui) pontoEuAqui.remove();
    pontoEuAqui = L.layerGroup([
      L.circle(ll, { radius: Math.min(p.coords.accuracy, 2000), color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false }),
      L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }),
    ]).addTo(mapa);
    centraVisivel(ll, Math.max(mapa.getZoom(), 13));
  }, err => {
    div.classList.remove('buscando');
    toast(err.code === 1 ? 'Libere a localização para o app nas permissões do navegador' : 'Não consegui pegar sua localização agora', 4000);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
function iniciaMapa() {
  mapa = L.map('mapa', { preferCanvas: true, maxZoom: 19, zoomControl: true, worldCopyJump: true, minZoom: 2, attributionControl: true })
    .setView([-12, -48], 4);
  colocaFundo();
  mapa.attributionControl.setPrefix(false);

  camadaPaises = L.geoJSON(S.fcPaises, { style: estiloPais, interactive: false }).addTo(mapa);
  camadaEstados = L.geoJSON(S.fcEstados, { style: estiloEstado, interactive: false });
  camadaBase = L.layerGroup().addTo(mapa);
  // pinos agrupados de longe (bolinha com o número), separados quando aproxima
  camadaPinos = (L.markerClusterGroup ? L.markerClusterGroup({
    maxClusterRadius: 42, disableClusteringAtZoom: 11, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
    // a bolinha conta só onde você esteve; grupo só de "quero ir" fica vazado, na cor do quero ir
    iconCreateFunction: c => { const ms = c.getAllChildMarkers(), v = ms.filter(m => m.options.esteve).length;
      return L.divIcon({ html: v ? `<div>${v}</div>` : `<div class="so-quero">${ms.length}</div>`, className: 'grupo-pinos', iconSize: [36, 36] }); },
  }) : L.layerGroup()).addTo(mapa);
  L.control.localizar = criaBotaoLocalizar(); L.control.localizar.addTo(mapa);
  criaBotaoVerTudo().addTo(mapa);

  const ajustaZoom = () => {
    const z = mapa.getZoom(), el = mapa.getContainer();
    el.className = el.className.replace(/\bz\d+\b/g, '').trim() + ' z' + Math.min(z, 9);
    ajustaCamadaEstados();
  };
  mapa.on('zoomend', () => { ajustaZoom(); camadaPaises.setStyle(estiloPais); camadaEstados.setStyle(estiloEstado); }); ajustaZoom();

  mapa.on('click', e => { if (S.modoMira) { saiMira(); novoLugarEm(e.latlng.lat, e.latlng.lng); return; } tocaIconeDoMapa(e); });
  // segurar o dedo: se for em cima de um ícone, usa o nome dele; senão, cadastro pelo endereço
  mapa.on('contextmenu', e => { if (poiNoPonto(e)) return tocaIconeDoMapa(e); novoLugarEm(e.latlng.lat, e.latlng.lng); });
}
// Municípios marcados pintados no mapa (Brasil): contorno do IBGE, um arquivo por estado, baixado só quando precisa
const UF_IBGE = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };
let camadaMun = null;
const malhas = new Map(); // UF -> Map(código -> feição) | Promise | 'erro'
function municipiosMarcados() { // código IBGE -> 'v' (esteve) ou 'q' (quero ir); escala não pinta
  const vis = idsVisita(), so = idsSoLugar(), m = new Map();
  for (const l of S.lugares) {
    if (l.tipo !== 'cidade' || !l.ref_externa?.startsWith('ibge:') || !S.lr.has(l.id)) continue;
    const cod = l.ref_externa.slice(5);
    if (visitado(l.id, vis)) m.set(cod, { st: 'v', l }); else if (!soLugar(l.id, so) && !m.has(cod)) m.set(cod, { st: 'q', l });
  }
  return m;
}
function carregaMalha(uf) {
  if (malhas.has(uf)) return;
  malhas.set(uf, fetch(`malhas/${uf}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(fc => { malhas.set(uf, new Map(fc.features.map(f => [String(f.properties.cod), f]))); desenhaMunicipios(); })
    .catch(() => malhas.set(uf, 'erro')));
}
function desenhaMunicipios() {
  if (!mapa) return;
  if (!camadaMun) camadaMun = L.geoJSON(null, { interactive: false, style: f => estiloMun(f.properties.st) });
  const z = mapa.getZoom();
  if (z < 6 || abaDeRegiao()) { camadaMun.remove(); return; }
  const marc = municipiosMarcados(), vista = mapa.getBounds().pad(0.3), feicoes = [];
  const porUF = new Map();
  marc.forEach((x, cod) => { const uf = UF_IBGE[cod.slice(0, 2)]; if (uf && vista.contains([x.l.lat, x.l.lon])) porUF.set(uf, true); });
  porUF.forEach((_, uf) => {
    const m = malhas.get(uf);
    if (!m) return carregaMalha(uf);
    if (!(m instanceof Map)) return;
    marc.forEach((x, cod) => { const f = m.get(cod); if (f) feicoes.push({ ...f, properties: { cod, st: x.st } }); });
  });
  camadaMun.clearLayers(); camadaMun.addData(feicoes);
  if (!mapa.hasLayer(camadaMun)) camadaMun.addTo(mapa);
}
function estiloMun(st) {
  const cor = st === 'v' ? corToken('--visit') : corToken('--want'), z = mapa ? mapa.getZoom() : 8;
  return { stroke: true, color: cor, weight: z >= 9 ? 1.5 : 1, opacity: 0.9, dashArray: st === 'q' ? '4 4' : null, fill: true, fillColor: cor, fillOpacity: st === 'v' ? (z >= 10 ? 0.18 : 0.32) : 0.08 };
}
function ajustaCamadaEstados() {
  if (!mapa || !camadaEstados) return;
  if (mapa.getZoom() >= 4 || S.aba === 'estados') { if (!mapa.hasLayer(camadaEstados)) camadaEstados.addTo(mapa); }
  else camadaEstados.remove();
}
let paisesVis = new Set(), paisesQuero = new Set(), estadosVis = new Set(), estadosQuero = new Set();
function estiloPais(f) {
  const id = f.properties.id, v = paisesVis.has(id), q = !v && paisesQuero.has(id), z = mapa ? mapa.getZoom() : 3;
  if (!v && !q) return { stroke: false, fill: false };
  if (abaDeRegiao()) { const cor = v ? corToken('--visit') : corToken('--want'); return { stroke: true, fill: true, color: cor, weight: 1.5, opacity: 0.9, fillColor: cor, fillOpacity: S.aba === 'paises' ? 0.3 : 0.1 }; }
  if (z >= 6) return { stroke: false, fill: false };
  const cor = v ? corToken('--visit') : corToken('--want');
  return { stroke: true, fill: true, color: cor, weight: 1.5, opacity: 0.9, fillColor: cor, fillOpacity: z >= 5 ? 0.12 : 0.22 };
}
function estiloEstado(f) {
  const id = f.properties.id, v = estadosVis.has(id), q = !v && estadosQuero.has(id), z = mapa ? mapa.getZoom() : 3;
  if (!v && !q) return { stroke: false, fill: false };
  if (S.aba === 'estados') { const cor = v ? corToken('--visit') : corToken('--want'); return { stroke: true, fill: true, color: cor, weight: 1.2, opacity: 0.9, fillColor: cor, fillOpacity: 0.35 }; }
  if (S.aba === 'paises') return { stroke: false, fill: false };
  if (z >= 9) return { stroke: false, fill: false };
  const cor = v ? corToken('--visit') : corToken('--want');
  return { stroke: true, fill: z < 7, color: cor, weight: z >= 7 ? 2 : 1, opacity: 0.85, fillColor: cor, fillOpacity: z >= 6 ? 0.12 : 0.28 };
}
// Cada aba mostra só os pinos do seu tipo; Países e Estados mostram só a pintura
const tiposDaAba = aba => ({ cidade: ['cidade'], unesco: ['unesco'], transporte: ['aeroporto'], atracao: ['atracao'], museu: ['museu'], paises: [], estados: [] })[aba] || Object.keys(TIPOS).filter(t => t !== 'pais' && t !== 'estado');
const abaDeRegiao = () => S.aba === 'paises' || S.aba === 'estados';
function desenhaPinos() {
  camadaPinos.clearLayers();
  const tipos = tiposDaAba(S.aba), novos = [], visP = idsVisita(), soP = idsSoLugar();
  for (const l of S.lugares) {
    if (!S.lr.has(l.id) || !tipos.includes(l.tipo)) continue;
    if (S.filtroRot && !rotulosDe(l.id).has(S.filtroRot)) continue;
    const esteve = visitado(l.id, visP) || soLugar(l.id, soP);
    const m = L.marker([l.lat, l.lon], {
      icon: L.divIcon({ className: `pino ${l.tipo}${esteve ? '' : ' quero'}`, html: l.tipo === 'cidade'
        ? `<div class="band" style="--c:${corDoLugar(l.id)}">${bandeira(l.pais)}</div>`
        : l.tipo === 'unesco'
          ? `<div class="cat" style="--c:${corDoLugar(l.id)};background:${fundoCat(catDe(l.ref_externa))}">${ICONES.unesco}</div>`
          : `<div style="--c:${corDoLugar(l.id)}"${attrPorte(l)}>${iconeDe(l)}</div>`, iconSize: [0, 0] }),
      title: l.nome, esteve, zIndexOffset: esteve ? 100 : 0,
    });
    m.on('click', () => resumoLugar(l, m));
    novos.push(m);
  }
  if (camadaPinos.addLayers) camadaPinos.addLayers(novos); else novos.forEach(m => camadaPinos.addLayer(m));
}

