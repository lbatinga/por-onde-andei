'use strict';
/* ================= Configuração ================= */
const SUPA_URL = 'https://npekkekabsoyoagnelsp.supabase.co';
const SUPA_KEY = 'sb_publishable_GeRtI3iEYbOVu2PZgJZdsg_RbA4PO9J';

const armazenamento = {
  getItem: k => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: k => { try { localStorage.removeItem(k); } catch {} },
};
const supa = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { storage: armazenamento, persistSession: true, autoRefreshToken: true } });

const TIPOS = {
  cidade:    { nome: 'Cidades', um: 'Cidade', curto: 'Cidades' },
  unesco:    { nome: 'Patrimônios da UNESCO', um: 'Patrimônio da UNESCO', curto: 'UNESCO' },
  aeroporto: { nome: 'Aeroportos', um: 'Aeroporto', curto: 'Aeroportos' },
  atracao:   { nome: 'Atrações e parques', um: 'Atração turística', curto: 'Atrações' },
  museu:     { nome: 'Museus', um: 'Museu', curto: 'Museus' },
  pais:      { nome: 'Países', um: 'País inteiro', curto: 'Países' },
  estado:    { nome: 'Estados', um: 'Estado inteiro', curto: 'Estados' },
};
const ICONES = {
  museu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/></svg>',
  pais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  cidade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l5-3v16M10 21V10h9v11M13 13h3M13 17h3"/></svg>',
  unesco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/></svg>',
  aeroporto: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>',
  atracao: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  parque: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 6 10h3l-4 6h5v6h4v-6h5l-4-6h3z"/></svg>',
  estado: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
};
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="m5 12 5 5 9-10"/></svg>';
const CONTINENTES = { 'South America': 'América do Sul', 'North America': 'América do Norte', 'Europe': 'Europa', 'Asia': 'Ásia',
  'Africa': 'África', 'Oceania': 'Oceania', 'Antarctica': 'Antártida', 'Seven seas (open ocean)': 'Ilhas oceânicas' };
const ROTULOS_PADRAO = [
  { nome: 'Estive', cor: '#3b82f6', ordem: 1, conta_como_visita: true },
  { nome: 'Quero ir', cor: '#e0a526', ordem: 2, conta_como_visita: false },
  { nome: 'Favorito', cor: '#e11d48', ordem: 3, conta_como_visita: false },
  { nome: 'Escala', cor: '#64748b', ordem: 4, conta_como_visita: true, tipos: ['aeroporto'] },
];

/* ================= Estado ================= */
const S = {
  user: null, rotulos: [], lugares: [], lr: new Map(), // lugar_id -> Map(rotulo_id -> data)
  paises: [], estados: [], paisPorId: new Map(), estadoPorId: new Map(),
  aba: 'cidade', filtro: '', modoMira: false,
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bandeira = cc => (cc && /^[A-Z]{2}$/.test(cc)) ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';
function toast(msg, ms = 2600, acao) {
  try { if (/^(Erro|Não deu|Não consegui|Uma alteração feita sem internet não)/.test(msg)) window.Sentry?.captureMessage(msg, 'warning'); } catch {}
  document.querySelectorAll('.toast.com-acao').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast' + (acao ? ' com-acao' : '');
  t.textContent = msg;
  if (acao) {
    const b = document.createElement('button'); b.textContent = acao.rotulo;
    b.onclick = () => { t.remove(); acao.fn(); };
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), acao ? Math.max(ms, 5000) : ms);
}
function distKm(a, b, c, d) {
  const R = 6371, r = Math.PI / 180, dLat = (c - a) * r, dLon = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ================= Geografia (países e estados) ================= */
function preparaFeicoes(fc) {
  return fc.features.map(f => {
    const g = f.geometry; if (!g) return null;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let minX = 180, minY = 90, maxX = -180, maxY = -90, maior = null, maiorArea = -1;
    for (const p of polys) {
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const area = (x1 - x0) * (y1 - y0);
      if (area > maiorArea) { maiorArea = area; maior = [x0, y0, x1, y1]; }
      minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
    }
    return { ...f.properties, feature: f, polys, bbox: [minX, minY, maxX, maxY], maior, tam: maior ? Math.hypot(maior[2] - maior[0], maior[3] - maior[1]) : 0 };
  }).filter(Boolean);
}
function noAnel(x, y, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const xi = anel[i][0], yi = anel[i][1], xj = anel[j][0], yj = anel[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dentro = !dentro;
  }
  return dentro;
}
function contem(f, x, y) {
  const b = f.bbox; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
  for (const p of f.polys) {
    if (!noAnel(x, y, p[0])) continue;
    let buraco = false; for (let k = 1; k < p.length; k++) if (noAnel(x, y, p[k])) { buraco = true; break; }
    if (!buraco) return true;
  }
  return false;
}
function acha(lista, lat, lon) {
  for (const f of lista) if (contem(f, lon, lat)) return f;
  // pontos no litoral podem cair "no mar" por causa da simplificação: procura em volta
  for (const raio of [0.04, 0.12, 0.3]) for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4, x = lon + raio * Math.cos(ang), y = lat + raio * Math.sin(ang);
    for (const f of lista) if (contem(f, x, y)) return f;
  }
  return null;
}
function localizar(lat, lon, paisDica) {
  let estado = acha(S.estados, lat, lon);
  let pais = estado ? (S.paisPorId.get(estado.pais) || acha(S.paises, lat, lon)) : acha(S.paises, lat, lon);
  if (!pais && paisDica) pais = S.paisPorId.get(paisDica.toUpperCase()) || null;
  return { pais: pais ? pais.id : (estado ? estado.pais : (paisDica || '').toUpperCase() || null), estado: estado ? estado.id : null };
}
let geoPromessa = null;
function carregaGeo() { return geoPromessa ||= baixaGeo().catch(e => { geoPromessa = null; throw e; }); }
async function baixaGeo() {
  const [tp, te] = await Promise.all([fetch('paises.json').then(r => r.json()), fetch('estados.json').then(r => r.json())]);
  const fp = topojson.feature(tp, Object.values(tp.objects)[0]);
  const fe = topojson.feature(te, Object.values(te.objects)[0]);
  S.paises = preparaFeicoes(fp); S.estados = preparaFeicoes(fe);
  // Natural Earth põe algumas ilhas em "Seven seas"; vão para o continente da classificação da ONU
  const ILHAS = { SC: 'Africa', MU: 'Africa', SH: 'Africa', IO: 'Africa', TF: 'Africa', MV: 'Asia', GS: 'South America', HM: 'Oceania' };
  S.paises.forEach(p => { if (ILHAS[p.id]) p.continente = ILHAS[p.id]; });
  S.paises.forEach(p => S.paisPorId.set(p.id, p));
  S.estados.forEach(e => S.estadoPorId.set(e.id, e));
  S.fcPaises = fp; S.fcEstados = fe;
}
const nomePais = id => S.paisPorId.get(id)?.nome || id || '';
const nomeEstado = id => S.estadoPorId.get(id)?.nome || '';

