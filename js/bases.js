'use strict';
/* ================= Cidade automática ================= */
// Marcou aeroporto, porto, UNESCO ou atração como visitado? A cidade onde ele fica ganha o
// rótulo de visita também (com Desfazer). Patrimônio ou parque que pega vários municípios
// (lista da Wikidata em viagem_base_municipios) abre a escolha "Por quais você passou?".
const rotuloVisitaPadrao = () => S.rotulos.find(r => r.conta_como_visita && norm(r.nome) === 'estive') || S.rotulos.find(r => r.conta_como_visita);
function cidadeExistente(c) {
  if (c.ref) { const m = S.munPorCod?.get(c.ref.slice(5)); if (m) return cidadeJaCadastrada(m); }
  return S.lugares.find(x => x.tipo === 'cidade' && norm(x.nome) === norm(c.nome) && distKm(x.lat, x.lon, c.lat, c.lon) < 60);
}
// garante a cidade cadastrada e com o rótulo de visita; devolve a cidade se mudou algo
async function marcaCandidato(c, rot) {
  let cidade = cidadeExistente(c);
  if (cidade && visitado(cidade.id)) return null;
  if (!cidade) {
    cidade = { id: novoId(), notas: null, tipo: 'cidade', nome: c.nome, lat: c.lat, lon: c.lon, pais: c.pais, estado: c.estado, ref_externa: c.ref || null };
    const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugares', linha: cidade }); if (error) return null;
    S.lugares.push(cidade);
  }
  const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugar_rotulos', linha: { lugar_id: cidade.id, rotulo_id: rot.id } }); if (error) return null;
  const m = rotulosDe(cidade.id); m.set(rot.id, null); S.lr.set(cidade.id, m);
  return cidade;
}
function avisaMarcadas(cidades, rot) {
  cidades = cidades.filter(Boolean); if (!cidades.length) return;
  atualizaTudo();
  const nomes = cidades.map(c => c.nome);
  toast(`${nomes.length > 2 ? nomes.slice(0, 2).join(', ') + ` e mais ${nomes.length - 2}` : nomes.join(' e ')} ${nomes.length > 1 ? 'marcadas' : 'marcada'} também`, 5000,
    { rotulo: 'Desfazer', fn: async () => { for (const c of cidades) if (rotulosDe(c.id).has(rot.id)) await alternaRotulo(c.id, rot.id); } });
}
async function municipiosDaBase(l) {
  if (!/^(unesco|parque):/.test(l.ref_externa || '')) return [];
  let { data, error } = await supa.from('viagem_base_municipios').select('nome,ibge,lat,lon,pais').eq('ref', l.ref_externa);
  if (error || !data?.length) return [];
  // descarta o que não é município: sem país (entidade histórica), o próprio país, e no Brasil o que não tem código IBGE
  data = data.filter(x => x.pais && norm(x.nome) !== norm(nomePais(x.pais) || '') && !(x.pais === 'BR' && !x.ibge));
  if (data.some(x => x.ibge)) await carregaMunicipios().catch(() => {});
  const vistos = new Set();
  return data.map(x => {
    const m = x.ibge && S.munPorCod?.get(x.ibge);
    const c = m ? { nome: m.nome, lat: m.lat, lon: m.lon, pais: 'BR', estado: 'BR-' + m.uf, ref: refIbge(m) }
      : { nome: x.nome, lat: x.lat, lon: x.lon, pais: x.pais || l.pais, estado: localizar(x.lat, x.lon, x.pais || l.pais).estado, ref: null };
    return c;
  }).filter(c => { const k = c.ref || norm(c.nome); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .sort((a, b) => distKm(a.lat, a.lon, l.lat, l.lon) - distKm(b.lat, b.lon, l.lat, l.lon));
}
function escolheMunicipios(l, cands, rot, depois) {
  const ja = c => { const e = cidadeExistente(c); return e && visitado(e.id); };
  const algumJa = cands.some(ja);
  const varios = new Set(cands.map(c => c.pais)).size > 1;
  abreModal(`<h3>Por quais cidades você passou?</h3>
    <p class="meta">${esc(l.nome)} fica em ${cands.length} municípios${new Set(cands.map(c => c.pais)).size > 1 ? ` de ${new Set(cands.map(c => c.pais)).size} países` : ''}. Marque só os que você visitou.</p>
    <div class="escolha-mun">${cands.map((c, i) => `<label><input type="checkbox" data-i="${i}" ${ja(c) ? 'checked disabled' : (!algumJa && i === 0 ? 'checked' : '')}>
      <span><b>${esc(c.nome)}</b><small>${esc([nomeEstado(c.estado), varios ? nomePais(c.pais) : null].filter(Boolean).join(', ') || nomePais(c.pais))}${ja(c) ? ' · já marcada' : ''}</small></span></label>`).join('')}</div>
    <div class="acoes"><button class="btn" id="em-nenhuma">Nenhuma</button><button class="btn principal" id="em-ok">Marcar</button></div>`, (m, fechar) => {
    m.querySelector('#em-nenhuma').onclick = fechar;
    m.querySelector('#em-ok').onclick = async ev => {
      ev.target.disabled = true;
      const escolhidos = [...m.querySelectorAll('input[data-i]:checked:not(:disabled)')].map(x => cands[+x.dataset.i]);
      const feitas = []; for (const c of escolhidos) feitas.push(await marcaCandidato(c, rot));
      if (depois) await depois(escolhidos);
      fechar(); avisaMarcadas(feitas, rot);
    };
  });
}
async function mudaPaisDoLugar(l, pais, estado) {
  if (!pais || (l.pais === pais && (!estado || l.estado === estado))) return;
  const mud = { pais, estado: estado || null };
  const { error } = await grava({ tipo: 'atualizar', tabela: 'viagem_lugares', valores: mud, filtro: { id: l.id } });
  if (!error) { Object.assign(l, mud); atualizaTudo(); }
}
function escolhePais(l, paises) {
  abreModal(`<h3>Em qual país você visitou?</h3>
    <p class="meta">${esc(l.nome)} fica em ${paises.length} países. O país escolhido é o que conta no seu mapa.</p>
    <div class="escolha-mun">${paises.map((p, i) => `<label><input type="radio" name="ep" value="${esc(p)}" ${p === l.pais ? 'checked' : ''}><span><b>${bandeira(p)} ${esc(nomePais(p) || p)}</b></span></label>`).join('')}</div>
    <div class="acoes"><button class="btn principal" id="ep-ok">Pronto</button></div>`, (m, fechar) => {
    m.querySelector('#ep-ok').onclick = async () => {
      const p = m.querySelector('input[name=ep]:checked')?.value;
      if (p && p !== l.pais) { const c = S.paises.find(x => x.id === p); await mudaPaisDoLugar(l, p, null); if (c) toast(`${l.nome} contando em ${nomePais(p)}`); }
      fechar();
    };
  });
}
async function marcaCidadeDe(lugarId) {
  const l = S.lugares.find(x => x.id === lugarId);
  if (!l || ['cidade', 'pais', 'estado'].includes(l.tipo) || S.publico || !navigator.onLine) return;
  if (!visitado(l.id)) return;
  const rot = rotuloVisitaPadrao(); if (!rot) return;
  try {
    if (l.tipo === 'museu') {
      const b = acharBase(l.ref_externa || '');
      if (b?.municipio) { await carregaMunicipios(); const m = municipioPorNome(b.municipio, b.uf);
        if (m) return avisaMarcadas([await marcaCandidato({ nome: m.nome, lat: m.lat, lon: m.lon, pais: 'BR', estado: 'BR-' + m.uf, ref: refIbge(m) }, rot)], rot); }
    }
    const cands = await municipiosDaBase(l);
    const paises = acharBase(l.ref_externa || '')?.paises || [];
    if (paises.length > 1) {
      // o ponto do patrimônio cai num país só; quem decide o país é por onde você passou
      if (cands.length) return escolheMunicipios(l, cands, rot, async esc => { if (esc[0]) await mudaPaisDoLugar(l, esc[0].pais, esc[0].estado); });
      return escolhePais(l, paises);
    }
    if (cands.length >= 2) return escolheMunicipios(l, cands, rot);
    if (cands.length === 1) return avisaMarcadas([await marcaCandidato(cands[0], rot)], rot);
    // sem lista: o município do ponto, pelo mapa
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${l.lat}&lon=${l.lon}&zoom=10&addressdetails=1&accept-language=pt-BR`).then(r => r.json());
    const a = r.address || {};
    const nome = a.city || a.town || a.municipality || a.village || (l.estado === 'BR-DF' ? 'Brasília' : null);
    if (!nome) return;
    let c;
    if (l.pais === 'BR') {
      await carregaMunicipios();
      const m = municipioPorNome(nome, ufDe(l.estado)); if (!m) return;
      c = { nome: m.nome, lat: m.lat, lon: m.lon, pais: 'BR', estado: l.estado, ref: refIbge(m) };
    } else {
      c = { nome, lat: l.lat, lon: l.lon, pais: l.pais, estado: l.estado, ref: null };
      if (!cidadeExistente(c)) { // centro da cidade, não o ponto do aeroporto
        const s = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&city=${encodeURIComponent(nome)}&countrycodes=${(l.pais || '').toLowerCase()}&limit=1&accept-language=pt-BR`).then(r => r.json()).catch(() => []);
        if (s[0]) { c.lat = +s[0].lat; c.lon = +s[0].lon; const loc = localizar(c.lat, c.lon, l.pais); c.estado = loc.estado || l.estado; }
      }
    }
    avisaMarcadas([await marcaCandidato(c, rot)], rot);
  } catch {}
}

