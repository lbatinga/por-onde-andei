'use strict';
/* ================= Estatísticas e lista ================= */
function calcula() {
  const vis = idsVisita(), so = idsSoLugar();
  paisesVis = new Set(); paisesQuero = new Set(); estadosVis = new Set(); estadosQuero = new Set();
  const cont = { cidade: 0, unesco: 0, aeroporto: 0, atracao: 0, museu: 0, pais: 0, estado: 0 };
  for (const l of S.lugares) {
    if (!S.lr.has(l.id)) continue;
    if (visitado(l.id, vis)) {
      cont[l.tipo]++;
      if (l.pais) paisesVis.add(l.pais); if (l.estado) estadosVis.add(l.estado);
    } else if (soLugar(l.id, so)) {
      cont[l.tipo]++;
    } else {
      if (l.pais) paisesQuero.add(l.pais); if (l.estado) estadosQuero.add(l.estado);
    }
  }
  return cont;
}
const EXTRAS = [['unesco', 'Patrimônios da UNESCO'], ['atracao', 'Atrações e parques'], ['museu', 'Museus']];
function abreExtras() {
  const c = calcula();
  abreModal(`<h3>Outros lugares</h3>
    <div class="menu-lista">${EXTRAS.map(([k, nome]) => `<button data-extra="${k}">${ICONES[k]} ${esc(nome)}<small>${num(c[k])} ${c[k] === 1 ? "marcado" : "marcados"}</small></button>`).join('')}</div>`, (m, fechar) => {
    m.querySelectorAll('[data-extra]').forEach(b => b.onclick = () => { fechar(); S.aba = b.dataset.extra; S.filtro = ''; $('#filtro').value = ''; atualizaTudo(); });
  });
}
function atualizaTudo() {
  agendaCopia();
  agendaSelos();
  agendaCarteira();
  const c = calcula();
  if (camadaPaises) { ajustaCamadaEstados(); camadaPaises.setStyle(estiloPais); camadaEstados.setStyle(estiloEstado); desenhaPinos(); desenhaMunicipios(); desenhaRotas(); }
  document.querySelectorAll('.rot-mapa div[data-pais]').forEach(d => d.parentElement.classList.toggle('visitado', paisesVis.has(d.dataset.pais)));
  const totalPaises = S.paises.length;
  // núcleo do app em destaque; UNESCO, atrações e museus ficam juntos no último botão
  const itens = [
    ['paises', `${paisesVis.size}<small>/${totalPaises}</small>`, 'Países'],
    ['estados', estadosVis.size, 'Estados'],
    ['cidade', c.cidade, 'Cidades'],
    ['transporte', c.aeroporto, 'Aeroportos'],
  ];
  const ICONE_ABA = { paises: ICONES.pais, estados: ICONES.estado, cidade: ICONES.cidade, unesco: ICONES.unesco, transporte: ICONES.aeroporto, atracao: ICONES.atracao, museu: ICONES.museu };
  const extra = EXTRAS.find(([k]) => k === S.aba);
  const MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>';
  $('#contadores').innerHTML = itens.map(([k, v, t]) =>
    `<button class="contador" data-aba="${k}" aria-pressed="${S.aba === k}" title="${t}"><span class="cn">${ICONE_ABA[k] || ''}<b>${v}</b></span><span class="cr">${t}</span></button>`).join('')
    + `<button class="contador extras" data-extras="1" aria-pressed="${!!extra}" title="${extra ? extra[1] : 'UNESCO, atrações e museus'}"><span class="cn">${extra ? ICONE_ABA[extra[0]] + `<b>${c[extra[0]]}</b>` : MAIS + `<b>${c.unesco + c.atracao + c.museu}</b>`}</span><span class="cr">${extra ? TIPOS[extra[0]].curto : 'Mais'}</span></button>`;
  renderLista(); desenhaBase();
}
function linhaLugar(l) {
  const m = rotulosDe(l.id);
  const local = [nomeEstado(l.estado), nomePais(l.pais)].filter(Boolean).join(', ');
  const marcas = S.publico
    ? S.rotulos.filter(r => m.has(r.id)).map(r => `<span class="selo" style="--c:${esc(r.cor)}">${esc(r.nome)}</span>`).join('')
    : S.rotulos.filter(r => rotuloServe(r, l.tipo) || m.has(r.id)).map(r => `<button class="marca" style="--c:${esc(r.cor)}" aria-pressed="${m.has(r.id)}" aria-label="${esc(r.nome)}" title="${esc(r.nome)}" data-l="${l.id}" data-r="${r.id}">${CHECK}</button>`).join('');
  const estiloTipo = l.tipo === 'unesco' ? ` style="color:#fff;border:0;background:${fundoCat(catDe(l.ref_externa))}"` : '';
  return `<div class="item"><span class="tipo"${estiloTipo}${attrPorte(l)}>${iconeDe(l)}</span>
    <button class="txt" data-abrir="${l.id}"><b>${esc(l.nome)}</b><small>${esc([l.tipo === 'unesco' && S.baseUnesco ? CATEGORIAS[catDe(l.ref_externa)].nome : ehParque(l) ? 'Parque nacional' : '', local || TIPOS[l.tipo].um, l.tipo === 'cidade' && popCidade(l) ? fmtHab(popCidade(l).pop) + ' hab.' : ''].filter(Boolean).join(' · '))}</small></button>
    ${S.publico ? '' : `<button class="mais-opcoes" data-editar-lugar="${l.id}" aria-label="Editar ${esc(l.nome)}" title="Editar">⋯</button>`}
    <div class="marcas">${marcas}</div></div>`;
}
// A lista mostra só o que está visível no mapa (como no Places Been)
function noMapa() {
  if (!mapa) return () => true;
  const b = mapa.getBounds().pad(0.02);
  return l => b.contains([l.lat, l.lon]) || b.contains([l.lat, l.lon + 360]) || b.contains([l.lat, l.lon - 360]);
}
function avisoMapa(n, total) {
  return n < total ? `<div class="no-mapa">Mostrando ${n} de ${total} · só o que aparece no mapa <button data-ver-todos>Ver todos</button></div>` : '';
}
// colunas do resumo de países/estados (mesma ordem da legenda)
const COLS_RESUMO = [['cidade', 'Cidades'], ['unesco', 'UNESCO'], ['aeroporto', 'Aeroportos'], ['atracao', 'Atrações e parques'], ['museu', 'Museus']];
// Ordem da lista: A–Z, mais perto (de onde você está; sem localização, da sua casa) ou maior
// (população nas cidades, movimento nos aeroportos, área em países e estados). Lembra por aba.
const NOME_TAMANHO = { cidade: 'Mais populosa', transporte: 'Mais movimentado', paises: 'Maior área', estados: 'Maior área' };
function ordemDaAba(aba) { try { return JSON.parse(localStorage.getItem('poa-ordem') || '{}')[aba] || 'nome'; } catch { return 'nome'; } }
function guardaOrdem(aba, o) { try { const m = JSON.parse(localStorage.getItem('poa-ordem') || '{}'); m[aba] = o; localStorage.setItem('poa-ordem', JSON.stringify(m)); } catch {} }
function pontoRef() {
  if (S.minhaPos) return S.minhaPos;
  const c = casa(); if (c) return [c.lat, c.lon];
  const m = mapa.getCenter(); return [m.lat, m.lng];
}
function pedeMinhaPos() {
  if (S.minhaPos || S.pedindoPos || !navigator.geolocation) return;
  S.pedindoPos = true;
  navigator.geolocation.getCurrentPosition(p => { S.minhaPos = [p.coords.latitude, p.coords.longitude]; S.pedindoPos = false; renderLista(); },
    () => { S.pedindoPos = false; toast('Sem sua localização: a distância é contada a partir da sua casa', 3500); }, { timeout: 10000, maximumAge: 300000 });
}
// info(x) -> { nome, lat, lon, tam }
function ordena(lista, aba, info) {
  const o = ordemDaAba(aba), ref = o === 'perto' ? pontoRef() : null;
  const dados = lista.map(x => { const i = info(x); return { x, i, d: ref && i.lat != null ? distKm(ref[0], ref[1], i.lat, i.lon) : Infinity }; });
  dados.sort((a, b) => (o === 'perto' ? a.d - b.d : o === 'tamanho' ? (b.i.tam || -1) - (a.i.tam || -1) : 0) || a.i.nome.localeCompare(b.i.nome, 'pt-BR'));
  return dados.map(d => d.x);
}
const centroBox = b => b ? { lat: (b[1] + b[3]) / 2, lon: (b[0] + b[2]) / 2 } : { lat: null, lon: null };
function montaSeletorOrdem(aba) {
  const sel = $('#ordem'); if (!sel) return;
  const opcoes = [['nome', 'A–Z'], ['perto', 'Mais perto'], ...(NOME_TAMANHO[aba] ? [['tamanho', NOME_TAMANHO[aba]]] : [])];
  let atual = ordemDaAba(aba); if (!opcoes.some(([k]) => k === atual)) atual = 'nome';
  sel.innerHTML = opcoes.map(([k, t]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${t}</option>`).join('');
}
function renderLista() {
  const f = norm(S.filtro), aba = S.aba, visivel = noMapa();
  montaSeletorOrdem(aba);
  $('#cab-rotulos').hidden = false;
  if (S.filtroRot && !S.rotulos.some(r => r.id === S.filtroRot)) S.filtroRot = null;
  $('#cab-rotulos').innerHTML = (aba === 'paises' || aba === 'estados') ? COLS_RESUMO.map(([t, nome]) => `<span class="leg">${ICONES[t]}${nome}</span>`).join('') : rotulosDaAba(aba).map(r => `<button class="filtro-rot" data-filtro-rot="${r.id}" aria-pressed="${S.filtroRot === r.id}" title="Mostrar só ${esc(r.nome)}"><i style="--c:${esc(r.cor)}"></i>${esc(r.nome)}</button>`).join('')
    + (S.filtroRot ? '<button class="filtro-limpa" data-filtro-rot="">Mostrar todos</button>' : '')
    + ((aba === 'paises' || aba === 'estados') ? '' : '<button class="ajuda-rot" data-ajuda-rot="1" aria-label="O que cada marca quer dizer" title="O que cada marca quer dizer">?</button>');
  const titulos = { paises: 'Países', estados: 'Estados e províncias', transporte: 'Aeroportos' };
  $('#painel-titulo').textContent = titulos[aba] || TIPOS[aba].nome;
  let html = '';
  if (aba === 'paises' || aba === 'estados') {
    const vis = idsVisita(), cont = new Map(), det = new Map();
    let totalK = new Set();
    for (const l of S.lugares) {
      const k = aba === 'paises' ? l.pais : l.estado; if (!k || !visitado(l.id, vis)) continue;
      totalK.add(k); if (!visivel(l)) continue;
      cont.set(k, (cont.get(k) || 0) + 1);
      if (!det.has(k)) det.set(k, {}); const d = det.get(k); d[l.tipo] = (d[l.tipo] || 0) + 1;
    }
    const UM = { cidade: 'cidade', unesco: 'UNESCO', aeroporto: 'aeroporto', atracao: 'atração', museu: 'museu' };
    const VARIOS = { cidade: 'cidades', unesco: 'UNESCO', aeroporto: 'aeroportos', atracao: 'atrações', museu: 'museus' };
    // sempre as mesmas colunas, na mesma ordem; zero fica apagado
    const resumoHtml = k => `<span class="conts">${COLS_RESUMO.map(([t, nome]) => { const n = det.get(k)?.[t] || 0; return `<span class="${n ? '' : 'zero'}" title="${nome}">${ICONES[t]}${n}</span>`; }).join('')}</span>`;
    const resumo = k => Object.keys(TIPOS).filter(t => det.get(k)?.[t]).map(t => `${det.get(k)[t]} ${det.get(k)[t] === 1 ? UM[t] : VARIOS[t]}`).join(' · ');
    if (aba === 'paises') {
      const porCont = new Map();
      for (const id of cont.keys()) { const p = S.paisPorId.get(id); const ct = CONTINENTES[p?.continente] || 'Outros'; if (!porCont.has(ct)) porCont.set(ct, []); porCont.get(ct).push(id); }
      const totais = new Map(); S.paises.forEach(p => { const ct = CONTINENTES[p.continente] || 'Outros'; totais.set(ct, (totais.get(ct) || 0) + 1); });
      for (const [ct, ids] of [...porCont].sort()) {
        const linhas = ordena(ids.filter(id => norm(nomePais(id)).includes(f)), 'paises', id => { const p = S.paisPorId.get(id); return { nome: nomePais(id), ...centroBox(p?.maior), tam: p ? areaFeicao(p) : 0 }; });
        if (!linhas.length) continue;
        html += `<div class="grupo"><span>${esc(ct)}</span><span>${ids.length} de ${totais.get(ct)}</span></div>`;
        html += linhas.map(id => `<div class="item"><span class="bandeira">${bandeira(id)}</span><button class="txt" data-zoom-pais="${esc(id)}"><b>${esc(nomePais(id))}</b>${resumoHtml(id)}</button></div>`).join('');
      }
    } else {
      const ids = [...cont.keys()].filter(id => norm(nomeEstado(id)).includes(f))
        .sort((a, b) => nomePais(S.estadoPorId.get(a)?.pais).localeCompare(nomePais(S.estadoPorId.get(b)?.pais), 'pt-BR'));
      // dentro de cada país, a ordem escolhida (os países continuam agrupados)
      const porPaisOrd = new Map(); ids.forEach(id => { const p = S.estadoPorId.get(id)?.pais; if (!porPaisOrd.has(p)) porPaisOrd.set(p, []); porPaisOrd.get(p).push(id); });
      ids.splice(0, ids.length, ...[...porPaisOrd.values()].flatMap(g => ordena(g, 'estados', id => { const e = S.estadoPorId.get(id); return { nome: nomeEstado(id), ...centroBox(e?.bbox), tam: e ? areaFeicao(e) : 0 }; })));
      let ult = null;
      for (const id of ids) {
        const p = S.estadoPorId.get(id)?.pais;
        if (p !== ult) { const n = ids.filter(x => S.estadoPorId.get(x)?.pais === p).length; html += `<div class="grupo"><span>${bandeira(p)} ${esc(nomePais(p))}</span><span>${n} de ${S.estados.filter(e => e.pais === p).length}</span></div>`; ult = p; }
        html += `<div class="item"><span class="tipo">${ICONES.estado}</span><button class="txt" data-zoom-estado="${esc(id)}"><b>${esc(nomeEstado(id))}</b>${resumoHtml(id)}</button></div>`;
      }
    }
    if (aba === 'paises') {
      // países que você quer conhecer (por um lugar "Quero ir" ou pelo país inteiro)
      const quero = [...paisesQuero].filter(id => !paisesVis.has(id) && norm(nomePais(id)).includes(f)).sort((a, b) => nomePais(a).localeCompare(nomePais(b), 'pt-BR'));
      if (quero.length) {
        html += `<div class="grupo"><span>Quero ir</span><span>${quero.length}</span></div>`;
        html += quero.map(id => {
          const lp = S.lugares.find(l => l.ref_externa === 'pais:' + id), m = lp ? rotulosDe(lp.id) : null;
          const marcas = lp ? `<div class="marcas">${rotulosPara('pais').map(r => `<button class="marca" style="--c:${esc(r.cor)}" aria-pressed="${m.has(r.id)}" aria-label="${esc(r.nome)}" title="${esc(r.nome)}" data-l="${lp.id}" data-r="${r.id}">${CHECK}</button>`).join('')}</div>` : '';
          const n = S.lugares.filter(l => l.pais === id && l.tipo !== 'pais' && S.lr.has(l.id)).length;
          return `<div class="item"><span class="bandeira">${bandeira(id)}</span><button class="txt" ${lp ? `data-abrir="${lp.id}"` : `data-zoom-pais="${esc(id)}"`}><b>${esc(nomePais(id))}</b><small>${lp ? 'País inteiro' : ''}${lp && n ? ' · ' : ''}${n ? `${n} ${n === 1 ? 'lugar' : 'lugares'} na lista` : ''}</small></button>${marcas}</div>`;
        }).join('');
      }
      html += `<button class="add-pais" data-add-pais="1">+ Adicionar país que quero conhecer</button>`;
    }
    if (html) html = avisoMapa(cont.size, totalK.size) + html;
    else if (totalK.size) html = avisoMapa(0, totalK.size) + '<div class="vazio-lista"><b>Nenhum marcado nesta parte do mapa</b>Afaste o mapa ou toque em “Ver todos”.</div>';
    if (!html) html = `<div class="vazio-lista"><b>Nenhum ${aba === 'paises' ? 'país' : 'estado'} ainda</b>Marque lugares como “${esc(S.rotulos.find(r => r.conta_como_visita)?.nome || 'Estive')}” e eles aparecem aqui.</div>`;
  } else {
    const tipos = [aba === 'transporte' ? 'aeroporto' : aba];
    const todos = S.lugares.filter(l => tipos.includes(l.tipo) && (!S.filtroRot || rotulosDe(l.id).has(S.filtroRot)) && (!f || norm(l.nome + ' ' + nomeEstado(l.estado) + ' ' + nomePais(l.pais)).includes(f)));
    const ls = ordena(todos.filter(visivel), aba, l => ({ nome: l.nome, lat: l.lat, lon: l.lon,
      tam: l.tipo === 'cidade' ? popCidade(l)?.pop : l.tipo === 'aeroporto' && rankingAero && l.ref_externa?.startsWith('iata:') ? paxDe(l.ref_externa.slice(5))?.pax : 0 }));
    { const visL = idsVisita(), soL = idsSoLugar(), grupo = l => visitado(l.id, visL) || soLugar(l.id, soL) ? 0 : S.lr.has(l.id) ? 1 : 2;
      ls.sort((a, b) => grupo(a) - grupo(b)); }
    html = avisoMapa(ls.length, todos.length) + ls.map(linhaLugar).join('');
    if (!ls.length && todos.length) html += '<div class="vazio-lista" style="padding:14px 20px"><b>Nenhum marcado nesta parte do mapa</b>Afaste o mapa ou toque em “Ver todos”.</div>';
    // itens da base ainda não marcados, na parte do mapa que está na tela
    const base = S.publico || S.filtroRot ? [] : basePorAba(aba);
    if (base.length) {
      const z = mapa ? mapa.getZoom() : 2;
      const outros = base.filter(b => !lugarDaRef(b.ref) && visivel(b) && (!f || norm(b.nome + ' ' + b.sub).includes(f)) && (aba !== 'transporte' || b.grande || z >= 6 || f) && (aba !== 'atracao' || !ehParque(b) || z >= 5 || f) && (aba !== 'museu' || z >= 8 || f));
      outros.sort((a, b) => (b.rel || 0) - (a.rel || 0) || (b.grande || 0) - (a.grande || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
      if (outros.length) html += `<div class="grupo"><span>${aba === 'unesco' ? 'Outros patrimônios nesta área' : aba === 'atracao' ? 'Outras atrações e parques nesta área' : aba === 'museu' ? 'Outros museus nesta área' : 'Outros aeroportos nesta área'}</span><span>${outros.length}</span></div>`
        + outros.slice(0, 150).map(linhaBase).join('')
        + (outros.length > 150 ? `<div class="vazio-lista">Mais ${outros.length - 150}. Aproxime o mapa ou filtre pelo nome.</div>` : '');
    } else if (!S.publico && (aba === 'unesco' || aba === 'transporte' || aba === 'atracao' || aba === 'museu')) {
      carregaBase(aba === 'unesco' ? 'unesco' : aba === 'atracao' ? 'atracao' : aba === 'museu' ? 'museu' : 'aeroporto').then(() => { renderLista(); desenhaBase(); }).catch(() => {});
    }
    if (!html) html = f ? `<div class="vazio-lista"><b>Nada encontrado</b>Nenhum item com “${esc(S.filtro)}”.</div>`
      : `<div class="vazio-lista"><b>Nenhum item aqui ainda</b>Use a busca lá em cima, toque em “+ Lugar” ou segure o dedo no mapa para adicionar.</div>`;
  }
  $('#lista').innerHTML = html;
}

/* ================= Modais ================= */
function abreModal(html, aoMontar) {
  const fundo = document.createElement('div'); fundo.className = 'fundo';
  fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  fundo.addEventListener('click', e => { if (e.target === fundo) fundo.remove(); });
  $('#modais').appendChild(fundo);
  const fechar = () => fundo.remove();
  aoMontar && aoMontar(fundo.querySelector('.modal'), fechar);
  return fechar;
}
function botaoDuploToque(btn, acao, textoArmado = 'Toque de novo para confirmar') {
  let armado = false, original = btn.textContent, t;
  btn.addEventListener('click', () => {
    if (!armado) { armado = true; btn.classList.add('armado'); btn.textContent = textoArmado; t = setTimeout(() => { armado = false; btn.classList.remove('armado'); btn.textContent = original; }, 3500); return; }
    clearTimeout(t); acao();
  });
}
/* ================= Municípios do Brasil (IBGE) ================= */
// Regra do app: no Brasil, "cidade" é só município oficial do IBGE.
let munPromessa = null;
function carregaMunicipios() {
  return munPromessa ||= fetch('municipios-br.json').then(r => r.json()).then(rows => {
    S.mun = rows.map(([cod, nome, uf, lat, lon]) => ({ cod: String(cod), nome, uf, lat, lon, n: norm(nome) }));
    S.munPorCod = new Map(S.mun.map(m => [m.cod, m]));
    return S.mun;
  }).catch(e => { munPromessa = null; throw e; });
}
const ufDe = estado => (estado || '').startsWith('BR-') ? estado.slice(3) : null;
const refIbge = m => 'ibge:' + m.cod;
function municipioPorNome(nome, uf) { const n = norm(nome); return S.mun?.find(m => m.n === n && (!uf || m.uf === uf)) || null; }
function municipiosProximos(lat, lon, qtd = 4) {
  return [...S.mun].map(m => ({ m, d: distKm(lat, lon, m.lat, m.lon) })).sort((a, b) => a.d - b.d).slice(0, qtd).map(x => x.m);
}
function buscaMunicipios(q, qtd = 6) {
  const n = norm(q); if (n.length < 2 || !S.mun) return [];
  const comeca = [], contem = [];
  for (const m of S.mun) { if (m.n.startsWith(n)) comeca.push(m); else if (m.n.includes(n)) contem.push(m); }
  return [...comeca, ...contem].slice(0, qtd);
}
const cidadeJaCadastrada = m => S.lugares.find(l => l.tipo === 'cidade' && (l.ref_externa === refIbge(m) || (norm(l.nome) === m.n && ufDe(l.estado) === m.uf)));

/* ================= Formulário de lugar ================= */
// nome curto da viagem para as datas do lugar: "Buenos Aires, Argentina - 2026" → "Buenos Aires"
const nomeCurtoViagem = id => { const n = (S.viagens || []).find(x => x.id === id)?.nome || 'viagem'; return n.split(/,| - /)[0].trim(); };
function formLugar({ titulo, l, rotSel, aoSalvar, aoExcluir, sugestoes }) {
  const loc = localizar(l.lat, l.lon, l.pais);
  const opcoesTipo = Object.entries(TIPOS).filter(([k]) => !['pais', 'estado'].includes(k) || l.tipo === k).map(([k, v]) => `<option value="${k}" ${l.tipo === k ? 'selected' : ''}>${v.um}</option>`).join('');
  const chips = S.rotulos.map(r => `<button type="button" class="chip" style="--c:${esc(r.cor)}" data-r="${r.id}" aria-pressed="${rotSel.has(r.id)}" ${rotuloServe(r, l.tipo || 'cidade') || rotSel.has(r.id) ? '' : 'hidden'}>${esc(r.nome)}</button>`).join('');
  abreModal(`
    <h3>${esc(titulo)}</h3>
    ${quadroRanking(l)}
    ${sugestoes ? `<div class="campo"><span class="rotulo-campo">Sugestões de nome</span><div class="chips">${sugestoes.map(s => `<button type="button" class="chip sug" style="--c:var(--map-border)" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : ''}
    <div class="linha">
      <div class="campo" style="flex-basis:220px"><label for="f-nome">Nome</label><input id="f-nome" value="${esc(l.nome || '')}" placeholder="Ex.: Praia do Gunga"></div>
      <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo">${opcoesTipo}</select></div>
    </div>
    <div class="aviso-mun" id="f-aviso" hidden></div>
    <div class="campo"><span class="rotulo-campo">Rótulos</span><div class="chips" id="f-chips">${chips}</div></div>
    ${l.id && visitasDe(l.id).length ? '' : '<button type="button" class="add-pais" id="f-mostra-data" style="margin:0 0 12px;width:100%">+ Adicionar data</button>'}
    <div class="campo" id="f-quando" ${l.id && visitasDe(l.id).length ? '' : 'hidden'}><span class="rotulo-campo">Quando esteve</span>
      <div class="chips" id="f-visitas"></div>
      <div class="add-visita">
        <select id="f-prec" aria-label="Precisão da data"><option value="mes">Mês e ano</option><option value="dia">Dia exato</option><option value="ano">Só o ano</option></select>
        <input id="f-data" type="month" aria-label="Data da visita">
        <button type="button" class="btn" id="f-add-vis">Adicionar</button>
      </div>
    </div>
    ${l.id && !S.publico ? '<div class="campo"><span class="rotulo-campo">Fotos</span><div class="fotos" id="f-fotos"></div></div>' : ''}
    <div class="campo"><label for="f-notas">Notas</label><textarea id="f-notas" placeholder="Quando foi, com quem, o que achou…">${esc(l.notas || '')}</textarea></div>
    <div class="meta">${esc([l.tipo === 'pais' ? null : nomeEstado(loc.estado), nomePais(loc.pais)].filter(Boolean).join(', ') || 'Fora de qualquer país')} · ${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}</div>
    <div class="acoes">
      ${aoExcluir ? '<button class="btn perigo" id="f-excluir" type="button">Excluir</button>' : ''}
      <button class="btn" id="f-cancelar" type="button">Cancelar</button>
      <button class="btn principal" id="f-salvar" type="button">Salvar</button>
    </div>`, (m, fechar) => {
    const sel = new Set(rotSel);
    if (l.id && !S.publico) secaoFotos(m, l.id);
    // visitas: editadas aqui e gravadas junto com o lugar
    let visitas = l.id ? visitasDe(l.id).map(v => ({ ...v })) : [];
    const removidas = [];
    const desenhaVisitas = () => {
      const box = m.querySelector('#f-visitas');
      box.innerHTML = visitas.length ? visitas.sort((a, b) => b.data.localeCompare(a.data)).map((v, i) => `<span class="chip visita" style="--c:var(--visit)">${esc(fmtVisita(v))}${v.viagem_id ? `<small class="vis-vg">· ${esc(nomeCurtoViagem(v.viagem_id))}</small>` : ''}<button type="button" data-tira="${i}" aria-label="Remover ${esc(fmtVisita(v))}">×</button></span>`).join('')
        : '<span class="meta">Nenhuma data ainda</span>';
      box.querySelectorAll('[data-tira]').forEach(b => b.onclick = () => { const [v] = visitas.splice(+b.dataset.tira, 1); if (v.id) removidas.push(v.id); desenhaVisitas(); });
    };
    desenhaVisitas();
    const mostraData = m.querySelector('#f-mostra-data');
    if (mostraData) mostraData.onclick = () => { mostraData.remove(); m.querySelector('#f-quando').hidden = false; };
    const campoData = m.querySelector('#f-data'), campoPrec = m.querySelector('#f-prec');
    campoPrec.onchange = () => {
      const p = campoPrec.value; campoData.value = '';
      campoData.type = p === 'dia' ? 'date' : p === 'mes' ? 'month' : 'number';
      if (p === 'ano') { campoData.min = 1950; campoData.max = new Date().getFullYear() + 1; campoData.placeholder = 'Ano'; }
    };
    m.querySelector('#f-add-vis').onclick = () => {
      const p = campoPrec.value, val = campoData.value.trim();
      let data = null;
      if (p === 'dia' && /^\d{4}-\d{2}-\d{2}$/.test(val)) data = val;
      if (p === 'mes' && /^\d{4}-\d{2}$/.test(val)) data = val + '-01';
      if (p === 'ano' && /^\d{4}$/.test(val)) data = val + '-01-01';
      if (!data) { campoData.focus(); return toast(p === 'ano' ? 'Digite o ano, tipo 2024' : 'Escolha a data'); }
      visitas.push({ data, precisao: p }); campoData.value = ''; desenhaVisitas();
    };
    async function gravaVisitas(lugarId) {
      for (const vid of removidas) { const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_visitas', filtro: { id: vid } }); if (error) throw error; }
      S.visitas = S.visitas.filter(v => !removidas.includes(v.id));
      const novas = visitas.filter(v => !v.id).map(v => ({ id: novoId(), lugar_id: lugarId, data: v.data, precisao: v.precisao }));
      if (novas.length) { const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_visitas', linha: novas }); if (error) throw error; S.visitas.push(...novas.map(v => ({ ...v, nota: null, viagem_id: null }))); }
    }
    const aviso = m.querySelector('#f-aviso'), campoNome = m.querySelector('#f-nome'), campoTipo = m.querySelector('#f-tipo');
    m.querySelectorAll('#f-chips .chip').forEach(b => b.onclick = () => { const r = b.dataset.r; sel.has(r) ? sel.delete(r) : sel.add(r); b.setAttribute('aria-pressed', sel.has(r)); });
    m.querySelectorAll('.chip.sug').forEach(b => b.onclick = () => { campoNome.value = b.dataset.s; aviso.hidden = true; });
    m.querySelector('#f-cancelar').onclick = fechar;
    campoNome.addEventListener('input', () => { aviso.hidden = true; });
    campoTipo.addEventListener('change', () => {
      aviso.hidden = true;
      // esconde rótulos que não valem para o tipo novo (e desmarca)
      m.querySelectorAll('#f-chips .chip').forEach(b => { const r = S.rotulos.find(x => x.id === b.dataset.r), ok = rotuloServe(r, campoTipo.value); b.hidden = !ok; if (!ok) { sel.delete(r.id); b.setAttribute('aria-pressed', 'false'); } });
    });
    if (aoExcluir) botaoDuploToque(m.querySelector('#f-excluir'), async () => { await aoExcluir(); fechar(); });

    // No Brasil, cidade precisa ser município do IBGE
    async function confereMunicipio(nome) {
      if (campoTipo.value !== 'cidade' || loc.pais !== 'BR') return { ok: true, ref: l.ref_externa?.startsWith('ibge:') ? null : (l.ref_externa || null) };
      await carregaMunicipios();
      const uf = ufDe(loc.estado);
      const achou = municipioPorNome(nome, uf) || (l.ref_externa?.startsWith('ibge:') && norm(nome) === norm(S.munPorCod.get(l.ref_externa.slice(5))?.nome) ? S.munPorCod.get(l.ref_externa.slice(5)) : null);
      if (achou) return { ok: true, ref: refIbge(achou), nome: achou.nome, mun: achou };
      const perto = municipiosProximos(l.lat, l.lon, 4);
      aviso.hidden = false;
      aviso.innerHTML = `<b>“${esc(nome)}” não é município${uf ? ' de ' + esc(nomeEstado(loc.estado)) : ''}.</b>
        <span>Pela regra do app, só município conta como cidade. Escolha o município a que ele pertence.</span>
        <div class="chips">${perto.map(p => `<button type="button" class="chip" style="--c:var(--visit)" data-mun="${p.cod}">${esc(p.nome)} · ${p.uf}</button>`).join('')}</div>`;
      aviso.querySelectorAll('[data-mun]').forEach(b => b.onclick = () => { campoNome.value = S.munPorCod.get(b.dataset.mun).nome; aviso.hidden = true; });
      return { ok: false };
    }

    m.querySelector('#f-salvar').onclick = async ev => {
      let nome = campoNome.value.trim();
      if (!nome) { campoNome.focus(); return toast('Dá um nome pro lugar'); }
      ev.target.disabled = true;
      let conf;
      try { conf = await confereMunicipio(nome); } catch { conf = { ok: true, ref: l.ref_externa || null }; toast('Não deu pra conferir a lista do IBGE agora'); }
      if (!conf.ok) { ev.target.disabled = false; return; }
      if (conf.nome) nome = conf.nome;
      if (conf.mun) {
        const ja = cidadeJaCadastrada(conf.mun);
        if (ja && ja.id !== l.id) { ev.target.disabled = false; toast(`${ja.nome} já está na sua lista`); fechar(); return abreLugar(ja.id); }
      }
      // data digitada mas sem tocar em Adicionar: entra também
      if (campoData.value.trim()) m.querySelector('#f-add-vis').click();
      const idSalvo = await aoSalvar({ nome, tipo: campoTipo.value, notas: m.querySelector('#f-notas').value.trim() || null, pais: loc.pais, estado: campoTipo.value === 'pais' ? null : campoTipo.value === 'estado' ? (l.estado || loc.estado) : loc.estado, ref_externa: campoTipo.value === 'pais' && loc.pais ? 'pais:' + loc.pais : (conf.ref ?? null) }, sel);
      if (!idSalvo) { ev.target.disabled = false; return; }
      try { await gravaVisitas(idSalvo); } catch (e) { toast('Lugar salvo, mas as datas falharam: ' + e.message, 4000); }
      atualizaTudo(); fechar();
    };
    if (!l.nome) setTimeout(() => campoNome.focus(), 50);
  });
}
async function salvaRotulosDoLugar(id, sel) {
  const atual = rotulosDe(id);
  const tirar = [...atual.keys()].filter(r => !sel.has(r)), por = [...sel].filter(r => !atual.has(r));
  for (const r of tirar) { const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_lugar_rotulos', filtro: { lugar_id: id, rotulo_id: r } }); if (error) throw error; }
  if (por.length) { const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugar_rotulos', linha: por.map(r => ({ lugar_id: id, rotulo_id: r })) }); if (error) throw error; }
  const m = new Map(); sel.forEach(r => m.set(r, atual.get(r) ?? null));
  if (m.size) S.lr.set(id, m); else S.lr.delete(id);
  if (por.length) setTimeout(() => marcaCidadeDe(id), 300);
}
function novoLugar(dados, sugestoes) {
  const padrao = (dados.rotuloInicial && S.rotulos.find(r => r.id === dados.rotuloInicial)) || S.rotulos.find(r => r.conta_como_visita);
  formLugar({
    titulo: 'Novo lugar', l: dados, rotSel: new Set(padrao ? [padrao.id] : []), sugestoes,
    aoSalvar: async (v, sel) => {
      const data = { id: novoId(), tipo: v.tipo, nome: v.nome, notas: v.notas, lat: dados.lat, lon: dados.lon, pais: v.pais, estado: v.estado, ref_externa: v.ref_externa ?? dados.ref_externa ?? null };
      const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugares', linha: data });
      if (error) { toast('Erro ao salvar: ' + error.message); return false; }
      S.lugares.push(data);
      try { await salvaRotulosDoLugar(data.id, sel); } catch (e) { toast('Lugar salvo, mas os rótulos falharam: ' + e.message); }
      S.aba = v.tipo === 'aeroporto' ? 'transporte' : v.tipo;
      atualizaTudo(); toast(`${v.nome} adicionado`);
      return data.id;
    },
  });
}
// Tocar num ícone do mapa (museu, praça, igreja, estádio, aeroporto...) abre o cadastro com o nome certo.
// Restaurante, loja, farmácia etc. não entram: não são tipos do app.
const POI_OK = new Set(['museum', 'art_gallery', 'attraction', 'monument', 'memorial', 'castle', 'ruins', 'archaeological_site', 'historic',
  'place_of_worship', 'church', 'cathedral', 'park', 'garden', 'zoo', 'aquarium', 'theme_park', 'stadium', 'theatre', 'viewpoint',
  'beach', 'harbor', 'ferry_terminal', 'aerodrome', 'airport', 'town_hall', 'fort', 'lighthouse', 'waterfall', 'peak', 'national_park', 'nature_reserve']);
function poiNoPonto(e) {
  if (!fundo?.vetorial || !fundo.getMaplibreMap) return null;
  const ml = fundo.getMaplibreMap(); if (!ml?.queryRenderedFeatures) return null;
  const pt = ml.project([e.latlng.lng, e.latlng.lat]), r = 24; // margem de um dedo
  const fs = ml.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]])
    .filter(f => f.layer?.type === 'symbol' && f.properties?.name && f.geometry?.type === 'Point'
      && (f.sourceLayer === 'aerodrome_label' || (f.sourceLayer === 'poi' && (POI_OK.has(f.properties.class) || POI_OK.has(f.properties.subclass)))));
  if (!fs.length) return null;
  const d = f => { const q = ml.project(f.geometry.coordinates); return (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2; };
  return fs.sort((a, b) => d(a) - d(b))[0];
}
async function tocaIconeDoMapa(e) {
  if (S.publico) return;
  const f = poiNoPonto(e); if (!f) return;
  const p = f.properties, [lon, lat] = f.geometry.coordinates;
  const nome = p['name:pt'] || p['name:latin'] || p.name;
  const ja = S.lugares.find(l => norm(l.nome) === norm(nome) && distKm(l.lat, l.lon, lat, lon) < 1);
  if (ja) return abreLugar(ja.id);
  const tipo = f.sourceLayer === 'aerodrome_label' || p.class === 'aerodrome' ? 'aeroporto'
    : ['museum', 'art_gallery'].includes(p.class) || p.subclass === 'museum' ? 'museu'
    : 'atracao';
  // aeroporto da base oficial (pelo código IATA) entra ligado ao ranking
  if (tipo === 'aeroporto' && p.iata) { try { await carregaBase('aeroporto'); const b = acharBase('iata:' + p.iata); if (b) return abreBase(b.ref); } catch {} }
  const dados = { lat, lon, tipo, nome, pais: localizar(lat, lon).pais };
  confereMuseuOficial(dados).then(ok => ok && novoLugar(dados));
}
async function novoLugarEm(lat, lon) {
  if (S.publico) return;
  let sugestoes = [], tipo = 'cidade';
  const loc = localizar(lat, lon);
  if (loc.pais === 'BR') {
    try { await carregaMunicipios(); sugestoes = municipiosProximos(lat, lon, 3).map(m => m.nome); } catch {}
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=pt-BR`).then(r => r.json());
    const a = r.address || {};
    const cidade = a.city || a.town || a.municipality || a.village;
    if (loc.pais === 'BR') {
      // município oficial primeiro; o nome do ponto (praia, atração) depois
      const oficial = cidade && municipioPorNome(cidade, ufDe(loc.estado));
      if (oficial) sugestoes = [oficial.nome, ...sugestoes.filter(s => s !== oficial.nome)];
      if (r.name && r.name !== cidade) sugestoes.push(r.name);
    } else {
      sugestoes = [cidade, r.name].filter(Boolean);
    }
    tipo = r.name && r.name !== cidade ? tipoDoResultado(r) : 'cidade';
    if (tipo === 'bairro') tipo = 'cidade';
  } catch {}
  sugestoes = [...new Set(sugestoes)].slice(0, 5);
  novoLugar({ lat, lon, tipo, nome: '' }, sugestoes.length ? sugestoes : null);
}
async function excluiLugar(id) {
  const l = S.lugares.find(x => x.id === id); if (!l) return;
    // guarda tudo antes de apagar, para o Desfazer recriar igual
    const copia = { ...l }, rots = [...rotulosDe(id).keys()], vis = visitasDe(id).map(v => ({ ...v }));
    const { error } = await supa.from('viagem_lugares').delete().eq('id', id);
    if (error) return toast('Erro ao excluir: ' + error.message);
    S.lugares = S.lugares.filter(x => x.id !== id); S.lr.delete(id); S.visitas = (S.visitas || []).filter(v => v.lugar_id !== id); atualizaTudo();
    toast(`${l.nome} excluído`, 6000, { rotulo: 'Desfazer', fn: async () => {
      const { user_id, criado_em, ...reg } = copia;
      const { error: e1 } = await supa.from('viagem_lugares').insert(reg); if (e1) return toast('Não deu pra desfazer: ' + e1.message);
      if (rots.length) await supa.from('viagem_lugar_rotulos').insert(rots.map(r => ({ lugar_id: id, rotulo_id: r })));
      if (vis.length) await supa.from('viagem_visitas').insert(vis.map(v => ({ lugar_id: id, data: v.data, precisao: v.precisao, nota: v.nota || null })));
      await carregaDados(); atualizaTudo(); toast(`${copia.nome} voltou`);
    } });
}
// Toque na lista: só leva até o lugar e mostra o balãozinho de resumo (sem abrir o cadastro)
function mostraNoMapa(id) {
  const l = S.lugares.find(x => x.id === id); if (!l) return;
  centraVisivel([l.lat, l.lon], Math.max(mapa.getZoom(), l.tipo === 'pais' ? 4 : 11));
  setTimeout(() => resumoLugar(l, { getLatLng: () => L.latLng(l.lat, l.lon) }), 250);
}
function abreLugar(id) {
  const l = S.lugares.find(x => x.id === id); if (!l) return;
  centraVisivel([l.lat, l.lon], Math.max(mapa.getZoom(), 9));
  if (S.publico) {
    const rots = S.rotulos.filter(r => rotulosDe(id).has(r.id));
    return abreModal(`<h3>${esc(l.nome)}</h3><p>${esc([TIPOS[l.tipo].um, nomeEstado(l.estado), nomePais(l.pais)].filter(Boolean).join(' · '))}</p>
      <div class="chips">${rots.map(r => `<span class="chip" style="--c:${esc(r.cor)}" aria-pressed="true">${esc(r.nome)}</span>`).join('')}</div>
      <div class="acoes"><button class="btn" id="p-fechar">Fechar</button></div>`, (m, fechar) => { m.querySelector('#p-fechar').onclick = fechar; });
  }
  formLugar({
    titulo: l.nome, l, rotSel: new Set(rotulosDe(id).keys()),
    aoSalvar: async (v, sel) => {
      const mud = { nome: v.nome, tipo: v.tipo, notas: v.notas, pais: v.pais, estado: v.estado, ref_externa: v.ref_externa };
      const { error } = await grava({ tipo: 'atualizar', tabela: 'viagem_lugares', valores: mud, filtro: { id } });
      if (error) { toast('Erro ao salvar: ' + error.message); return false; }
      Object.assign(l, mud);
      try { await salvaRotulosDoLugar(id, sel); } catch (e) { toast('Erro nos rótulos: ' + e.message); }
      atualizaTudo(); toast('Salvo'); return id;
    },
    aoExcluir: () => excluiLugar(id),
  });
}
// leva o mapa até o lugar sem perder o zoom que você deixou: se o ponto já está na tela, nem mexe;
// se está longe, vai até ele e só aproxima se o zoom atual estiver afastado demais
function vaiPara(lat, lon, zoomMin) {
  // já está à vista (fora da parte coberta pela lista)? então nem mexe
  const pt = mapa.latLngToContainerPoint([lat, lon]), tam = mapa.getSize(), m = 30;
  if (pt.x > m && pt.x < tam.x - m && pt.y > m && pt.y < tam.y - alturaLista() - m) return;
  centraVisivel([lat, lon], Math.max(mapa.getZoom(), zoomMin));
}
function abreMunicipio(m) {
  $('#resultados').hidden = true; $('#busca').value = '';
  vaiPara(m.lat, m.lon, 10);
  const ja = cidadeJaCadastrada(m);
  if (ja) return abreLugar(ja.id);
  novoLugar({ lat: m.lat, lon: m.lon, tipo: 'cidade', nome: m.nome, pais: 'BR', ref_externa: refIbge(m) });
}