/* ================= Sem internet ================= */
// Cópia local dos dados (para abrir sem conexão) e fila de alterações feitas offline,
// enviada sozinha quando a internet volta. Ids de lugares novos são gerados no aparelho.
const CHAVE_COPIA = 'poa-copia-v1', CHAVE_FILA = 'poa-fila-v1', CHAVE_FALHAS = 'poa-falhas-v1';
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
function salvaCopia() {
  if (S.publico || !S.user) return;
  try {
    localStorage.setItem(CHAVE_COPIA, JSON.stringify({ user: { id: S.user.id, email: S.user.email }, em: Date.now(), rotulos: S.rotulos, lugares: S.lugares,
      lr: [...S.lr].map(([l, m]) => [l, [...m.keys()]]), visitas: S.visitas || [], viagens: S.viagens || [], paradas: S.paradas || [], voos: S.voos || [], config: S.config || {} }));
  } catch {}
}
let tCopia; const agendaCopia = () => { clearTimeout(tCopia); tCopia = setTimeout(salvaCopia, 1500); };
function leCopia() { try { return JSON.parse(localStorage.getItem(CHAVE_COPIA)); } catch { return null; } }
function aplicaCopia(c) {
  S.rotulos = c.rotulos || []; S.lugares = (c.lugares || []).map(l => l.tipo === 'porto' ? { ...l, tipo: 'atracao' } : l); S.visitas = c.visitas || []; S.viagens = c.viagens || []; S.paradas = c.paradas || []; S.voos = c.voos || []; S.config = c.config || {};
  S.lr = new Map((c.lr || []).map(([l, rs]) => [l, new Map(rs.map(r => [r, null]))]));
}
let fila = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_FILA)) || []; } catch { return []; } })();
// alterações que o servidor recusou: ficam guardadas para tentar de novo, nunca somem sozinhas
let falhas = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_FALHAS)) || []; } catch { return []; } })();
function salvaFila() {
  try { localStorage.setItem(CHAVE_FILA, JSON.stringify(fila)); localStorage.setItem(CHAVE_FALHAS, JSON.stringify(falhas)); }
  catch { toast('Sem espaço no aparelho para guardar as alterações feitas sem internet', 5000); }
  atualizaSinal();
}
const erroDeSessao = e => !!e && (e.code === 'PGRST301' || e.status === 401 || /jwt|token is expired|not authenticated/i.test(e.message || ''));
const erroDeRede = e => !e || /fetch|network|load failed|rede|timeout/i.test(e.message || String(e));
function executa(op) {
  const q = supa.from(op.tabela);
  if (op.tipo === 'inserir') return q.insert(op.linha);
  if (op.tipo === 'atualizar') return q.update(op.valores).match(op.filtro);
  if (op.tipo === 'apagar') return q.delete().match(op.filtro);
  return Promise.resolve({});
}
// grava agora; sem conexão, guarda na fila
async function grava(op) {
  if (navigator.onLine) {
    try { const { error } = await executa(op); if (!error) return {}; if (!erroDeRede(error)) return { error }; }
    catch (e) { if (!erroDeRede(e)) return { error: e }; }
  }
  fila.push(op); salvaFila(); return { naFila: true };
}
let sincronizando = false;
async function sincroniza() {
  if (sincronizando || !fila.length || !navigator.onLine) return;
  sincronizando = true; atualizaSinal();
  try {
    let enviados = 0;
    while (fila.length) {
      let res; try { res = await executa(fila[0]); } catch (e) { res = { error: e }; }
      // sem rede ou sessão vencida: para e tenta de novo depois, sem perder nada
      if (res?.error && (erroDeRede(res.error) || erroDeSessao(res.error))) break;
      // 23505 = já existia; outro erro sai da fila (para não travar as seguintes) e fica guardado em "não salvas"
      const op = fila.shift();
      if (res?.error && res.error.code !== '23505') falhas.push({ ...op, erro: res.error.message || String(res.error) });
      else enviados++;
      salvaFila();
    }
    if (falhas.length) toast(`${falhas.length} ${falhas.length === 1 ? 'alteração não pôde ser salva' : 'alterações não puderam ser salvas'}. Toque no aviso no topo para ver.`, 6000);
    else if (!fila.length && enviados) toast(enviados === 1 ? 'A alteração feita sem internet foi salva' : `${enviados} alterações feitas sem internet foram salvas`);
  } finally { sincronizando = false; atualizaSinal(); }
}
function atualizaSinal() {
  const el = document.getElementById('sinal'); if (!el) return;
  const off = !navigator.onLine;
  el.hidden = !off && !fila.length && !falhas.length;
  el.textContent = off ? (fila.length ? `Sem internet · ${fila.length} pendente${fila.length > 1 ? 's' : ''}` : 'Sem internet')
    : fila.length ? `Enviando ${fila.length}…` : `${falhas.length} não salva${falhas.length > 1 ? 's' : ''}`;
  el.style.cursor = falhas.length ? 'pointer' : '';
  el.onclick = falhas.length ? abreFalhas : null;
}
function abreFalhas() {
  const nomes = { inserir: 'Incluir', atualizar: 'Alterar', apagar: 'Apagar' };
  abreModal(`
    <h3>Alterações não salvas</h3>
    <p>Estas alterações foram feitas sem internet e o servidor recusou. Elas continuam guardadas neste aparelho.</p>
    <div class="menu-lista">${falhas.map(f => `<div style="padding:8px 0"><b>${esc(nomes[f.tipo] || f.tipo)}</b> ${esc(f.linha?.nome || f.valores?.nome || String(f.tabela || '').replace('viagem_', ''))}<br><small>${esc(f.erro || '')}</small></div>`).join('')}</div>
    <div class="acoes"><button class="btn principal" id="fa-tentar">Tentar de novo</button><button class="btn" id="fa-descartar">Descartar</button></div>
  `, (m, fechar) => {
    m.querySelector('#fa-tentar').onclick = () => {
      fila = falhas.map(({ erro, ...op }) => op).concat(fila); falhas = []; salvaFila(); fechar();
      if (navigator.onLine) sincroniza(); else toast('Sem internet: tento de novo quando voltar');
    };
    m.querySelector('#fa-descartar').onclick = () => {
      if (!confirm('Descartar de vez estas alterações? Não dá para desfazer.')) return;
      falhas = []; salvaFila(); fechar();
    };
  });
}
window.addEventListener('online', () => { atualizaSinal(); sincroniza(); });
window.addEventListener('offline', atualizaSinal);