/* ================= Bases prontas: UNESCO e aeroportos ================= */
// Cores da UNESCO como no Places Been: azul cultural, verde natural, metade/metade misto
// Parques nacionais ficam no tipo "atracao" com referência parque:<id> (aba Atrações e parques)
const ehParque = x => (x.ref_externa || x.ref || '').startsWith('parque:');
const iconeDe = x => ehParque(x) ? ICONES.parque : ICONES[x.tipo];
const corBase = b => b.tipo === 'unesco' ? CATEGORIAS[b.cat].cor : ehParque(b) ? '#16a34a' : b.tipo === 'atracao' ? '#ea580c' : b.tipo === 'museu' ? '#8b5cf6' : '#6b7c7d';
const CATEGORIAS = { cultural: { nome: 'Cultural', cor: '#2563eb' }, natural: { nome: 'Natural', cor: '#16a34a' }, misto: { nome: 'Misto', cor: '#0d9488' } };
const catDe = ref => (S.baseUnesco || []).find(b => b.ref === ref)?.cat || 'cultural';
const fundoCat = cat => cat === 'misto' ? 'linear-gradient(135deg,#2563eb 50%,#16a34a 50%)' : CATEGORIAS[cat].cor;
// UNESCO: tabela viagem_unesco (Wikidata, nomes em português). Aeroportos: aeroportos.json (OurAirports, voos comerciais).
let basePromessa = {};
function carregaBase(tipo) {
  if (tipo === 'unesco') return basePromessa.unesco ||= todos(() => supa.from('viagem_unesco').select('whs,nome,lat,lon,paises,categoria').order('whs'))
    .then(rows => (S.baseUnesco = semDuplicados(rows.map(r => ({ ref: 'unesco:' + r.whs, tipo: 'unesco', nome: r.nome, lat: r.lat, lon: r.lon, pais: r.paises?.[0] || null, paises: r.paises || [], cat: r.categoria || 'cultural', sub: [CATEGORIAS[r.categoria || 'cultural'].nome, (r.paises || []).map(nomePais).join(', ')].filter(Boolean).join(' · ') })))))
    .catch(e => { basePromessa.unesco = null; throw e; });
  if (tipo === 'atracao') return basePromessa.atr ||= todos(() => supa.from('viagem_atracoes').select('qid,tipo,nome,lat,lon,pais,relevancia').or(`tipo.eq.parque,relevancia.gte.${FAMA_MINIMA}`).order('relevancia', { ascending: false }))
    .then(rows => (S.baseAtr = semDuplicados(rows.map(r => ({ ref: (r.tipo === 'parque' ? 'parque:' : 'wd:') + r.qid, tipo: 'atracao', nome: r.nome, lat: r.lat, lon: r.lon, pais: r.pais, grande: r.relevancia >= 60 ? 1 : 0, rel: r.relevancia, sub: [r.tipo === 'parque' ? 'Parque nacional' : 'Atração', nomePais(r.pais)].filter(Boolean).join(' · ') })))))
    .catch(e => { basePromessa.atr = null; throw e; });
  if (tipo === 'aeroporto') return basePromessa.aero ||= fetch('aeroportos.json').then(r => r.json())
    .then(rows => (S.baseAero = rows.map(([iata, nome, lat, lon, cc, cidade, grande, icao]) => ({ ref: 'iata:' + iata, tipo: 'aeroporto', nome, lat, lon, pais: cc, iata, icao: icao || null, grande, sub: `${iata} · ${[cidade, nomePais(cc)].filter(Boolean).join(', ')}` }))))
    .catch(e => { basePromessa.aero = null; throw e; });
  if (tipo === 'museu') return basePromessa.museu ||= fetch('museus.json').then(r => r.json())
    .then(rows => (S.baseMuseu = rows.map(([cod, nome, lat, lon, mun, uf]) => ({ ref: 'ibram:' + cod, tipo: 'museu', nome, lat, lon, pais: 'BR', municipio: mun, uf, sub: [mun, uf].filter(Boolean).join(' · ') }))))
    .catch(e => { basePromessa.museu = null; throw e; });
  return Promise.resolve([]);
}
// A Wikidata às vezes tem dois itens para o mesmo lugar: junta mesmo nome a menos de 30 km
function semDuplicados(lista) {
  const vistos = new Map(), out = [];
  for (const b of lista) {
    const k = norm(b.nome) + '|' + (ehParque(b) ? 'p' : b.tipo);
    const grupo = vistos.get(k) || [];
    if (grupo.some(o => distKm(o.lat, o.lon, b.lat, b.lon) < 30)) continue;
    grupo.push(b); vistos.set(k, grupo); out.push(b);
  }
  return out;
}
// Regra das atrações: só entra o que é famoso no mundo, com artigo na Wikipédia em pelo menos 45 idiomas
const FAMA_MINIMA = 45;
const basePorAba = aba => aba === 'unesco' ? (S.baseUnesco || []) : aba === 'transporte' ? (S.baseAero || []) : aba === 'atracao' ? (S.baseAtr || []) : aba === 'museu' ? (S.baseMuseu || []) : [];
// Porte do aeroporto: top 50 do mundo (ACI) = grande; no Brasil pelo movimento da ANAC
// (grande a partir de 5 milhões de passageiros/ano, médio de 1 a 5 milhões, pequeno abaixo). Fora disso, sem porte.
let rankingAero = null;
const carregaRanking = () => rankingAero ? Promise.resolve(rankingAero) : fetch('ranking-aeroportos.json').then(r => r.json()).then(rk => {
  // posição no país (fonte oficial: ANAC, ANAC Argentina, Eurostat) e no continente (listas regionais)
  const posNac = new Map();
  rk.brasil.lista.forEach(x => x.iata && posNac.set(x.iata, { pais: 'BR', pos: x.pos, pax: x.pax }));
  (rk.argentina?.lista || []).forEach(x => x.iata && posNac.set(x.iata, { pais: 'AR', pos: x.pos, pax: x.pax }));
  (rk.reino_unido?.lista || []).forEach(x => posNac.set(x.iata, { pais: 'GB', pos: x.pos, pax: x.pax }));
  // EUA: posição oficial da FAA, mas o total é estimado (a FAA só conta embarques)
  (rk.eua?.lista || []).forEach(x => !posNac.has(x.iata) && posNac.set(x.iata, { pais: 'US', pos: x.pos, pax: x.pax, estimado: true }));
  Object.entries(rk.europa_paises?.paises || {}).forEach(([pais, l]) => l.forEach(x => !posNac.has(x.iata) && posNac.set(x.iata, { pais, pos: x.pos, pax: x.pax })));
  const posCont = new Map(), ORIENTE = new Set(['AE', 'QA', 'SA', 'KW', 'BH', 'OM', 'IL', 'JO', 'LB', 'IQ', 'IR', 'EG']);
  Object.entries(rk.continentes || {}).forEach(([reg, c]) => c.lista.forEach(x => {
    const atual = posCont.get(x.iata), novo = { reg, pos: x.pos, pax: x.pax, pais: x.pais };
    if (!atual) return posCont.set(x.iata, novo);
    // aeroporto em duas listas (Dubai na Ásia e no Oriente Médio, Cidade do México nas duas Américas): fica a mais natural
    const prefere = r => r === 'oriente_medio' ? ORIENTE.has(x.pais) && x.pais !== 'EG' : r === 'europa' ? x.pais === 'TR' : r === 'america_latina' ? x.pais !== 'US' && x.pais !== 'CA' : false;
    if (prefere(reg) && !prefere(atual.reg)) posCont.set(x.iata, novo);
  }));
  rankingAero = { ...rk, posBR: new Map(rk.brasil.lista.map(x => [x.iata, x])), posNac, posCont, posMundo: new Map(rk.mundo.lista.map(x => [x.iata, x.pos])) };
  return rankingAero;
});
const PORTES = { muito: 'Aeroporto muito grande', grande: 'Aeroporto grande', medio: 'Aeroporto médio', pequeno: 'Aeroporto pequeno' };
// número de passageiros mais confiável: nacional oficial; se for estimado (EUA), o continental, que é medido
const paxDe = iata => { const n = rankingAero.posNac.get(iata), c = rankingAero.posCont.get(iata); return n && !n.estimado ? n : c || n; };
function porteAero(x) {
  const ref = x.ref_externa || x.ref || ''; if (!rankingAero || x.tipo !== 'aeroporto' || !ref.startsWith('iata:')) return null;
  const iata = ref.slice(5);
  // muito grande: top 50 do mundo ou 15 milhões+; grande: 5 milhões+; médio: 1 a 5 milhões; pequeno: abaixo
  if (rankingAero.posMundo.has(iata)) return 'muito';
  const br = paxDe(iata); if (!br) return null;
  return br.pax >= 15e6 ? 'muito' : br.pax >= 5e6 ? 'grande' : br.pax >= 1e6 ? 'medio' : 'pequeno';
}
// posições de um aeroporto em texto curto: "🌎 50º · Am. Latina 1º · 🇧🇷 1º"
const REG_CURTO = { america_latina: 'Am. Latina', america_norte: 'Am. do Norte', europa: 'Europa', asia: 'Ásia', oriente_medio: 'Or. Médio', africa: 'África' };
function rankingTexto(x) {
  const ref = x.ref_externa || x.ref || ''; if (!rankingAero || !ref.startsWith('iata:')) return '';
  const iata = ref.slice(5), m = rankingAero.posMundo.get(iata), c = rankingAero.posCont.get(iata), n = rankingAero.posNac.get(iata);
  return [m && `🌎 ${m}º`, c && `${REG_CURTO[c.reg] || ''} ${c.pos}º`, n && `${bandeira(n.pais)} ${n.pos}º`].filter(Boolean).join(' · ');
}
function paxTexto(x) {
  const ref = x.ref_externa || x.ref || ''; if (!rankingAero || !ref.startsWith('iata:')) return '';
  const iata = ref.slice(5), d = paxDe(iata);
  return d ? `${d.estimado ? 'cerca de ' : ''}${(d.pax / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhões de passageiros por ano${d.estimado ? ' (estimado: 2× os embarques da FAA)' : ''}` : '';
}
// População das cidades: IBGE no Brasil (com ranking entre os 5.570 municípios) e GeoNames fora
// (só porte e número aproximado — lá os países medem cidade de jeitos diferentes, então sem ranking).
let popCidades = null;
// o Brasil (~100 KB) vem junto com o app; o mundo (~1 MB) só quando há cidade de fora para mostrar
let promPop, promMundo;
const carregaPop = () => promPop ||= fetch('cidades-pop.json').then(r => r.json()).then(d => {
  const ordem = Object.entries(d.brasil.pop).sort((a, b) => b[1] - a[1]);
  popCidades = { ...d, posBR: new Map(ordem.map(([cod], i) => [cod, i + 1])), totalBR: ordem.length, grade: popCidades?.grade || null };
  return popCidades;
}).catch(e => { promPop = null; throw e; });
const carregaMundo = () => promMundo ||= carregaPop().then(() => fetch('cidades-mundo.json')).then(r => r.json()).then(d => {
  const grade = new Map();
  d.lista.forEach(c => { const k = Math.floor(c[0]) + ',' + Math.floor(c[1]); if (!grade.has(k)) grade.set(k, []); grade.get(k).push(c); });
  popCidades.grade = grade;
  return popCidades;
}).catch(e => { promMundo = null; throw e; });
const precisaMundo = () => S.lugares.some(l => l.tipo === 'cidade' && l.pais && l.pais !== 'BR');
function popCidade(x) {
  if (!popCidades || x.tipo !== 'cidade') return null;
  const ref = x.ref_externa || x.ref || '';
  if (ref.startsWith('ibge:')) { const cod = ref.slice(5), pop = popCidades.brasil.pop[cod]; return pop ? { pop, pos: popCidades.posBR.get(cod), pais: 'BR', ibge: true } : null; }
  if (x.pais === 'BR' || x.lat == null) return null;
  if (!popCidades.grade) { carregaMundo().then(() => atualizaTudo()).catch(() => {}); return null; }
  const cands = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) (popCidades.grade.get((Math.floor(x.lat) + i) + ',' + (Math.floor(x.lon) + j)) || []).forEach(c => cands.push([c, distKm(x.lat, x.lon, c[0], c[1])]));
  const n = norm(x.nome || '');
  // mesmo nome até 30 km; senão, a cidade mais próxima até 8 km
  const achou = cands.filter(([c, d]) => d < 30 && norm(c[4]) === n).sort((a, b) => a[1] - b[1])[0] || cands.filter(([, d]) => d < 8).sort((a, b) => a[1] - b[1])[0];
  return achou ? { pop: achou[0][2], pais: achou[0][3], ibge: false } : null;
}
const PORTES_CIDADE = { muito: 'Metrópole', grande: 'Cidade grande', medio: 'Cidade média', pequeno: 'Cidade pequena' };
const porteCidade = x => { const p = popCidade(x); return !p ? null : p.pop >= 1e6 ? 'muito' : p.pop >= 5e5 ? 'grande' : p.pop >= 1e5 ? 'medio' : 'pequeno'; };
const fmtHab = n => n >= 1e6 ? `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${n >= 2e6 ? 'milhões' : 'milhão'}` : n >= 1e4 ? `${Math.round(n / 1000)} mil` : n.toLocaleString('pt-BR');
const habitantes = n => `${fmtHab(n)}${n >= 1e6 ? ' de' : ''} habitantes`;
const attrPorte = x => {
  if (x.tipo === 'cidade') { const p = porteCidade(x); return p ? ` data-porte="${p}" title="${PORTES_CIDADE[p]}"` : ''; }
  const p = porteAero(x); return p ? ` data-porte="${p}" title="${PORTES[p]}"` : '';
};
// quadro do topo do cadastro (aeroporto ou cidade): posição, porte e números
function quadroRanking(l) {
  if (l.tipo === 'aeroporto' && rankingTexto(l)) return `<div class="rank-form"${attrPorte(l)}><b>${esc(rankingTexto(l))}</b><small>${esc([PORTES[porteAero(l)], paxTexto(l)].filter(Boolean).join(' · '))}</small></div>`;
  const p = l.tipo === 'cidade' && popCidade(l);
  if (!p) return '';
  const titulo = p.ibge ? `🇧🇷 ${p.pos.toLocaleString('pt-BR')}ª mais populosa do Brasil (de ${popCidades.totalBR.toLocaleString('pt-BR')})` : PORTES_CIDADE[porteCidade(l)];
  const sub = p.ibge ? `${PORTES_CIDADE[porteCidade(l)]} · ${habitantes(p.pop)} (IBGE ${popCidades.brasil.ano})` : `cerca de ${habitantes(p.pop)} (GeoNames, aproximado)`;
  return `<div class="rank-form"${attrPorte(l)}><b>${esc(titulo)}</b><small>${esc(sub)}</small></div>`;
}
const lugarDaRef = ref => S.lugares.find(l => l.ref_externa === ref);
function linhaBase(b) {
  const marcas = rotulosPara(b.tipo).map(r => `<button class="marca" style="--c:${esc(r.cor)}" aria-pressed="false" aria-label="${esc(r.nome)}" title="${esc(r.nome)}" data-base="${esc(b.ref)}" data-r="${r.id}">${CHECK}</button>`).join('');
  const estiloTipo = b.tipo === 'unesco' ? ` style="color:${CATEGORIAS[b.cat].cor};border-color:${CATEGORIAS[b.cat].cor}"` : '';
  const estiloT = estiloTipo || (b.tipo === 'atracao' ? ` style="color:${corBase(b)};border-color:${corBase(b)}"` : '');
  return `<div class="item base"><span class="tipo"${estiloT}${attrPorte(b)}>${iconeDe(b)}</span>
    <button class="txt" data-abrir-base="${esc(b.ref)}"><b>${esc(b.nome)}</b><small>${esc([b.sub, b.tipo === 'aeroporto' ? rankingTexto(b) : ''].filter(Boolean).join(' · '))}</small></button>
    <div class="marcas">${marcas}</div></div>`;
}
const acharBase = ref => (ref.startsWith('unesco:') ? S.baseUnesco : ref.startsWith('iata:') ? S.baseAero : ref.startsWith('ibram:') ? S.baseMuseu : S.baseAtr)?.find(b => b.ref === ref);
// Marcar um item da base cria o lugar na hora, já com o rótulo
async function marcaBase(ref, rotuloId) {
  const b = acharBase(ref); if (!b) return;
  const ja = lugarDaRef(ref); if (ja) return alternaRotulo(ja.id, rotuloId);
  const loc = localizar(b.lat, b.lon, b.pais);
  const data = { id: novoId(), tipo: b.tipo, nome: b.nome, lat: b.lat, lon: b.lon, pais: loc.pais, estado: loc.estado, ref_externa: ref, notas: null };
  const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugares', linha: data });
  if (error) return toast('Não deu pra salvar: ' + error.message);
  S.lugares.push(data);
  const { error: e2 } = await grava({ tipo: 'inserir', tabela: 'viagem_lugar_rotulos', linha: { lugar_id: data.id, rotulo_id: rotuloId } });
  if (e2) toast('Lugar salvo, mas o rótulo falhou: ' + e2.message); else S.lr.set(data.id, new Map([[rotuloId, null]]));
  atualizaTudo();
  marcaCidadeDe(data.id);
}
function abreBase(ref) {
  const b = acharBase(ref); if (!b) return;
  const ja = lugarDaRef(ref); if (ja) return abreLugar(ja.id);
  vaiPara(b.lat, b.lon, 10);
  novoLugar({ lat: b.lat, lon: b.lon, tipo: b.tipo, nome: b.nome, pais: b.pais, ref_externa: ref });
}
// Pinos cinza dos itens da base (só na aba certa e de perto o bastante)
let camadaBase;
function desenhaBase() {
  if (!camadaBase) return;
  camadaBase.clearLayers();
  if (S.publico) return;
  const base = basePorAba(S.aba); if (!base.length) return;
  const z = mapa.getZoom(); if (z < (S.aba === 'unesco' ? 3 : S.aba === 'atracao' ? 4 : S.aba === 'museu' ? 9 : 5)) return;
  const bb = mapa.getBounds().pad(0.05); let n = 0;
  for (const b of base) {
    if (n > 400) break;
    if (!bb.contains([b.lat, b.lon]) || lugarDaRef(b.ref)) continue;
    if (S.aba === 'transporte' && z < 7 && !b.grande) continue;
    if (S.aba === 'atracao' && ehParque(b) && z < 6) continue;
    n++;
    const m = L.marker([b.lat, b.lon], { icon: L.divIcon({ className: `pino base ${b.tipo}`, html: `<div style="--cb:${corBase(b)}"${attrPorte(b)}>${iconeDe(b)}</div>`, iconSize: [0, 0] }), title: b.nome });
    m.on('click', () => abreBase(b.ref));
    camadaBase.addLayer(m);
  }
}

/* ================= Datas de visita ================= */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function fmtVisita(v) {
  const [a, m, d] = v.data.split('-');
  return v.precisao === 'ano' ? a : v.precisao === 'mes' ? `${MESES[+m - 1]}/${a}` : `${d}/${m}/${a}`;
}
const visitasDe = id => (S.visitas || []).filter(v => v.lugar_id === id).sort((a, b) => b.data.localeCompare(a.data));