/* ================= Busca ================= */
// Digitando: municípios do Brasil na hora (lista do IBGE).
// Enter ou "Buscar no mundo": OpenStreetMap em português, sem povoado nem bairro.
const NAO_CIDADE = new Set(['hamlet', 'isolated_dwelling', 'neighbourhood', 'suburb', 'quarter', 'city_block', 'locality', 'farm', 'croft', 'allotments', 'plot', 'borough', 'residential']);
function tipoDoResultado(r) {
  const c = r.category || r.class, t = r.type;
  if (c === 'aeroway') return 'aeroporto';
  if (t === 'museum' || r.addresstype === 'museum') return 'museu';
  if (c === 'place' || c === 'boundary') return NAO_CIDADE.has(t) || NAO_CIDADE.has(r.addresstype) ? 'bairro' : 'cidade';
  if (['tourism', 'historic', 'leisure', 'natural', 'amenity', 'building', 'man_made'].includes(c)) return 'atracao';
  return 'atracao'; // estação, igreja, prédio, parque…: ponto de visita
}
function buscaPaises(q, qtd = 3) {
  const n = norm(q); if (n.length < 2) return [];
  const comeca = [], contem = [];
  for (const p of S.paises) { const k = norm(p.nome || ''); if (k.startsWith(n)) comeca.push(p); else if (k.includes(n)) contem.push(p); }
  return [...comeca, ...contem].slice(0, qtd);
}
const linhasPaises = q => { const ps = buscaPaises(q); return ps.length ? `<div class="grupo-busca">Países</div>${ps.map(p => { const ja = S.lugares.find(l => l.ref_externa === 'pais:' + p.id); return `<button data-pais-busca="${esc(p.id)}"><b>${bandeira(p.id)} ${esc(p.nome)}</b><small>País inteiro, sem escolher cidade${ja ? ' · já está na sua lista' : ''}</small></button>`; }).join('')}` : ''; };
function abrePaisInteiro(id) {
  $('#resultados').hidden = true; $('#busca').value = '';
  const p = S.paisPorId.get(id); if (!p) return;
  mapa.fitBounds([[p.maior[1], p.maior[0]], [p.maior[3], p.maior[2]]]);
  const ja = S.lugares.find(l => l.ref_externa === 'pais:' + id); if (ja) return abreLugar(ja.id);
  const quero = S.rotulos.find(r => norm(r.nome) === 'quero ir') || S.rotulos.find(r => !r.conta_como_visita);
  novoLugar({ lat: (p.maior[1] + p.maior[3]) / 2, lon: (p.maior[0] + p.maior[2]) / 2, tipo: 'pais', nome: p.nome, pais: id, ref_externa: 'pais:' + id, rotuloInicial: paisesVis.has(id) ? null : quero?.id });
}
function linhaMunicipio(m) {
  const ja = cidadeJaCadastrada(m);
  return `<button data-mun="${m.cod}"><b>${esc(m.nome)}</b><small>Município · ${esc(nomeEstado('BR-' + m.uf) || m.uf)}${ja ? ' · já está na sua lista' : ''}</small></button>`;
}
function ligaResultados(box, mundo) {
  box.querySelectorAll('[data-mun]').forEach(b => b.onclick = () => abreMunicipio(S.munPorCod.get(b.dataset.mun)));
  box.querySelectorAll('[data-pais-busca]').forEach(b => b.onclick = () => abrePaisInteiro(b.dataset.paisBusca));
  const bm = box.querySelector('[data-mundo]'); if (bm) bm.onclick = () => buscar($('#busca').value.trim());
  box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
    const x = mundo[+b.dataset.i]; box.hidden = true; $('#busca').value = '';
    const lat = +x.lat, lon = +x.lon; vaiPara(lat, lon, tipoDoResultado(x) === 'cidade' ? 10 : 14);
    const nome = x.name || x.display_name.split(',')[0];
    const ja = S.lugares.find(l => norm(l.nome) === norm(nome) && distKm(l.lat, l.lon, lat, lon) < 15);
    if (ja) return abreLugar(ja.id);
    const dados = { lat, lon, tipo: tipoDoResultado(x), nome, pais: (x.address?.country_code || '').toUpperCase() };
    // aeroporto da busca: usa o da base oficial mais próximo (vem com código, ranking e porte)
    if (dados.tipo === 'aeroporto') return carregaBase('aeroporto').then(base => {
      const perto = base.map(b => [b, distKm(lat, lon, b.lat, b.lon)]).filter(([, d]) => d < 5).sort((a, b) => a[1] - b[1])[0];
      if (perto) return abreBase(perto[0].ref);
      novoLugar(dados);
    }).catch(() => novoLugar(dados));
    confereMuseuOficial(dados).then(ok => ok && novoLugar(dados));
  });
}
// Antes de criar um museu ou atração no Brasil pela busca, procura o mesmo lugar na lista oficial do IBRAM
// (o nome no mapa costuma ser diferente: "Casa Museu Marechal Deodoro" x "Casa de Marechal Deodoro").
const PALAVRAS_VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'museu', 'casa', 'memorial', 'centro', 'cultural', 'espaco', 'municipal', 'historico', 'historica']);
const palavras = t => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !PALAVRAS_VAZIAS.has(w)));
async function confereMuseuOficial(d) {
  // só pergunta quando o resultado parece museu (tipo museu ou nome de museu); praça, parque etc. não
  const pareceMuseu = d.tipo === 'museu' || /\b(museu|museo|memorial|pinacoteca|galeria)\b/.test(norm(d.nome));
  if (d.pais !== 'BR' || !['museu', 'atracao'].includes(d.tipo) || !pareceMuseu) return true;
  let base; try { base = await carregaBase('museu'); } catch { return true; }
  const minhas = palavras(d.nome);
  const cands = base.map(b => ({ b, km: distKm(d.lat, d.lon, b.lat, b.lon), comuns: [...palavras(b.nome)].filter(w => minhas.has(w)).length }))
    .filter(c => c.km < 3 && (c.comuns > 0 || (d.tipo === 'museu' && c.km < 0.3))).sort((a, b) => b.comuns - a.comuns || a.km - b.km).slice(0, 4);
  if (!cands.length) return true;
  return new Promise(ok => {
    const fechar = abreModal(`<h3>Este museu está no cadastro oficial?</h3>
      <p class="meta">Você buscou “${esc(d.nome)}”. Perto dali, o Cadastro Nacional de Museus (IBRAM) tem:</p>
      <div class="escolha-mun">${cands.map((c, i) => `<button type="button" class="btn" data-of="${i}" style="text-align:left;display:grid"><b>${esc(c.b.nome)}</b><small class="meta">${esc(c.b.sub)} · ${c.km < 1 ? Math.round(c.km * 1000) + ' m' : c.km.toFixed(1).replace('.', ',') + ' km'}${lugarDaRef(c.b.ref) ? ' · já está na sua lista' : ''}</small></button>`).join('')}</div>
      <div class="acoes"><button class="btn" id="of-nao">Não, é outro lugar</button></div>`, (m, f) => {
      m.querySelectorAll('[data-of]').forEach(b => b.onclick = () => { f(); ok(false); abreBase(cands[+b.dataset.of].b.ref); });
      m.querySelector('#of-nao').onclick = () => { f(); ok(true); };
    });
  });
}
let digitaTimer;
function sugereEnquantoDigita(q) {
  clearTimeout(digitaTimer);
  const box = $('#resultados');
  if (q.trim().length < 2) { box.hidden = true; return; }
  digitaTimer = setTimeout(async () => {
    try { await carregaMunicipios(); } catch {}
    const ms = buscaMunicipios(q);
    box.hidden = false;
    box.innerHTML = linhasPaises(q) + (ms.length ? `<div class="grupo-busca">Municípios do Brasil</div>${ms.map(linhaMunicipio).join('')}` : '')
      + `<button data-mundo="1" class="mundo"><b>Buscando “${esc(q.trim())}” no mundo…</b><small>Cidades de fora, aeroportos, atrações</small></button>`;
    ligaResultados(box, []);
    // procura no mundo sozinho quando a pessoa para de digitar (sem precisar tocar no botão)
    if (q.trim().length >= 3) digitaTimer = setTimeout(() => { if ($('#busca').value.trim() === q.trim()) buscar(q.trim()); }, 800);
  }, 120);
}
let buscaSeq = 0;
async function buscar(q) {
  if (q.length < 2) return;
  clearTimeout(digitaTimer);
  const box = $('#resultados'); const seq = ++buscaSeq;
  try { await carregaMunicipios(); } catch {}
  const ms = buscaMunicipios(q, 4);
  const topo = linhasPaises(q) + (ms.length ? `<div class="grupo-busca">Municípios do Brasil</div>${ms.map(linhaMunicipio).join('')}` : '');
  box.hidden = false; box.innerHTML = topo + '<div class="vazio">Buscando no mundo…</div>';
  try {
    // além da busca no mundo, procura só na área que está no mapa (com folga): assim a praça da cidade
    // que você está olhando aparece primeiro, mesmo existindo dezenas de lugares com o mesmo nome
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=12&addressdetails=1&accept-language=pt-BR`;
    let area = null;
    if (mapa && mapa.getZoom() >= 5) { const b = mapa.getBounds().pad(0.5); area = [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].map(v => v.toFixed(4)).join(','); }
    const [locais, globais] = await Promise.all([
      area ? fetch(`${url}&viewbox=${area}&bounded=1`).then(r => r.json()).catch(() => []) : Promise.resolve([]),
      fetch(url).then(r => r.json()),
    ]);
    if (seq !== buscaSeq) return;
    locais.forEach(x => x._perto = true);
    const r = [...locais, ...globais.filter(g => !locais.some(l => l.osm_type === g.osm_type && l.osm_id === g.osm_id))];
    // cidades do Brasil já vêm do IBGE; povoados e bairros não entram como cidade
    const mundo = r.filter(x => {
      const t = tipoDoResultado(x), cc = (x.address?.country_code || '').toUpperCase();
      if (t === 'cidade' && cc === 'BR') return false;
      if (t === 'bairro') return false; // povoado e bairro não entram (não são município)
      return true;
    }).filter((x, i, arr) => {
      // mesmo nome a menos de 50 km (cidade e o departamento/distrito de mesmo nome): fica só o primeiro
      const n = norm(x.name || x.display_name.split(',')[0]);
      return !arr.slice(0, i).some(y => norm(y.name || y.display_name.split(',')[0]) === n && distKm(+x.lat, +x.lon, +y.lat, +y.lon) < 50);
    }).slice(0, 10);
    const linha = (x, i) => `<button data-i="${i}"><b>${esc(x.name || x.display_name.split(',')[0])}</b><small>${esc(TIPOS[tipoDoResultado(x)].um)} · ${esc(x.display_name.split(',').slice(1, 4).join(',').trim())}</small></button>`;
    const perto = mundo.map((x, i) => x._perto ? linha(x, i) : '').join(''), longe = mundo.map((x, i) => x._perto ? '' : linha(x, i)).join('');
    const lista = (perto ? `<div class="grupo-busca">Nesta área do mapa</div>${perto}` : '') + (longe ? `<div class="grupo-busca">No mundo</div>${longe}` : '');
    box.innerHTML = topo + (lista ? lista : (topo ? '' : '<div class="vazio">Nada encontrado. Tente outro nome ou segure o dedo no mapa.</div>'));
    ligaResultados(box, mundo);
  } catch {
    box.innerHTML = topo + '<div class="vazio">Sem conexão com a busca no mundo agora. Tente de novo em instantes.</div>';
    ligaResultados(box, []);
  }
}