/* ================= Dados ================= */
async function todos(montar) {
  let out = [], de = 0;
  for (;;) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    const lista = Array.isArray(data) ? data : []; // resposta inesperada não trava o carregamento
    out = out.concat(lista); if (lista.length < 1000) break; de += 1000;
  }
  return out;
}
async function carregaDados() {
  let rot = await todos(() => supa.from('viagem_rotulos').select('*').order('ordem'));
  if (!rot.length) {
    const { data, error } = await supa.from('viagem_rotulos').insert(ROTULOS_PADRAO).select();
    if (error) throw error; rot = data.sort((a, b) => a.ordem - b.ordem);
  }
  S.rotulos = rot;
  S.lugares = await todos(() => supa.from('viagem_lugares').select('*').order('nome'));
  S.lugares.forEach(l => { if (l.tipo === 'porto') l.tipo = 'atracao'; }); // portos saíram do app
  const lr = await todos(() => supa.from('viagem_lugar_rotulos').select('lugar_id,rotulo_id,data'));
  S.visitas = await todos(() => supa.from('viagem_visitas').select('id,lugar_id,data,precisao,nota,viagem_id').order('data', { ascending: false })).catch(() => []);
  S.viagens = await todos(() => supa.from('viagem_viagens').select('*')).catch(() => []);
  S.paradas = await todos(() => supa.from('viagem_paradas').select('id,viagem_id,lugar_id,ordem,transporte')).catch(() => []);
  S.voos = await todos(() => supa.from('viagem_voos').select('*').order('data')).catch(() => []);
  S.config = (await supa.from('viagem_config').select('casa_lugar_id').maybeSingle().then(r => r.data).catch(() => null)) || {};
  S.lr = new Map();
  for (const x of lr) { if (!S.lr.has(x.lugar_id)) S.lr.set(x.lugar_id, new Map()); S.lr.get(x.lugar_id).set(x.rotulo_id, x.data); }
  salvaCopia();
}
const rotulosDe = id => S.lr.get(id) || new Map();
// rótulo pode valer só para alguns tipos (ex.: Escala só em aeroportos)
const rotuloServe = (r, tipo) => !r.tipos?.length || r.tipos.includes(tipo);
const rotulosPara = tipo => S.rotulos.filter(r => rotuloServe(r, tipo));
const TIPOS_DA_ABA = { transporte: ['aeroporto'] };
const rotulosDaAba = aba => S.rotulos.filter(r => !r.tipos?.length || (TIPOS_DA_ABA[aba] || [aba]).some(t => r.tipos.includes(t)));
const idsVisita = () => new Set(S.rotulos.filter(r => r.conta_como_visita).map(r => r.id));
// rótulos como "Escala": contam o lugar (aeroporto entra na contagem), mas não pintam país nem estado
const idsSoLugar = () => new Set(S.rotulos.filter(r => r.so_lugar && !r.conta_como_visita).map(r => r.id));
function soLugar(lugarId, so = idsSoLugar()) { for (const r of rotulosDe(lugarId).keys()) if (so.has(r)) return true; return false; }
function visitado(lugarId, vis = idsVisita()) { for (const r of rotulosDe(lugarId).keys()) if (vis.has(r)) return true; return false; }
function corDoLugar(lugarId) {
  const m = rotulosDe(lugarId);
  for (const r of S.rotulos) if (m.has(r.id)) return r.cor;
  return '#8a9a9b';
}
// tirou a última marcação: lugar sem rótulo não serve pra nada, então pergunta se exclui
function perguntaExcluirSemRotulo(lugarId, rotuloId, nome) {
  abreModal(`<h3>Excluir ${esc(nome)}?</h3>
    <p class="meta">Ele ficou sem nenhuma marcação. Se não vai usar, dá pra excluir da sua lista.</p>
    <div class="acoes"><button class="btn" id="sr-volta">Remarcar</button><button class="btn" id="sr-manter">Manter sem marcação</button><button class="btn perigo" id="sr-excluir">Excluir</button></div>`, (mm, fechar) => {
    mm.querySelector('#sr-volta').onclick = () => { fechar(); alternaRotulo(lugarId, rotuloId); };
    mm.querySelector('#sr-manter').onclick = fechar;
    mm.querySelector('#sr-excluir').onclick = () => { fechar(); excluiLugar(lugarId); };
  });
}
async function alternaRotulo(lugarId, rotuloId) {
  const m = rotulosDe(lugarId); const tinha = m.has(rotuloId);
  if (tinha) {
    const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_lugar_rotulos', filtro: { lugar_id: lugarId, rotulo_id: rotuloId } });
    if (error) return toast('Não deu pra salvar: ' + error.message);
    m.delete(rotuloId); if (!m.size) S.lr.delete(lugarId);
    const nomeL = S.lugares.find(x => x.id === lugarId)?.nome || 'lugar', nomeR = S.rotulos.find(r => r.id === rotuloId)?.nome || 'rótulo';
    if (!m.size) { atualizaTudo(); return perguntaExcluirSemRotulo(lugarId, rotuloId, nomeL); }
    toast(`${nomeR} tirado de ${nomeL}`, 5000, { rotulo: 'Desfazer', fn: () => alternaRotulo(lugarId, rotuloId) });
  } else {
    const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugar_rotulos', linha: { lugar_id: lugarId, rotulo_id: rotuloId } });
    if (error) return toast('Não deu pra salvar: ' + error.message);
    m.set(rotuloId, null); S.lr.set(lugarId, m);
  }
  atualizaTudo();
  if (!tinha) marcaCidadeDe(lugarId);
}


