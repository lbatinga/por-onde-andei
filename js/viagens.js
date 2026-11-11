'use strict';
/* ================= Viagens ================= */
// Uma viagem tem um roteiro ordenado (viagem_paradas), que pode repetir lugares,
// e um mês de início (viagem_viagens.inicio). As visitas do período ficam ligadas a ela.
const nomeMes = ym => `${MESES[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
// distância do roteiro em linha reta, somando trecho a trecho
function kmViagem(id) {
  const porLugar = new Map(S.lugares.map(l => [l.id, l]));
  const ps = paradasDe(id).map(p => porLugar.get(p.lugar_id)).filter(Boolean);
  let km = 0; for (let i = 1; i < ps.length; i++) km += distKm(ps[i - 1].lat, ps[i - 1].lon, ps[i].lat, ps[i].lon);
  return Math.round(km);
}
const fmtKm = km => `${km.toLocaleString('pt-BR')} km`;
// meio de transporte de cada trecho (fica na parada de chegada)
const TRANSPORTES = { aviao: ['✈️', 'Avião'], onibus: ['🚌', 'Ônibus'], carro: ['🚗', 'Carro'], barco: ['⛴️', 'Barco'], trem: ['🚆', 'Trem'], outro: ['•', 'Outro'] };
function kmPorTransporte(ids) { // ids: viagens (todas se omitido)
  const porLugar = new Map(S.lugares.map(l => [l.id, l])), tot = new Map();
  for (const vg of S.viagens || []) {
    if (ids && !ids.includes(vg.id)) continue;
    const ps = paradasDe(vg.id).filter(p => porLugar.has(p.lugar_id));
    for (let i = 1; i < ps.length; i++) { const a = porLugar.get(ps[i - 1].lugar_id), b = porLugar.get(ps[i].lugar_id), k = trechoLocal(a, b) ? 'local' : (ps[i].transporte || 'sem'); tot.set(k, (tot.get(k) || 0) + distKm(a.lat, a.lon, b.lat, b.lon)); }
  }
  return tot;
}
const resumoTransportes = tot => [...tot].filter(([k]) => TRANSPORTES[k]).sort((a, b) => b[1] - a[1]).map(([k, km]) => `${TRANSPORTES[k][0]} ${fmtKm(Math.round(km))}`).join(' · ');
// trajeto local: entre aeroporto e um lugar a até 60 km (GRU–Guarulhos, MCZ–Maceió); não pergunta transporte
const TERMINAIS = ['aeroporto'];
const trechoLocal = (a, b) => (TERMINAIS.includes(a.tipo) || TERMINAIS.includes(b.tipo)) && a.tipo !== b.tipo && distKm(a.lat, a.lon, b.lat, b.lon) <= 60;
// palpite inicial: aeroporto→aeroporto é avião
function palpiteTransporte(a, b) {
  if ((a.tipo === 'aeroporto' || b.tipo === 'aeroporto') && (a.tipo === b.tipo || distKm(a.lat, a.lon, b.lat, b.lon) > 150)) return 'aviao'; // saiu/chegou de aeroporto e foi longe
  return null;
}
const paradasDe = id => (S.paradas || []).filter(p => p.viagem_id === id).sort((a, b) => a.ordem - b.ordem);
function periodoViagem(vg) {
  const ds = (S.visitas || []).filter(v => v.viagem_id === vg.id).map(v => v.data).concat(vg.inicio ? [vg.inicio] : []).sort();
  if (!ds.length) return '';
  const a = ds[0].slice(0, 7), b = ds[ds.length - 1].slice(0, 7);
  return a === b ? nomeMes(a) : `${nomeMes(a)} a ${nomeMes(b)}`;
}
const inicioViagem = vg => vg.inicio || (S.visitas || []).filter(v => v.viagem_id === vg.id).map(v => v.data).sort()[0] || '';
function sugestoesViagem() {
  const porMes = new Map();
  for (const v of S.visitas || []) { if (v.viagem_id || v.precisao === 'ano') continue; const k = v.data.slice(0, 7); if (!porMes.has(k)) porMes.set(k, []); porMes.get(k).push(v); }
  return [...porMes].filter(([, vs]) => vs.length >= 2).sort((a, b) => b[0].localeCompare(a[0]));
}
function abreViagens() {
  carregaBase('aeroporto').catch(() => {});
  const porLugar = new Map(S.lugares.map(l => [l.id, l]));
  const desenhar = m => {
    const sug = sugestoesViagem();
    const vgs = [...(S.viagens || [])].sort((a, b) => inicioViagem(b).localeCompare(inicioViagem(a)));
    m.querySelector('#vg-corpo').innerHTML = `
      ${vgs.length ? vgs.map(vg => { const ps = paradasDe(vg.id); const paises = new Set(ps.map(p => porLugar.get(p.lugar_id)?.pais).filter(Boolean)); return `<button class="viagem-card" data-vg="${vg.id}"><b>${esc(vg.nome)}</b>${(() => { const vv = (S.voos || []).filter(v => v.viagem_id === vg.id); return vv.length ? `<small>✈ ${vv.length} ${vv.length === 1 ? 'voo' : 'voos'} · ${fmtKm(vv.reduce((t, v) => t + kmVoo(v), 0))} · ${fmtHoras(vv.reduce((t, v) => t + minVoo(v), 0))} no ar</small>` : ''; })()}<small>${esc(periodoViagem(vg))} · ${ps.length} ${ps.length === 1 ? 'parada' : 'paradas'} · ${fmtKm(kmViagem(vg.id))}${(() => { const t = [...kmPorTransporte([vg.id]).keys()].filter(k => TRANSPORTES[k]); return t.length ? ' ' + t.map(k => TRANSPORTES[k][0]).join('') : ''; })()} · ${[...paises].map(bandeira).join(' ')}</small></button>`; }).join('') : '<p>Nenhuma viagem ainda. Crie uma a partir das sugestões abaixo ou do zero.</p>'}
      ${sug.length ? `<h4>Sugestões</h4><p class="meta">Meses com vários lugares visitados que ainda não estão numa viagem.</p>${sug.map(([ym, vs]) => `<div class="sugestao"><span><b>${esc(nomeMes(ym))} · ${vs.length} lugares</b><small>${esc(vs.slice(0, 5).map(v => porLugar.get(v.lugar_id)?.nome).filter(Boolean).join(', '))}${vs.length > 5 ? '…' : ''}</small></span><button class="btn" data-sug="${ym}">Criar</button></div>`).join('')}` : ''}`;
    m.querySelectorAll('[data-vg]').forEach(b => b.onclick = () => editaViagem(S.viagens.find(x => x.id === b.dataset.vg), null, () => desenhar(m)));
    m.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => editaViagem(null, b.dataset.sug, () => desenhar(m)));
  };
  abreModal(`<h3>Viagens</h3><div id="vg-corpo"></div>
    <div class="acoes"><button class="btn" id="vg-fechar">Fechar</button><button class="btn principal" id="vg-nova">Nova viagem</button></div>`, (m, fechar) => {
    m.querySelector('#vg-fechar').onclick = fechar;
    m.querySelector('#vg-nova').onclick = () => editaViagem(null, null, () => desenhar(m));
    desenhar(m);
  });
}
function editaViagem(vg, mesSugerido, aoSalvar) {
  const porLugar = new Map(S.lugares.map(l => [l.id, l]));
  // roteiro: lista ordenada de ids de lugar (pode repetir)
  let roteiro = vg ? paradasDe(vg.id).map(p => ({ id: p.lugar_id, tr: p.transporte || null }))
    : mesSugerido ? (S.visitas || []).filter(v => !v.viagem_id && v.precisao !== 'ano' && v.data.startsWith(mesSugerido)).sort((a, b) => a.data.localeCompare(b.data) || porLugar.get(a.lugar_id).nome.localeCompare(porLugar.get(b.lugar_id).nome, 'pt-BR')).map(v => ({ id: v.lugar_id, tr: null }))
    : [];
  roteiro = roteiro.filter(p => porLugar.has(p.id));
  const mesInicial = (vg?.inicio || inicioViagem(vg || {}) || (mesSugerido ? mesSugerido + '-01' : '')).slice(0, 7);
  const nomePadrao = vg ? vg.nome : mesSugerido ? `Viagem de ${MESES_LONGOS[+mesSugerido.slice(5, 7) - 1]} de ${mesSugerido.slice(0, 4)}` : '';
  abreModal(`
    <h3>${vg ? 'Editar viagem' : 'Nova viagem'}</h3>
    <div class="linha">
      <div class="campo" style="flex-basis:200px"><label for="vg-nome">Nome</label><input id="vg-nome" value="${esc(nomePadrao)}" placeholder="Ex.: Sul e Argentina"></div>
      <div class="campo"><label for="vg-mes">Mês de início</label><input id="vg-mes" type="month" value="${esc(mesInicial)}"></div>
    </div>
    <div class="campo"><span class="rotulo-campo">Roteiro, na ordem em que você foi</span>
      <ol id="vg-roteiro" class="roteiro"></ol>
      <div class="km-linha"><span class="meta" id="vg-km"></span><button type="button" class="link" id="vg-mapa">Ver no mapa</button></div>
      <div class="add-parada">
        <input id="vg-busca" type="search" placeholder="+ Adicionar parada (nome do lugar)" autocomplete="off">
        <div id="vg-achados" class="achados"></div>
      </div>
    </div>
    <p class="meta">Pode repetir lugares (ida e volta pela mesma cidade, por exemplo). Lugares do roteiro sem data no mês da viagem ganham essa data ao salvar.</p>
    <div class="acoes">${vg ? '<button class="btn perigo" id="vg-excluir" style="margin-right:auto">Excluir</button>' : ''}<button class="btn" id="vg-cancelar">Cancelar</button><button class="btn principal" id="vg-salvar">Salvar</button></div>`, (m, fechar) => {
    const lista = m.querySelector('#vg-roteiro');
    const desenharRoteiro = () => {
      lista.innerHTML = roteiro.length ? roteiro.map(({ id, tr }, i) => { const l = porLugar.get(id), ant = i ? porLugar.get(roteiro[i - 1].id) : null;
        const trecho = ant && trechoLocal(ant, l) ? `<li class="trecho local"><span>Trajeto local · ${fmtKm(Math.round(distKm(ant.lat, ant.lon, l.lat, l.lon)))}</span></li>`
          : ant ? `<li class="trecho"><select data-tr="${i}" aria-label="Como foi de ${esc(ant.nome)} até ${esc(l.nome)}"><option value="">Como foi?</option>${Object.entries(TRANSPORTES).map(([k, [ic, nm]]) => `<option value="${k}" ${tr === k ? 'selected' : ''}>${ic} ${nm}</option>`).join('')}</select><span>${fmtKm(Math.round(distKm(ant.lat, ant.lon, l.lat, l.lon)))}</span></li>` : '';
        return trecho + `<li class="parada"><span class="num">${i + 1}</span><span class="tipo">${iconeDe(l)}</span>
        <span class="txt"><b>${esc(l.nome)}</b><small>${esc(nomeEstado(l.estado) || nomePais(l.pais))}</small></span>
        <span class="mover"><button type="button" data-sobe="${i}" aria-label="Subir" ${i ? '' : 'disabled'}>↑</button><button type="button" data-desce="${i}" aria-label="Descer" ${i < roteiro.length - 1 ? '' : 'disabled'}>↓</button><button type="button" data-tira="${i}" aria-label="Tirar">×</button></span></li>`; }).join('')
        : '<li class="meta">Nenhuma parada ainda. Use a busca abaixo.</li>';
      let km = 0; const tot = new Map();
      for (let i = 1; i < roteiro.length; i++) { const a = porLugar.get(roteiro[i - 1].id), b = porLugar.get(roteiro[i].id), d = distKm(a.lat, a.lon, b.lat, b.lon); km += d; const k = trechoLocal(a, b) ? 'local' : (roteiro[i].tr || 'sem'); tot.set(k, (tot.get(k) || 0) + d); }
      const det = resumoTransportes(tot);
      m.querySelector('#vg-km').textContent = roteiro.length > 1 ? `${fmtKm(Math.round(km))} em linha reta${det ? ' · ' + det : ''}` : '';
      lista.querySelectorAll('[data-tr]').forEach(sel => sel.onchange = () => { roteiro[+sel.dataset.tr].tr = sel.value || null; desenharRoteiro(); });
      lista.querySelectorAll('[data-sobe]').forEach(b => b.onclick = () => { const i = +b.dataset.sobe; [roteiro[i - 1], roteiro[i]] = [roteiro[i], roteiro[i - 1]]; desenharRoteiro(); });
      lista.querySelectorAll('[data-desce]').forEach(b => b.onclick = () => { const i = +b.dataset.desce; [roteiro[i + 1], roteiro[i]] = [roteiro[i], roteiro[i + 1]]; desenharRoteiro(); });
      lista.querySelectorAll('[data-tira]').forEach(b => b.onclick = () => { roteiro.splice(+b.dataset.tira, 1); desenharRoteiro(); });
    };
    desenharRoteiro();
    const busca = m.querySelector('#vg-busca'), achados = m.querySelector('#vg-achados');
    busca.oninput = () => {
      const q = norm(busca.value);
      if (q.length < 2) { achados.innerHTML = ''; return; }
      const res = S.lugares.filter(l => norm(l.nome + ' ' + nomeEstado(l.estado)).includes(q)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 8);
      achados.innerHTML = res.length ? res.map(l => `<button type="button" data-add="${l.id}">${iconeDe(l)}<span><b>${esc(l.nome)}</b> <small>${esc(nomeEstado(l.estado) || nomePais(l.pais))}</small></span></button>`).join('') : '<span class="meta">Nenhum lugar seu com esse nome. Cadastre primeiro pelo mapa ou pela busca.</span>';
      achados.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const ant = roteiro.length ? porLugar.get(roteiro[roteiro.length - 1].id) : null; roteiro.push({ id: b.dataset.add, tr: ant ? palpiteTransporte(ant, porLugar.get(b.dataset.add)) : null }); busca.value = ''; achados.innerHTML = ''; desenharRoteiro(); busca.focus(); });
    };
    m.querySelector('#vg-mapa').onclick = () => { if (roteiro.length < 1) return toast('Adicione paradas primeiro'); fechar(); mostraRoteiro(m.querySelector('#vg-nome').value.trim() || 'Viagem', roteiro); };
    m.querySelector('#vg-cancelar').onclick = fechar;
    if (vg) botaoDuploToque(m.querySelector('#vg-excluir'), async () => {
      const { error } = await supa.from('viagem_viagens').delete().eq('id', vg.id); if (error) return toast('Erro: ' + error.message);
      S.viagens = S.viagens.filter(x => x.id !== vg.id); S.paradas = S.paradas.filter(p => p.viagem_id !== vg.id); S.visitas.forEach(v => { if (v.viagem_id === vg.id) v.viagem_id = null; });
      fechar(); aoSalvar && aoSalvar(); toast('Viagem excluída');
    });
    m.querySelector('#vg-salvar').onclick = async ev => {
      const nome = m.querySelector('#vg-nome').value.trim(); if (!nome) return m.querySelector('#vg-nome').focus();
      const mes = m.querySelector('#vg-mes').value; const inicio = /^\d{4}-\d{2}$/.test(mes) ? mes + '-01' : null;
      if (!roteiro.length) return toast('Adicione pelo menos uma parada');
      ev.target.disabled = true;
      try {
        let id = vg?.id;
        if (vg) { const { error } = await supa.from('viagem_viagens').update({ nome, inicio }).eq('id', id); if (error) throw error; Object.assign(vg, { nome, inicio }); }
        else { const { data, error } = await supa.from('viagem_viagens').insert({ nome, inicio }).select().single(); if (error) throw error; id = data.id; S.viagens.push(data); }
        // roteiro: troca tudo pela ordem nova
        const { error: e1 } = await supa.from('viagem_paradas').delete().eq('viagem_id', id); if (e1) throw e1;
        const { data: novas, error: e2 } = await supa.from('viagem_paradas').insert(roteiro.map((p, i) => ({ viagem_id: id, lugar_id: p.id, ordem: i + 1, transporte: i && !trechoLocal(porLugar.get(roteiro[i - 1].id), porLugar.get(p.id)) ? p.tr : null }))).select(); if (e2) throw e2;
        S.paradas = (S.paradas || []).filter(p => p.viagem_id !== id).concat(novas);
        // visitas: liga as do período (até ~2,5 meses do início) e cria as que faltam
        if (inicio) {
          const perto = d => Math.abs(new Date(d) - new Date(inicio)) < 75 * 864e5;
          const lugares = [...new Set(roteiro.map(p => p.id))];
          const ligar = [], criar = [];
          for (const lid of lugares) {
            const v = (S.visitas || []).filter(x => x.lugar_id === lid && x.precisao !== 'ano' && (!x.viagem_id || x.viagem_id === id) && perto(x.data)).sort((a, b) => a.data.localeCompare(b.data))[0];
            if (v) ligar.push(v.id); else criar.push({ lugar_id: lid, data: inicio, precisao: 'mes', viagem_id: id });
          }
          const soltar = (S.visitas || []).filter(x => x.viagem_id === id && !ligar.includes(x.id)).map(x => x.id);
          if (soltar.length) { const { error } = await supa.from('viagem_visitas').update({ viagem_id: null }).in('id', soltar); if (error) throw error; }
          if (ligar.length) { const { error } = await supa.from('viagem_visitas').update({ viagem_id: id }).in('id', ligar); if (error) throw error; }
          S.visitas.forEach(x => { if (soltar.includes(x.id)) x.viagem_id = null; if (ligar.includes(x.id)) x.viagem_id = id; });
          if (criar.length) { const { data, error } = await supa.from('viagem_visitas').insert(criar).select('id,lugar_id,data,precisao,nota,viagem_id'); if (error) throw error; S.visitas.push(...data); }
        }
        fechar(); aoSalvar && aoSalvar(); atualizaTudo(); toast('Viagem salva');
      } catch (e) { toast('Erro: ' + e.message); ev.target.disabled = false; }
    };
  });
}
// desenha o roteiro no mapa: linha na ordem e paradas numeradas
let camadaRoteiro = null;
function mostraRoteiro(nome, roteiro) {
  const porLugar = new Map(S.lugares.map(l => [l.id, l]));
  const paradas = roteiro.filter(p => porLugar.has(p.id)), pts = paradas.map(p => porLugar.get(p.id));
  if (camadaRoteiro) camadaRoteiro.remove();
  // avião pontilhado, barco tracejado azul, terra linha cheia, sem informação tracejado
  const estilo = { aviao: { dashArray: '2 8' }, barco: { dashArray: '10 6', color: '#2b7bb9' }, onibus: { dashArray: null, weight: 4 }, carro: { dashArray: null, weight: 4 }, trem: { dashArray: null, weight: 4, color: '#6d4aa8' } };
  const trechos = pts.slice(1).map((b, i) => { const a = pts[i], local = trechoLocal(a, b), tr = local ? null : paradas[i + 1].tr;
    return L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: corToken('--accent'), opacity: 0.9, weight: 3, dashArray: '6 6', ...(local ? { dashArray: null, weight: 2, color: '#6b7c7d' } : estilo[tr] || {}) })
      .bindTooltip(`${local ? 'Trajeto local · ' : tr ? TRANSPORTES[tr].join(' ') + ' · ' : ''}${fmtKm(Math.round(distKm(a.lat, a.lon, b.lat, b.lon)))}`, { sticky: true }); });
  camadaRoteiro = L.layerGroup([
    ...trechos,
    ...pts.map((l, i) => L.marker([l.lat, l.lon], { zIndexOffset: 1000, icon: L.divIcon({ className: 'num-roteiro', html: `<div>${i + 1}</div>`, iconSize: [0, 0] }), title: l.nome })),
  ]).addTo(mapa);
  if (pts.length) mapa.fitBounds(L.latLngBounds(pts.map(l => [l.lat, l.lon])).pad(0.2));
  const aviso = $('#aviso-mira');
  aviso.innerHTML = `Roteiro: ${esc(nome)} <button id="fecha-roteiro">Fechar</button>`; aviso.hidden = false;
  aviso.querySelector('#fecha-roteiro').onclick = e => { e.stopPropagation(); camadaRoteiro.remove(); camadaRoteiro = null; aviso.hidden = true; aviso.innerHTML = 'Toque no mapa onde fica o lugar <button id="cancelar-mira">Cancelar</button>'; aviso.querySelector('#cancelar-mira').onclick = ev => { ev.stopPropagation(); saiMira(); }; };
}

/* ================= Linha do tempo ================= */
function abreLinhaDoTempo() {
  const porLugar = new Map(S.lugares.map(l => [l.id, l]));
  const vs = (S.visitas || []).filter(v => porLugar.has(v.lugar_id)).sort((a, b) => b.data.localeCompare(a.data));
  const semData = S.lugares.filter(l => S.lr.has(l.id) && !vs.some(v => v.lugar_id === l.id)).length;
  // cada viagem vira um cartão; visitas soltas aparecem uma a uma
  const itens = [];
  for (const vg of S.viagens || []) { const d = inicioViagem(vg); if (d && paradasDe(vg.id).length) itens.push({ tipo: 'viagem', data: d, vg }); }
  for (const v of vs) if (!(v.viagem_id && itens.some(it => it.vg?.id === v.viagem_id))) itens.push({ tipo: 'visita', data: v.data, v });
  itens.sort((a, b) => b.data.localeCompare(a.data));
  let html = '', anoAtual = null;
  for (const it of itens) {
    const ano = it.data.slice(0, 4);
    if (ano !== anoAtual) {
      const doAno = vs.filter(x => x.data.startsWith(ano));
      const nLug = new Set(doAno.map(x => x.lugar_id)).size, nPais = new Set(doAno.map(x => porLugar.get(x.lugar_id).pais).filter(Boolean)).size;
      html += `<div class="ano"><b>${ano}</b><span>${nLug} ${nLug === 1 ? 'lugar' : 'lugares'} · ${nPais} ${nPais === 1 ? 'país' : 'países'}</span></div>`;
      anoAtual = ano;
    }
    if (it.tipo === 'viagem') {
      const ps = paradasDe(it.vg.id).filter(p => porLugar.has(p.lugar_id));
      const paises = new Set(ps.map(p => porLugar.get(p.lugar_id).pais).filter(Boolean));
      html += `<div class="viagem-tl"><button class="viagem-topo" data-vg="${it.vg.id}"><b>${esc(it.vg.nome)}</b><small>${esc(periodoViagem(it.vg))} · ${ps.length} paradas · ${fmtKm(kmViagem(it.vg.id))} ${[...paises].map(bandeira).join(' ')}</small></button>
        <div class="viagem-lugares">${ps.map((p, i) => { const l = porLugar.get(p.lugar_id); return `<button class="chip-lugar" data-ir="${l.id}"><i>${i + 1}</i>${iconeDe(l)}${esc(l.nome)}</button>`; }).join('')}</div>
        <button class="link-btn" data-rota="${it.vg.id}">Ver roteiro no mapa</button></div>`;
    } else {
      const v = it.v, l = porLugar.get(v.lugar_id);
      const quando = v.precisao === 'ano' ? 'Durante o ano' : v.precisao === 'mes' ? MESES_LONGOS[+v.data.slice(5, 7) - 1] : fmtVisita(v);
      html += `<button class="evento" data-ir="${l.id}"><span class="tipo">${iconeDe(l)}</span><span class="txt"><b>${esc(l.nome)}</b><small>${esc(quando)} · ${esc([nomeEstado(l.estado), nomePais(l.pais)].filter(Boolean).join(', '))}</small></span></button>`;
    }
  }
  abreModal(`
    <h3>Linha do tempo</h3>
    ${vs.length ? '' : '<p>Ainda não tem nenhuma data. Abra um lugar e use “Quando esteve” para registrar suas visitas.</p>'}
    <div class="linha-tempo">${html}</div>
    ${semData ? `<p class="meta">${semData} ${semData === 1 ? 'lugar marcado ainda não tem' : 'lugares marcados ainda não têm'} data.</p>` : ''}
    <div class="acoes"><button class="btn" id="lt-viagens">Organizar viagens</button><button class="btn" id="lt-fechar">Fechar</button></div>`, (m, fechar) => {
    m.querySelector('#lt-fechar').onclick = fechar;
    m.querySelector('#lt-viagens').onclick = () => { fechar(); abreViagens(); };
    m.querySelectorAll('[data-vg]').forEach(b => b.onclick = () => { fechar(); editaViagem(S.viagens.find(x => x.id === b.dataset.vg), null, abreLinhaDoTempo); });
    m.querySelectorAll('[data-rota]').forEach(b => b.onclick = () => { fechar(); const vg = S.viagens.find(x => x.id === b.dataset.rota); mostraRoteiro(vg.nome, paradasDe(vg.id).map(p => ({ id: p.lugar_id, tr: p.transporte || null }))); });
    m.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { fechar(); const l = porLugar.get(b.dataset.ir); S.aba = l.tipo === 'aeroporto' ? 'transporte' : l.tipo; atualizaTudo(); abreLugar(l.id); });
  });
}

