'use strict';
/* ================= Voos (diário de bordo) ================= */
// Cada voo: data, número, companhia, origem e destino (IATA), horários locais, avião e matrícula.
// A busca pelo número e data usa a AeroDataBox pela função "voo" do Supabase (a chave fica lá).
let promCias, promModelos;
const carregaCias = () => { carregaHistCias(); return promCias ||= fetch('aerolinhas.json').then(r => r.json()).catch(e => { promCias = null; throw e; }); };
// Histórico das companhias (Wikidata): qual empresa usava o código na data do voo e o logo dela na época.
// Uma empresa que só trocou de nome ou de logo (TAM → LATAM Brasil, Gol) continua sendo uma companhia só.
let promHist;
const carregaHistCias = () => promHist ||= fetch('cias-historico.json').then(r => r.json()).then(h => { S.histCias = h || {}; agendaSelos(); return S.histCias; }).catch(() => (S.histCias = {}));
const primeiraPalavra = t => norm(t || '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] || '';
function empresaDoVoo(v) {
  const l = S.histCias?.[v.cia]; if (!l?.length || !v.data) return null;
  const naData = l.filter(e => (!e.i || e.i <= v.data) && (!e.f || v.data <= e.f)); if (!naData.length) return null;
  const p = primeiraPalavra(v.cia_nome);
  return (p && naData.find(e => primeiraPalavra(e.n) === p || norm(e.n).includes(p))) || naData.find(e => !e.f) || naData[0];
}
const chaveCia = v => empresaDoVoo(v)?.q || v.cia || v.cia_nome || '';
const urlCommons = f => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=240`;
// logo da época: logo com datas que cobrem o voo; empresa extinta usa o logo dela; empresa ativa usa o logo
// de hoje só se o nome não mudou desde o voo. Sem nada disso, null (o app mostra o selo com o nome).
function logoVoo(v, cias) {
  if (!v.cia) return null;
  const mesmoNome = !v.cia_nome || !cias?.[v.cia] || primeiraPalavra(v.cia_nome) === primeiraPalavra(cias[v.cia]);
  const e = empresaDoVoo(v);
  if (!e) return (!S.histCias?.[v.cia] || mesmoNome) ? logoCia(v) : null;
  const logos = e.l || [];
  const datado = logos.find(([, a, b]) => (a || b) && (!a || a <= v.data) && (!b || v.data <= b));
  if (datado) return urlCommons(datado[0]);
  if (e.f) { const sem = logos.find(([, a, b]) => !a && !b) || logos.at(-1); return sem ? urlCommons(sem[0]) : null; }
  return mesmoNome ? logoCia(v) : null;
}
const carregaModelos = () => promModelos ||= fetch('aeronaves.json').then(r => r.json()).catch(e => { promModelos = null; throw e; });
const aeroPorIata = iata => (S.baseAero || []).find(b => b.iata === iata);
const kmVoo = v => { const a = aeroPorIata(v.origem), b = aeroPorIata(v.destino); return a && b ? Math.round(distKm(a.lat, a.lon, b.lat, b.lon)) : 0; };
// tempo de voo: o registrado; sem ele, estimativa pela distância (800 km/h + 30 min de solo e subida)
const minVoo = v => v.minutos || Math.round(kmVoo(v) / 800 * 60 + 30);
const fmtHoras = min => min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
const nomeCia = (v, cias) => { const e = v.cia_nome && empresaDoVoo(v); if (e?.f && primeiraPalavra(e.n) !== primeiraPalavra(v.cia_nome)) return e.n; return v.cia_nome || (cias && cias[v.cia]) || v.cia || 'Sem companhia'; };
const fabricante = modelo => { const m = (modelo || '').trim(); if (!m) return null; const p = m.split(/[\s/]+/)[0]; return /^(Aerospatiale|ATR)/i.test(m) ? 'ATR' : p.replace(/^de$/i, 'De Havilland'); };
const cidadeAero = iata => { const a = aeroPorIata(iata); return a ? (a.sub.split(' · ')[1] || '').split(',')[0] : ''; };
const ordemVoos = () => [...(S.voos || [])].sort((a, b) => b.data.localeCompare(a.data) || (b.partida || '').localeCompare(a.partida || ''));
function abreVoos() {
  Promise.all([carregaBase('aeroporto'), carregaCias(), carregaHistCias()]).catch(() => {}).then(async () => {
    const cias = await carregaCias().catch(() => ({}));
    const desenhar = m => {
      const vs = ordemVoos(), anos = new Map();
      vs.forEach(v => { const a = v.data.slice(0, 4); if (!anos.has(a)) anos.set(a, []); anos.get(a).push(v); });
      m.querySelector('#vo-corpo').innerHTML = vs.length ? [...anos].map(([ano, lista]) => `<h4>${ano} · ${lista.length} ${lista.length === 1 ? 'voo' : 'voos'}</h4>
        ${lista.map(v => `<button class="voo-card" data-voo="${v.id}">
          <span class="voo-rota"><b>${esc(v.origem)}</b><i>✈</i><b>${esc(v.destino)}</b></span>
          <span class="voo-info"><b>${esc([v.numero, nomeCia(v, cias)].filter(Boolean).join(' · '))}</b>
          <small>${esc([new Date(v.data + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }), cidadeAero(v.origem) && cidadeAero(v.destino) ? `${cidadeAero(v.origem)} → ${cidadeAero(v.destino)}` : '', v.modelo, v.matricula].filter(Boolean).join(' · '))}</small></span><span class="voo-edita">Editar ›</span></button>`).join('')}`).join('')
        : '<p class="meta">Nenhum voo ainda. Toque em “Novo voo”: com o número e a data, o app busca o resto.</p>';
      const inc = incompletos();
      if (inc.length) m.querySelector('#vo-corpo').insertAdjacentHTML('afterbegin', `<div class="sugestao"><span><b>${inc.length} ${inc.length === 1 ? 'voo com dados faltando' : 'voos com dados faltando'}</b><small>Último ano: avião e matrícula. Mais antigos no Brasil: horários e avião pela ANAC.</small></span><button class="btn" id="vo-completar">Completar</button></div>`);
      const bc = m.querySelector('#vo-completar'); if (bc) bc.onclick = () => completaVoos(bc, () => m._depois ? m._depois() : desenhar(m));
      m.querySelectorAll('[data-voo]').forEach(b => b.onclick = () => editaVoo(S.voos.find(x => x.id === b.dataset.voo), () => m._depois ? m._depois() : desenhar(m)));
    };
    abreModal(`<h3>Voos</h3>
      <div class="abas-band st-abas" role="tablist"><button role="tab" data-vo="pass">Passaporte</button><button role="tab" data-vo="lista">Lista</button></div>
      <section data-vo-sec="pass"><div id="vo-pass"><p class="meta">Carregando…</p></div></section>
      <section data-vo-sec="lista" hidden><div id="vo-corpo"></div><p class="meta">Busca de voos: dados da <a href="https://aerodatabox.com" target="_blank" rel="noopener">AeroDataBox</a>.</p></section>
      <div class="acoes"><button class="btn" id="vo-fechar">Fechar</button><button class="btn principal" id="vo-novo">Novo voo</button></div>`, (m, fechar) => {
      const passaporte = () => htmlPassaporte().then(h => { const box = m.querySelector('#vo-pass'); if (box) { box.innerHTML = h; carregaFotos(box); const bc = box.querySelector('#pp-carteira'); if (bc) bc.onclick = () => adicionaCarteira(bc); } }).catch(() => {});
      const aba = a => { m.querySelectorAll('[data-vo]').forEach(b => b.setAttribute('aria-selected', b.dataset.vo === a)); m.querySelectorAll('[data-vo-sec]').forEach(x => x.hidden = x.dataset.voSec !== a); try { localStorage.setItem('poa-vo-aba', a); } catch {} };
      m.querySelectorAll('[data-vo]').forEach(b => b.onclick = () => aba(b.dataset.vo));
      aba((() => { try { return (S.voos || []).length ? localStorage.getItem('poa-vo-aba') || 'pass' : 'lista'; } catch { return 'pass'; } })());
      m.querySelector('#vo-fechar').onclick = fechar;
      const depois = () => { desenhar(m); passaporte(); };
      // voo novo: mostra na Lista, onde dá para tocar nele e editar ou excluir
      m.querySelector('#vo-novo').onclick = () => editaVoo(null, () => { depois(); aba('lista'); toast('Voo salvo. Para editar ou excluir, toque nele na Lista', 4000); });
      desenhar(m); passaporte();
      m._depois = depois;
    });
  });
}
// voos do último ano com número, mas sem avião ou matrícula: a busca ainda alcança
const recente = v => Date.now() - Date.parse(v.data) < 355 * 864e5;
const semAnac = () => { try { return new Set(JSON.parse(localStorage.getItem('poa-sem-anac') || '[]')); } catch { return new Set(); } };
const incompletos = () => { const tentados = semAnac(); return (S.voos || []).filter(v => v.numero && (recente(v) ? (!v.modelo || !v.matricula) : (!v.modelo || !v.minutos) && v.data >= '2000-01-01' && !tentados.has(v.id))); };
async function completaVoos(botao, depois) {
  const lista = incompletos(); let feitos = 0, achou = 0;
  botao.disabled = true;
  const tentados = semAnac();
  for (const v of lista) {
    botao.textContent = `${++feitos} de ${lista.length}…${recente(v) ? '' : ' (ANAC, pode demorar)'}`;
    let ts; try { ts = await buscaVoo(v.numero, v.data); } catch (e) { toast(e.message, 4000); break; }
    const t = ts.find(x => x.origem === v.origem && x.destino === v.destino) || (ts.length === 1 ? ts[0] : null);
    if (!t) { if (!recente(v)) tentados.add(v.id); continue; }
    const novo = {}; // só preenche o que está vazio
    if (!v.partida && t.partida) novo.partida = t.partida;
    if (!v.chegada && t.chegada) novo.chegada = t.chegada;
    if (!v.modelo && t.modelo) novo.modelo = t.modelo;
    if (!v.matricula && t.matricula) novo.matricula = t.matricula;
    if (!v.minutos && t.minutos) novo.minutos = t.minutos;
    if (!v.cia_nome && t.cia_nome) novo.cia_nome = t.cia_nome;
    if (!Object.keys(novo).length) continue;
    const { error } = await grava({ tipo: 'atualizar', tabela: 'viagem_voos', valores: novo, filtro: { id: v.id } });
    if (!error) { Object.assign(v, novo); achou++; }
  }
  try { localStorage.setItem('poa-sem-anac', JSON.stringify([...tentados])); } catch {}
  toast(achou ? `${achou} ${achou === 1 ? 'voo completado' : 'voos completados'}` : 'A busca não trouxe avião nem matrícula para esses voos', 4000);
  atualizaTudo(); depois?.();
}
async function buscaVoo(numero, data) {
  const { data: r, error } = await supa.functions.invoke('voo', { body: { numero, data } });
  if (error) {
    let corpo = null; try { corpo = await error.context?.json?.(); } catch {}
    if (corpo?.erro === 'sem_chave') throw new Error('A busca automática ainda não está configurada.');
    if (corpo?.erro === 'pedido_invalido') throw new Error('Confira o número (ex.: G31673) e a data.');
    throw new Error('Não deu para buscar agora. Preencha à mão ou tente mais tarde.');
  }
  const ts = r?.trechos || [];
  if (r?.fonte !== 'anac') return ts;
  await carregaBase('aeroporto').catch(() => {});
  const modelos = await carregaModelos().catch(() => []);
  const porIcao = new Map((S.baseAero || []).filter(b => b.icao).map(b => [b.icao, b.iata]));
  // "TAM LINHAS AÉREAS S.A." → "TAM"; "AZUL LINHAS AÉREAS BRASILEIRAS S.A." → "Azul"
  const nomeEpoca = e => { if (!e) return null; let n = e.replace(/\(.*?\)/g, '').replace(/\b(LINHAS A[ÉE]REAS|TRANSPORTES A[ÉE]REOS|BRASILEIRAS|S\.?\s?A\.?|LTDA\.?|INC\.?|AIRLINES?|LINEAS AEREAS)\b/gi, '').replace(/[\s,.-]+$/, '').trim(); return n.length <= 3 ? n.toUpperCase() : n.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); };
  return ts.map(t => ({ ...t, origem: porIcao.get(t.origem_icao) || null, destino: porIcao.get(t.destino_icao) || null,
    modelo: (t.modelo_icao && modelos.find(m => m[2] === t.modelo_icao)?.[0]) || t.modelo_icao || null, cia_nome: nomeEpoca(t.empresa) })).filter(t => t.origem && t.destino);
}
function editaVoo(v, aoSalvar) {
  const novo = !v; v = v || { data: new Date().toISOString().slice(0, 10) };
  Promise.all([carregaBase('aeroporto'), carregaCias(), carregaModelos()]).catch(() => {}).then(async () => {
    const cias = await carregaCias().catch(() => ({})), modelos = await carregaModelos().catch(() => []);
    const vgs = [...(S.viagens || [])].sort((a, b) => inicioViagem(b).localeCompare(inicioViagem(a)));
    abreModal(`<h3>${novo ? 'Novo voo' : 'Editar voo'}</h3>
      <div class="voo-form">
        <div class="campo"><label for="vf-data">Data</label><input id="vf-data" type="date" value="${esc(v.data)}"></div>
        <div class="campo"><label for="vf-num">Número do voo</label><div class="voo-busca"><input id="vf-num" placeholder="G31673" autocapitalize="characters" value="${esc(v.numero || '')}"><button class="btn" id="vf-buscar" type="button">Buscar</button></div></div>
        <div id="vf-trechos"></div>
        <div class="campo"><label for="vf-org">De</label><input id="vf-org" maxlength="3" placeholder="MCZ" autocapitalize="characters" value="${esc(v.origem || '')}"><small id="vf-org-n" class="meta"></small></div>
        <div class="campo"><label for="vf-dst">Para</label><input id="vf-dst" maxlength="3" placeholder="GRU" autocapitalize="characters" value="${esc(v.destino || '')}"><small id="vf-dst-n" class="meta"></small></div>
        <div class="campo"><label for="vf-sai">Partida</label><input id="vf-sai" type="time" value="${esc(v.partida || '')}"></div>
        <div class="campo"><label for="vf-che">Chegada</label><input id="vf-che" type="time" value="${esc(v.chegada || '')}"></div>
        <div class="campo"><label for="vf-cia">Companhia (código)</label><input id="vf-cia" maxlength="3" placeholder="G3" autocapitalize="characters" value="${esc(v.cia || '')}"><small id="vf-cia-n" class="meta"></small></div>
        <div class="campo"><label for="vf-mat">Matrícula</label><input id="vf-mat" placeholder="PR-GXA" autocapitalize="characters" value="${esc(v.matricula || '')}"></div>
        <div class="campo"><label for="vf-mod">Avião</label><input id="vf-mod" list="vf-modelos" placeholder="Boeing 737-800" value="${esc(v.modelo || '')}"><datalist id="vf-modelos">${modelos.map(x => `<option value="${esc(x[0])}">`).join('')}</datalist></div>
        ${vgs.length ? `<div class="campo"><label for="vf-vg">Viagem</label><select id="vf-vg"><option value="">Nenhuma</option>${vgs.map(x => `<option value="${x.id}" ${v.viagem_id === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>` : ''}
        <div class="campo"><label for="vf-notas">Notas</label><input id="vf-notas" value="${esc(v.notas || '')}"></div>
      </div>
      <p class="meta">A busca usa a <a href="https://aerodatabox.com" target="_blank" rel="noopener">AeroDataBox</a> no último ano e os registros da ANAC para voos mais antigos no Brasil (sem matrícula).</p>
      <div class="acoes">${novo ? '' : '<button class="btn perigo" id="vf-apagar">Excluir</button>'}<button class="btn" id="vf-cancelar">Cancelar</button><button class="btn principal" id="vf-salvar">Salvar</button></div>`, (m, fechar) => {
      const $m = s => m.querySelector(s);
      let minutos = v.minutos || null, ciaNome = v.cia_nome || null;
      const nomeAero = (inp, out) => { const a = aeroPorIata(inp.value.trim().toUpperCase()); $m(out).textContent = a ? a.nome : inp.value.trim().length === 3 ? 'Aeroporto fora da lista' : ''; };
      const nomeDaCia = () => { const c = $m('#vf-cia').value.trim().toUpperCase(); $m('#vf-cia-n').textContent = c ? (ciaNome && c === v.cia ? ciaNome : cias[c] || '') : ''; };
      $m('#vf-org').oninput = () => nomeAero($m('#vf-org'), '#vf-org-n'); $m('#vf-dst').oninput = () => nomeAero($m('#vf-dst'), '#vf-dst-n');
      $m('#vf-cia').oninput = () => { ciaNome = null; nomeDaCia(); };
      // companhia sai do começo do número (G31673 → G3)
      $m('#vf-num').oninput = () => { const n = $m('#vf-num').value.toUpperCase().replace(/\s/g, ''); if (/^[A-Z0-9]{2}\d/.test(n) && !$m('#vf-cia').value) { $m('#vf-cia').value = n.slice(0, 2); nomeDaCia(); } };
      nomeAero($m('#vf-org'), '#vf-org-n'); nomeAero($m('#vf-dst'), '#vf-dst-n'); nomeDaCia();
      const preenche = t => {
        const set = (id, val) => { if (val) $m(id).value = val; };
        set('#vf-num', t.numero); set('#vf-org', t.origem); set('#vf-dst', t.destino); set('#vf-cia', t.cia); set('#vf-sai', t.partida); set('#vf-che', t.chegada); set('#vf-mod', t.modelo); set('#vf-mat', t.matricula);
        minutos = t.minutos || minutos; ciaNome = t.cia_nome || ciaNome; v = { ...v, cia: t.cia };
        nomeAero($m('#vf-org'), '#vf-org-n'); nomeAero($m('#vf-dst'), '#vf-dst-n'); nomeDaCia(); $m('#vf-trechos').innerHTML = '';
      };
      $m('#vf-buscar').onclick = async () => {
        const b = $m('#vf-buscar'), caixa = $m('#vf-trechos'); b.disabled = true;
        const velho = Date.now() - Date.parse($m('#vf-data').value) > 355 * 864e5;
        caixa.innerHTML = `<p class="meta">${velho ? 'Buscando nos registros da ANAC (voos no Brasil desde 2000). Pode levar até 1 minuto…' : 'Buscando…'}</p>`;
        try {
          const ts = await buscaVoo($m('#vf-num').value, $m('#vf-data').value);
          if (!ts.length) caixa.innerHTML = `<p class="meta">${velho ? 'Não achei esse voo nos registros da ANAC. Eles só têm voos que passam pelo Brasil, desde 2000; fora disso, preencha à mão.' : 'Voo não encontrado nessa data. Confira o número e a data.'}</p>`;
          else if (ts.length === 1) preenche(ts[0]);
          else { // voo com escala: mesmo número em mais de um trecho
            caixa.innerHTML = `<p class="meta">Esse número tem ${ts.length} trechos. Qual foi o seu?</p><div class="menu-lista">${ts.map((t, i) => `<button data-tr="${i}">${esc(t.origem)} → ${esc(t.destino)}<small>${esc([t.partida, t.modelo].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`;
            caixa.querySelectorAll('[data-tr]').forEach(x => x.onclick = () => preenche(ts[+x.dataset.tr]));
          }
        } catch (e) { caixa.innerHTML = `<p class="meta">${esc(e.message)}</p>`; }
        b.disabled = false;
      };
      $m('#vf-cancelar').onclick = fechar;
      if (!novo) $m('#vf-apagar').onclick = async () => {
        if (!confirm('Excluir este voo? Os aeroportos continuam marcados.')) return;
        const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_voos', filtro: { id: v.id } });
        if (error) return toast('Erro: ' + error.message);
        S.voos = S.voos.filter(x => x.id !== v.id); atualizaTudo(); fechar(); aoSalvar?.(); toast('Voo excluído');
      };
      $m('#vf-salvar').onclick = async () => {
        const up = s => $m(s).value.trim().toUpperCase();
        const linha = { data: $m('#vf-data').value, numero: up('#vf-num').replace(/\s/g, '') || null, cia: up('#vf-cia') || null, cia_nome: ciaNome || (cias[up('#vf-cia')] ?? null),
          origem: up('#vf-org'), destino: up('#vf-dst'), partida: $m('#vf-sai').value || null, chegada: $m('#vf-che').value || null,
          modelo: $m('#vf-mod').value.trim() || null, matricula: up('#vf-mat') || null, viagem_id: $m('#vf-vg')?.value || null, notas: $m('#vf-notas').value.trim() || null, minutos };
        if (!linha.data || !/^[A-Z0-9]{3}$/.test(linha.origem) || !/^[A-Z0-9]{3}$/.test(linha.destino)) return toast('Preencha a data e os códigos de origem e destino (3 letras).');
        if (linha.origem === linha.destino) return toast('Origem e destino iguais.');
        // horário mudou à mão: o tempo de voo registrado deixa de valer (fica a estimativa)
        if (!novo && (linha.partida !== v.partida || linha.chegada !== v.chegada) && minutos === v.minutos) linha.minutos = null;
        let erro;
        if (novo) { linha.id = novoId(); ({ error: erro } = await grava({ tipo: 'inserir', tabela: 'viagem_voos', linha })); if (!erro) S.voos = [...(S.voos || []), { ...linha }]; }
        else { ({ error: erro } = await grava({ tipo: 'atualizar', tabela: 'viagem_voos', valores: linha, filtro: { id: v.id } })); if (!erro) Object.assign(S.voos.find(x => x.id === v.id), linha); }
        if (erro) return toast('Erro ao salvar: ' + erro.message);
        fechar(); atualizaTudo(); aoSalvar?.(); toast(novo ? 'Voo salvo' : 'Voo atualizado');
        perguntaAeroportos(S.voos.find(x => x.id === (novo ? linha.id : v.id)));
      };
    });
  });
}
// depois de salvar: aeroportos do voo que ainda não estão marcados. Chegou e saiu de novo em até 1 dia = escala.
function ehConexao(iata, voo) {
  const dia = d => Date.parse(d + 'T12:00') / 864e5;
  return (S.voos || []).some(w => w.id !== voo.id && ((w.origem === iata && voo.destino === iata && dia(w.data) - dia(voo.data) >= 0 && dia(w.data) - dia(voo.data) <= 1)
    || (w.destino === iata && voo.origem === iata && dia(voo.data) - dia(w.data) >= 0 && dia(voo.data) - dia(w.data) <= 1)));
}
function perguntaAeroportos(voo) {
  if (!voo) return;
  const estive = rotuloVisitaPadrao(), escala = estive && S.rotulos.find(r => r.id !== estive.id && rotuloServe(r, 'aeroporto') && (r.so_lugar || r.tipos?.includes('aeroporto'))); // rótulo próprio de aeroporto (ex.: Escala)
  const faltam = [voo.origem, voo.destino].filter(i => { const l = lugarDaRef('iata:' + i); return aeroPorIata(i) && (!l || !rotulosDe(l.id).size); });
  if (!faltam.length || !estive) return;
  abreModal(`<h3>Marcar aeroportos?</h3><p class="meta">Estes aeroportos do voo ainda não estão no seu mapa.</p>
    ${faltam.map(i => `<div class="campo"><label for="va-${i}">${esc(i)} · ${esc(aeroPorIata(i).nome)}</label><select id="va-${i}" data-iata="${i}">
      <option value="${estive.id}" ${escala && ehConexao(i, voo) ? '' : 'selected'}>${esc(estive.nome)}</option>
      ${escala ? `<option value="${escala.id}" ${ehConexao(i, voo) ? 'selected' : ''}>${esc(escala.nome)} (só conexão)</option>` : ''}
      <option value="">Não marcar</option></select></div>`).join('')}
    <div class="acoes"><button class="btn" id="va-nao">Agora não</button><button class="btn principal" id="va-ok">Marcar</button></div>`, (m, fechar) => {
    m.querySelector('#va-nao').onclick = fechar;
    m.querySelector('#va-ok').onclick = async () => {
      for (const s of m.querySelectorAll('select[data-iata]')) if (s.value) {
        const ja = lugarDaRef('iata:' + s.dataset.iata);
        if (ja) await alternaRotulo(ja.id, s.value); else await marcaBase('iata:' + s.dataset.iata, s.value);
      }
      fechar();
    };
  });
}
// rotas no mapa: arco de círculo máximo entre os aeroportos, na aba Aeroportos
let camadaRotas = null;
function arco(a, b, n = 48) {
  const r = Math.PI / 180, [la1, lo1, la2, lo2] = [a.lat * r, a.lon * r, b.lat * r, b.lon * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  if (!d) return [[a.lat, a.lon]];
  const pts = []; let antes = null;
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2), y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2), z = A * Math.sin(la1) + B * Math.sin(la2);
    let lon = Math.atan2(y, x) / r; const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / r;
    if (antes !== null) while (lon - antes > 180) lon -= 360; while (antes !== null && lon - antes < -180) lon += 360; // sem pular o antimeridiano
    pts.push([lat, lon]); antes = lon;
  }
  return pts;
}
function desenhaRotas() {
  if (!mapa) return;
  if (!camadaRotas) camadaRotas = L.layerGroup();
  if (S.aba !== 'transporte' || !(S.voos || []).length) { camadaRotas.remove(); return; }
  if (!S.baseAero) { carregaBase('aeroporto').then(desenhaRotas).catch(() => {}); return; }
  const rotas = new Map();
  S.voos.forEach(v => { const k = [v.origem, v.destino].sort().join('-'); rotas.set(k, (rotas.get(k) || 0) + 1); });
  camadaRotas.clearLayers();
  const cor = corToken('--visit');
  rotas.forEach((n, k) => { const [x, y] = k.split('-').map(aeroPorIata); if (x && y) L.polyline(arco(x, y), { color: cor, weight: Math.min(1.5 + n * 0.8, 5), opacity: 0.75, interactive: false }).addTo(camadaRotas); });
  if (!mapa.hasLayer(camadaRotas)) camadaRotas.addTo(mapa);
}
// ---- Passaporte de voos: capa, rotas, carimbos, recordes, companhias, aviões, viagens e anos
// cores que lembram cada companhia (o logo vem de um banco público; sem ele, fica a faixa colorida)
const COR_CIA = { G3: '#ff6a13', AD: '#0b3d91', JJ: '#1b0088', LA: '#1b0088', '4M': '#1b0088', AR: '#0f6db3', TP: '#d71920', CM: '#003a70', AV: '#da291c', H2: '#ff4f00', JA: '#1e2a78', FO: '#ffc600', AA: '#0078d2', UA: '#005daa', DL: '#c8102e', AF: '#002157', KL: '#00a1de', IB: '#d7192d', UX: '#00539f', LH: '#05164d', BA: '#075aaa', EK: '#d71921', QR: '#5c0632', TK: '#c70a0c', '2Z': '#0f4c81' };
// cor da época quando a marca era outra (TAM era vermelha; o JJ hoje é LATAM)
const COR_ERA = { tam: '#c8102e', varig: '#1e4d9c', vasp: '#0a3d8f', webjet: '#d71920', avianca: '#d71920', oceanair: '#d71920', transbrasil: '#0072bc' };
const corCia = v => COR_ERA[primeiraPalavra(v.cia_nome)] || COR_CIA[v.cia] || '#5b6f71';
const seloCia = (nome, cor, peq) => `<span class="logo selo-cia${peq ? ' peq' : ''}" style="--c:${cor}">${esc(nome.length > 12 ? nome.split(' ')[0] : nome)}</span>`;
// logo atual pelo código (TAM aparece com o logo de hoje, LATAM, mas com o nome da época)
const logoCia = v => v.cia ? `https://pics.avs.io/200/80/${encodeURIComponent(v.cia)}.png` : null;
const CORES_PAIS = ['#1f7a4d', '#2b7bb9', '#8e44ad', '#c0392b', '#d35400', '#16a085', '#7d5a2b', '#2c3e50', '#b8860b', '#6d4c9f'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataCurta = d => `${+d.slice(8)} ${MESES_CURTOS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const pl = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
// fotos: Planespotters pela matrícula (foto do avião exato); sem ela, a foto do modelo na Wikipédia
const fotosAviao = new Map();
function fotoMatricula(reg) {
  if (fotosAviao.has(reg)) return fotosAviao.get(reg);
  const chave = 'poa-foto-' + reg;
  try { const c = JSON.parse(localStorage.getItem(chave) || 'null'); if (c && Date.now() - c.em < 864e5) { const p = Promise.resolve(c.f); fotosAviao.set(reg, p); return p; } } catch {}
  const p = fetch('https://api.planespotters.net/pub/photos/reg/' + encodeURIComponent(reg)).then(r => r.ok ? r.json() : null)
    .then(j => { const f = j?.photos?.[0]; const out = f ? { src: f.thumbnail_large?.src || f.thumbnail?.src, link: f.link, autor: f.photographer } : null;
      try { localStorage.setItem(chave, JSON.stringify({ em: Date.now(), f: out })); } catch {} return out; }).catch(() => null);
  fotosAviao.set(reg, p); return p;
}
function fotoModelo(modelo) {
  const k = 'm:' + modelo; if (fotosAviao.has(k)) return fotosAviao.get(k);
  const titulo = modelo.replace(/\s+/g, '_').replace(/^Embraer_(\d)/, 'Embraer_E$1');
  const p = fetch('https://pt.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titulo)).then(r => r.ok ? r.json() : null)
    .then(j => j?.thumbnail?.source ? { src: j.thumbnail.source, link: j.content_urls?.desktop?.page, autor: 'Wikipédia' } : null).catch(() => null);
  fotosAviao.set(k, p); return p;
}
function mapaRotasSvg(vs) {
  const aps = [...new Set(vs.flatMap(v => [v.origem, v.destino]))].map(aeroPorIata).filter(Boolean);
  if (!aps.length) return '';
  let x0 = Math.min(...aps.map(a => a.lon)), x1 = Math.max(...aps.map(a => a.lon)), y0 = Math.min(...aps.map(a => a.lat)), y1 = Math.max(...aps.map(a => a.lat));
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180); // largura real do grau de longitude
  let w = (x1 - x0) * k, h = y1 - y0; const m = Math.max(w, h) * 0.18 + 2; x0 -= m / k; x1 += m / k; y0 -= m; y1 += m;
  w = (x1 - x0) * k; h = y1 - y0; if (w < h) { const d = (h - w) / 2 / k; x0 -= d; x1 += d; w = h; } else { const d = (w - h) / 2; y0 -= d; y1 += d; h = w; }
  const W = 380, H = Math.round(W * Math.min(h / w, 1.1)), px = lon => ((lon - x0) * k / w * W), py = lat => ((y1 - lat) / h * H);
  const visto = new Set(aps.map(a => a.pais));
  const paises = S.paises.filter(p => p.bbox[2] > x0 && p.bbox[0] < x1 && p.bbox[3] > y0 && p.bbox[1] < y1).map(p => `<path class="pp-pais${visto.has(p.id) ? ' vis' : ''}" d="${p.polys.map(poly => poly.map(anel => 'M' + anel.filter((_, i) => i % 2 === 0 || anel.length < 40).map(([x, y]) => px(x).toFixed(1) + ',' + py(y).toFixed(1)).join('L') + 'Z').join('')).join('')}"/>`).join('');
  const rotas = new Map(); vs.forEach(v => { const r = [v.origem, v.destino].sort().join('-'); rotas.set(r, (rotas.get(r) || 0) + 1); });
  const arcos = [...rotas].map(([r, n]) => { const [a, b] = r.split('-').map(aeroPorIata); if (!a || !b) return '';
    const xa = px(a.lon), ya = py(a.lat), xb = px(b.lon), yb = py(b.lat), cx = (xa + xb) / 2 - (yb - ya) * 0.18, cy = (ya + yb) / 2 + (xb - xa) * 0.18;
    return `<path class="pp-rota" style="stroke-width:${Math.min(1.6 + n * 0.9, 6)}" d="M${xa.toFixed(1)},${ya.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}"/>`; }).join('');
  const pontos = aps.map(a => { const x = px(a.lon), y = py(a.lat), esq = x > W * 0.75; return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle r="4.5" class="pp-ap"/><text x="${esq ? -8 : 8}" y="4" text-anchor="${esq ? 'end' : 'start'}">${esc(a.iata)}</text></g>`; }).join('');
  return `<div class="pp-mapa"><svg viewBox="0 0 ${W} ${H}">${paises}${arcos}${pontos}</svg></div>`;
}
async function htmlPassaporte() {
  await carregaBase('aeroporto').catch(() => {});
  const cias = await carregaCias().catch(() => ({}));
  const vs = [...(S.voos || [])].sort((a, b) => a.data.localeCompare(b.data) || (a.partida || '').localeCompare(b.partida || ''));
  if (!vs.length) return '<p class="meta">Nenhum voo ainda. Cadastre na aba Lista: com o número e a data, o app busca o resto.</p>';
  const km = vs.reduce((t, v) => t + kmVoo(v), 0), min = vs.reduce((t, v) => t + minVoo(v), 0), estimado = vs.some(v => !v.minutos);
  // aeroportos na ordem em que apareceram
  const primeira = new Map(), uso = new Map();
  vs.forEach(v => [v.origem, v.destino].forEach(i => { if (!primeira.has(i)) primeira.set(i, v.data); uso.set(i, (uso.get(i) || 0) + 1); }));
  const paisCasa = casa()?.pais || 'BR', paisesOrd = [...new Set([paisCasa, ...[...primeira.keys()].map(i => aeroPorIata(i)?.pais).filter(Boolean)])];
  const corPais = cc => CORES_PAIS[paisesOrd.indexOf(cc) % CORES_PAIS.length];
  const paises = new Set([...primeira.keys()].map(i => aeroPorIata(i)?.pais).filter(Boolean));
  const ciasDist = new Set(vs.map(chaveCia).filter(Boolean)), avioes = new Set(vs.map(v => v.matricula).filter(Boolean));
  const capa = `<div class="pp-capa"><div class="pp-selo">${ICONES.aeroporto}<div><small>PASSAPORTE DE VOOS</small><b>POR ONDE ANDEI</b></div></div>
    <div class="pp-nums"><div><b>${vs.length}</b><span>${vs.length === 1 ? 'voo' : 'voos'}</span></div><div><b>${km.toLocaleString('pt-BR')}</b><span>km voados</span></div><div><b>${fmtHoras(min)}</b><span>no ar${estimado ? ' (aprox.)' : ''}</span></div>
    <div><b>${primeira.size}</b><span>aeroportos</span></div><div><b>${paises.size}</b><span>${paises.size === 1 ? 'país' : 'países'}</span></div><div><b>${(km / 40075).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b><span>voltas na Terra</span></div></div>
    <div class="pp-mrz">P&lt;${esc(paisCasa === 'BR' ? 'BRA' : paisCasa)}&lt;&lt;VOOS&lt;&lt;${esc([...primeira.keys()].slice(0, 8).join('<'))}${'&lt;'.repeat(4)}<br>${vs.length}&lt;&lt;${ciasDist.size}CIAS&lt;&lt;${avioes.size}AVIOES&lt;&lt;${vs[0].data.slice(0, 4)}&lt;${vs.at(-1).data.slice(0, 4)}${'&lt;'.repeat(6)}</div></div>`;
  const giros = [-6, 4, -3, 7, -8, 3, 5, -4];
  const carimbos = [...primeira.keys()].map((i, n) => { const a = aeroPorIata(i), cid = (a ? cidadeAero(i) : '') || i, pais = a ? (nomePais(a.pais) || a.pais) : '';
    return `<div class="pp-carimbo" style="--c:${corPais(a?.pais)};transform:rotate(${giros[n % giros.length]}deg)" title="${esc(a?.nome || i)}"><svg viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="56" class="c1"/><circle cx="60" cy="60" r="49" class="c2"/>
      <path id="pc-t${n}" d="M60,60 m-41,0 a41,41 0 1,1 82,0" fill="none"/><path id="pc-b${n}" d="M60,60 m-44,0 a44,44 0 1,0 88,0" fill="none"/>
      <text class="arco" style="letter-spacing:${cid.length > 12 ? '.02em' : cid.length > 9 ? '.06em' : '.14em'}"><textPath href="#pc-t${n}" startOffset="50%" text-anchor="middle">${esc(cid.toUpperCase().slice(0, 18))}</textPath></text>
      <text class="arco"><textPath href="#pc-b${n}" startOffset="50%" text-anchor="middle">${esc(pais.toUpperCase().slice(0, 18))}</textPath></text>
      <text x="60" y="58" text-anchor="middle" class="iata">${esc(i)}</text><text x="60" y="71" text-anchor="middle" class="data">${esc(dataCurta(primeira.get(i)).toUpperCase())}</text>
      <text x="60" y="84" text-anchor="middle" class="vezes">${uso.get(i)}× ✈</text></svg></div>`; }).join('');
  const comKm = vs.filter(kmVoo), longo = [...comKm].sort((a, b) => kmVoo(b) - kmVoo(a))[0], curto = [...comKm].sort((a, b) => kmVoo(a) - kmVoo(b))[0];
  const cedo = vs.filter(v => v.partida).sort((a, b) => a.partida.localeCompare(b.partida))[0];
  const rotas = new Map(); vs.forEach(v => { const r = [v.origem, v.destino].sort().join(' ⇄ '); rotas.set(r, (rotas.get(r) || 0) + 1); });
  const fav = [...rotas].sort((a, b) => b[1] - a[1])[0];
  const rec = (t, b, s) => `<div class="pp-rec"><span>${t}</span><b>${b}</b><small>${s}</small></div>`;
  const recordes = `<div class="pp-recs">${longo ? rec('Mais longo', `${esc(longo.origem)} → ${esc(longo.destino)}`, `${fmtKm(kmVoo(longo))} · ${fmtHoras(minVoo(longo))}${longo.numero ? ' · ' + esc(longo.numero) : ''}`) : ''}
    ${curto && curto !== longo ? rec('Mais curto', `${esc(curto.origem)} → ${esc(curto.destino)}`, `${fmtKm(kmVoo(curto))} · ${fmtHoras(minVoo(curto))}${curto.numero ? ' · ' + esc(curto.numero) : ''}`) : ''}
    ${cedo ? rec('Mais cedo', esc(cedo.partida), `${esc([cedo.numero, `${cedo.origem} → ${cedo.destino}`, dataCurta(cedo.data)].filter(Boolean).join(' · '))}`) : ''}
    ${fav && fav[1] > 1 ? rec('Rota favorita', esc(fav[0]), `${fav[1]} voos`) : ''}</div>`;
  await carregaHistCias();
  const porCia = new Map(); vs.forEach(v => { const k = chaveCia(v); if (!porCia.has(k)) porCia.set(k, []); porCia.get(k).push(v); });
  const companhias = [...porCia].sort((a, b) => b[1].length - a[1].length).map(([, l]) => {
    const ord = [...l].sort((a, b) => b.data.localeCompare(a.data)), v = ord[0], nome = nomeCia(v, cias), cor = corCia(v), e = empresaDoVoo(v);
    // título = nome do voo mais recente; os nomes antigos e o nome de hoje ficam na linha de baixo
    const antes = [...new Set(ord.map(x => nomeCia(x, cias)))].filter(n => primeiraPalavra(n) !== primeiraPalavra(nome));
    const atual = cias?.[v.cia];
    const nota = e?.f ? `encerrou em ${e.f.slice(0, 4)}` : atual && v.cia_nome && primeiraPalavra(atual) !== primeiraPalavra(nome) ? `hoje ${atual}` : '';
    const logo = logoVoo(v, cias);
    // épocas com logo ou nome diferentes (Gol 2012 × Gol 2026, TAM × LATAM): uma linha para cada
    const eras = new Map(); ord.forEach(x => { const lg = logoVoo(x, cias), nm = nomeCia(x, cias), k = lg || 'selo:' + nm;
      if (!eras.has(k)) eras.set(k, { lg, nm, cor: corCia(x), anos: new Set(), n: 0 }); const r = eras.get(k); r.anos.add(x.data.slice(0, 4)); r.n++; });
    const faixaAnos = s => { const a = [...s].sort(); return a.length > 1 ? `${a[0]}–${a.at(-1)}` : a[0]; };
    const erasHtml = eras.size > 1 ? `<div class="pp-eras">${[...eras.values()].map(r => `<span>${r.lg ? `<img src="${r.lg}" alt="" loading="lazy">` : seloCia(r.nm, r.cor, true)}${faixaAnos(r.anos)} · ${pl(r.n, 'voo', 'voos')}</span>`).join('')}</div>` : '';
    const linha2 = [[antes.length ? 'antes ' + antes.join(', ') : '', nota].filter(Boolean).join(' · '), [v.cia, pl(l.length, 'voo', 'voos'), fmtKm(l.reduce((t, x) => t + kmVoo(x), 0))].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
    return `<div class="pp-cia" style="--c:${cor}"><span class="faixa"></span>${logo ? `<span class="logo" data-selo="${esc(seloCia(nome, cor))}"><img src="${logo}" alt="" loading="lazy" onerror="this.parentElement.outerHTML=this.parentElement.dataset.selo"></span>` : seloCia(nome, cor)}<div><b>${esc(nome)}</b><small>${esc(linha2)}</small>${erasHtml}</div><span class="n">${l.length}</span></div>`;
  }).join('');
  const porModelo = new Map(); vs.forEach(v => { const k = v.modelo || 'Avião não informado'; if (!porModelo.has(k)) porModelo.set(k, []); porModelo.get(k).push(v); });
  let nFoto = 0;
  const aviaoHtml = [...porModelo].sort((a, b) => (a[0] === 'Avião não informado') - (b[0] === 'Avião não informado') || b[1].length - a[1].length).map(([mod, l]) => {
    const fab = mod === 'Avião não informado' ? '' : fabricante(mod), curtoMod = fab && mod.startsWith(fab + ' ') ? mod.slice(fab.length + 1) : mod;
    const regs = []; l.forEach(v => { if (v.matricula && !regs.some(r => r.reg === v.matricula)) regs.push({ reg: v.matricula, v }); });
    const semReg = l.filter(v => !v.matricula).length;
    return `<details class="pp-aviao" data-mod="${esc(mod)}"><summary class="pp-topo">${fab ? `<span class="pp-fab">${esc(fab.toUpperCase())}</span>` : ''}<b>${esc(curtoMod)}</b><span class="n">${l.length}×</span><span class="seta" aria-hidden="true"></span></summary>
      ${regs.length ? `<div class="pp-fotos">${regs.map(r => `<figure data-reg="${esc(r.reg)}" data-modelo="${esc(mod)}" id="pp-f${nFoto++}"><div class="img" style="--c:${corCia(r.v)}"></div><figcaption><span class="reg" style="--c:${corCia(r.v)}">${esc(r.reg)}</span><small class="autor"></small></figcaption></figure>`).join('')}</div>` : mod !== 'Avião não informado' ? `<div class="pp-fotos"><figure data-modelo="${esc(mod)}" id="pp-f${nFoto++}"><div class="img"></div><figcaption><small class="autor"></small></figcaption></figure></div>` : ''}
      ${semReg && regs.length ? `<small class="pp-sem">${pl(semReg, 'voo sem matrícula', 'voos sem matrícula')}</small>` : ''}</details>`; }).join('');
  const porViagem = new Map(); vs.forEach(v => { const vg = v.viagem_id && (S.viagens || []).find(x => x.id === v.viagem_id); const k = vg ? vg.id : ''; if (!porViagem.has(k)) porViagem.set(k, { vg, l: [] }); porViagem.get(k).l.push(v); });
  const viagens = [...porViagem.values()].sort((a, b) => !a.vg - !b.vg || b.l[0].data.localeCompare(a.l[0].data)).map(({ vg, l }) => {
    const cadeia = [l[0].origem]; l.forEach(v => { if (cadeia.at(-1) !== v.origem) cadeia.push('·', v.origem); cadeia.push(v.destino); });
    return `<div class="pp-viag"><b>${esc(vg ? vg.nome : 'Sem viagem ligada')}</b><small>${pl(l.length, 'voo', 'voos')} · ${fmtKm(l.reduce((t, v) => t + kmVoo(v), 0))} · ${fmtHoras(l.reduce((t, v) => t + minVoo(v), 0))} no ar</small>
      <div class="trechos">${cadeia.map((c, i) => c === '·' ? '<i>·</i>' : `${i && cadeia[i - 1] !== '·' ? '<i>→</i>' : ''}<span>${esc(c)}</span>`).join('')}</div></div>`; }).join('');
  const anos = new Map(); vs.forEach(v => { const a = v.data.slice(0, 4); anos.set(a, [...(anos.get(a) || []), v]); });
  const maxAno = Math.max(...[...anos.values()].map(l => l.length));
  const linha = [...anos].sort((a, b) => b[0].localeCompare(a[0])).map(([a, l]) => `<div class="pp-ano"><span>${a}</span><div class="barra"><i style="width:${l.length / maxAno * 100}%"></i></div><b>${pl(l.length, 'voo', 'voos')} · ${fmtKm(l.reduce((t, v) => t + kmVoo(v), 0))}</b></div>`).join('');
  return `${capa}
    ${S.publico ? '' : `<button class="pp-carteira" id="pp-carteira"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/></svg>Adicionar à Carteira do Google</button>`}
    <h4 class="pp-h">Rotas <small>mais grossa = mais vezes</small></h4>${mapaRotasSvg(vs)}
    <h4 class="pp-h">Carimbos <small>um por aeroporto · 1ª vez</small></h4><div class="pp-pagina"><div class="pp-carimbos">${carimbos}</div><p>Cor do carimbo = país · ✈ = voos por ali</p></div>
    <h4 class="pp-h">Recordes</h4>${recordes}
    <h4 class="pp-h">Por ano</h4>${linha}
    <h4 class="pp-h">Companhias</h4>${companhias}
    <h4 class="pp-h">Aviões <small>toque para ver as fotos</small></h4>${aviaoHtml}
    <h4 class="pp-h">Por viagem</h4>${viagens}
    <p class="meta pp-nota">Para editar ou excluir um voo, abra a aba Lista e toque nele. Distâncias em linha reta pela curva da Terra.${estimado ? ' Sem horário registrado, o tempo é estimado pela distância.' : ''} Fotos: <a href="https://www.planespotters.net" target="_blank" rel="noopener">Planespotters.net</a> (pela matrícula) ou Wikipédia (pelo modelo), com o crédito de cada foto. Logos das companhias: Travelpayouts e Wikimedia Commons (logos de época, via Wikidata). Busca de voos: AeroDataBox e ANAC (VRA).</p>`;
}
// ---- Carteira do Google: cartão "Passaporte de voos" (função carteira no servidor)
function resumoCarteira() {
  const vs = [...(S.voos || [])].sort((a, b) => a.data.localeCompare(b.data) || (a.partida || '').localeCompare(b.partida || ''));
  if (!vs.length || !S.baseAero) return null;
  const km = vs.reduce((t, v) => t + kmVoo(v), 0), min = vs.reduce((t, v) => t + minVoo(v), 0);
  const aps = new Set(vs.flatMap(v => [v.origem, v.destino])), paises = new Set([...aps].map(i => aeroPorIata(i)?.pais).filter(Boolean));
  const cias = new Set(vs.map(chaveCia).filter(Boolean));
  const u = vs.at(-1), longo = [...vs].sort((a, b) => kmVoo(b) - kmVoo(a))[0];
  const mods = new Map(); vs.forEach(v => v.modelo && mods.set(v.modelo, (mods.get(v.modelo) || 0) + 1));
  const a0 = vs[0].data.slice(0, 4), a1 = u.data.slice(0, 4);
  return { voos: String(vs.length), km: km.toLocaleString('pt-BR'), horas: fmtHoras(min), paises: String(paises.size), aeroportos: String(aps.size), cias: String(cias.size),
    periodo: a0 === a1 ? a0 : `${a0}–${a1}`, desde: a0,
    bandeiras: [...paises].map(cc => `${bandeira(cc)} ${nomePais(cc)}`).join(' · '),
    ultimo: [u.numero, `${u.origem} → ${u.destino}`, dataCurta(u.data)].filter(Boolean).join(' · '),
    longo: longo && kmVoo(longo) ? `${longo.origem} → ${longo.destino} · ${fmtKm(kmVoo(longo))}` : '',
    avioes: [...mods].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(' · ') };
}
// capa do cartão (1032×336): texto à esquerda e o mapa das rotas à direita, enquadrado só onde você voou
async function capaCarteira(vs) {
  const W = 1032, H = 336, MW = 620, MH = H; // área do mapa
  const aps = [...new Set(vs.flatMap(v => [v.origem, v.destino]))].map(aeroPorIata).filter(Boolean);
  if (!aps.length) return null;
  let x0 = Math.min(...aps.map(a => a.lon)), x1 = Math.max(...aps.map(a => a.lon)), y0 = Math.min(...aps.map(a => a.lat)), y1 = Math.max(...aps.map(a => a.lat));
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
  const m = Math.max((x1 - x0) * k, y1 - y0) * 0.16 + 1.5; x0 -= m / k; x1 += m / k; y0 -= m; y1 += m;
  // ajusta à proporção da área do mapa
  let w = (x1 - x0) * k, h = y1 - y0; const alvo = MW / MH;
  if (w / h < alvo) { const d = (h * alvo - w) / 2 / k; x0 -= d; x1 += d; w = h * alvo; } else { const d = (w / alvo - h) / 2; y0 -= d; y1 += d; h = w / alvo; }
  const px = lon => W - MW + (lon - x0) * k / w * MW, py = lat => (y1 - lat) / h * MH;
  const visto = new Set(aps.map(a => a.pais));
  const paises = S.paises.filter(p => p.bbox[2] > x0 && p.bbox[0] < x1 && p.bbox[3] > y0 && p.bbox[1] < y1).map(p => `<path fill="${visto.has(p.id) ? '#245f62' : '#174448'}" stroke="#2c6a6d" stroke-width="1" d="${p.polys.map(poly => poly.map(anel => 'M' + anel.map(([x, y]) => px(x).toFixed(1) + ',' + py(y).toFixed(1)).join('L') + 'Z').join('')).join('')}"/>`).join('');
  const rotas = new Map(); vs.forEach(v => { const c = [v.origem, v.destino].sort().join('-'); rotas.set(c, (rotas.get(c) || 0) + 1); });
  const arcos = [...rotas].map(([c, n]) => { const [a, b] = c.split('-').map(aeroPorIata); if (!a || !b) return '';
    const xa = px(a.lon), ya = py(a.lat), xb = px(b.lon), yb = py(b.lat), cx = (xa + xb) / 2 - (yb - ya) * 0.18, cy = (ya + yb) / 2 + (xb - xa) * 0.18;
    return `<path fill="none" stroke="#e4572e" stroke-linecap="round" stroke-width="${Math.min(3 + n * 1.6, 11)}" opacity=".9" d="M${xa.toFixed(1)},${ya.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}"/>`; }).join('');
  const pontos = aps.map(a => `<circle cx="${px(a.lon).toFixed(1)}" cy="${py(a.lat).toFixed(1)}" r="8" fill="#f2e8d5" stroke="#0c2a2e" stroke-width="3"/><text x="${(px(a.lon) + 13).toFixed(1)}" y="${(py(a.lat) + 7).toFixed(1)}" font-family="system-ui,sans-serif" font-weight="800" font-size="20" fill="#f2e8d5" stroke="#0c2a2e" stroke-width="5" paint-order="stroke">${esc(a.iata)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><radialGradient id="g" cx="85%" cy="0%" r="120%"><stop offset="0" stop-color="#1d5b62"/><stop offset=".55" stop-color="#123a3f"/><stop offset="1" stop-color="#0c2a2e"/></radialGradient>
    <linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="#123a3f"/><stop offset="1" stop-color="#123a3f" stop-opacity="0"/></linearGradient>
    <clipPath id="c"><rect x="${W - MW}" y="0" width="${MW}" height="${H}"/></clipPath></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <g clip-path="url(#c)">${paises}${arcos}${pontos}</g>
    <rect x="${W - MW}" y="0" width="180" height="${H}" fill="url(#f)"/>
    <text x="56" y="128" font-family="system-ui,sans-serif" font-weight="700" font-size="22" letter-spacing="6" fill="#d9b45a">PASSAPORTE DE VOOS</text>
    <text x="56" y="182" font-family="system-ui,sans-serif" font-weight="800" font-size="44" fill="#f2e8d5">POR ONDE ANDEI</text>
    <text x="56" y="232" font-family="system-ui,sans-serif" font-weight="600" font-size="22" fill="#b9d3d0">${vs.length} ${vs.length === 1 ? 'voo' : 'voos'} · ${aps.length} aeroportos</text></svg>`;
  const img = new Image();
  await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(img, 0, 0);
  return await new Promise(ok => cv.toBlob(ok, 'image/png'));
}
async function enviaCapa(resumo) { // grava a capa no servidor só quando muda (rotas ou aeroportos)
  try {
    const vs = S.voos || [], chave = [...new Set(vs.map(v => [v.origem, v.destino].sort().join('-')))].sort().join(',') + '|' + vs.length;
    let ant = null; try { ant = JSON.parse(localStorage.getItem('poa-capa') || 'null'); } catch {}
    if (ant && ant.chave === chave) return ant.url;
    const blob = await capaCarteira(vs); if (!blob) return null;
    const caminho = `${S.user.id}/capa.png`;
    const { error } = await supa.storage.from('carteira').upload(caminho, blob, { upsert: true, contentType: 'image/png', cacheControl: '60' });
    if (error) return null;
    const url = supa.storage.from('carteira').getPublicUrl(caminho).data.publicUrl + '?v=' + Date.now().toString(36);
    try { localStorage.setItem('poa-capa', JSON.stringify({ chave, url })); } catch {}
    return url;
  } catch { return null; }
}
async function adicionaCarteira(botao) {
  await carregaBase('aeroporto').catch(() => {});
  const resumo = resumoCarteira(); if (!resumo) return toast('Cadastre um voo primeiro.');
  botao.disabled = true; const txt = botao.innerHTML; botao.textContent = 'Preparando o cartão…';
  resumo.capa = await enviaCapa();
  const { data, error } = await supa.functions.invoke('carteira', { body: { acao: 'link', resumo } });
  botao.disabled = false; botao.innerHTML = txt;
  if (error || !data?.url) {
    let corpo = null; try { corpo = await error?.context?.json?.(); } catch {}
    return toast(corpo?.erro === 'sem_chave' ? 'A Carteira do Google ainda não foi configurada no servidor.' : 'Não deu para criar o cartão agora. Tente de novo mais tarde.', 4500);
  }
  try { localStorage.setItem('poa-carteira', JSON.stringify(resumo)); } catch {}
  window.open(data.url, '_blank', 'noopener');
}
// cartão já na carteira: quando os números mudam, atualiza sozinho (o Google leva alguns minutos para mostrar)
let tCarteira;
function agendaCarteira() {
  let antes; try { antes = localStorage.getItem('poa-carteira'); } catch {}
  if (!antes || S.publico || !S.user) return;
  clearTimeout(tCarteira); tCarteira = setTimeout(async () => {
    const resumo = resumoCarteira(); if (!resumo) return;
    resumo.capa = await enviaCapa();
    const novo = JSON.stringify(resumo); if (novo === antes) return;
    const { error } = await supa.functions.invoke('carteira', { body: { acao: 'atualizar', resumo } });
    if (!error) try { localStorage.setItem('poa-carteira', novo); } catch {}
  }, 4000);
}
// depois de desenhar: carrega as fotos (uma por matrícula)
function carregaFotos(caixa) {
  let abertos = []; try { abertos = JSON.parse(localStorage.getItem('poa-pp-abertos') || '[]'); } catch {}
  caixa.querySelectorAll('details.pp-aviao').forEach(d => {
    const carrega = () => { if (d.open && !d.dataset.ok) { d.dataset.ok = 1; carregaFotosDe(d); } };
    if (abertos.includes(d.dataset.mod)) d.open = true;
    d.addEventListener('toggle', () => {
      carrega();
      const ab = [...caixa.querySelectorAll('details.pp-aviao[open]')].map(x => x.dataset.mod);
      try { localStorage.setItem('poa-pp-abertos', JSON.stringify(ab)); } catch {}
    });
    carrega();
  });
}
function carregaFotosDe(caixa) {
  caixa.querySelectorAll('figure[data-modelo]').forEach(async fig => {
    const f = (fig.dataset.reg && await fotoMatricula(fig.dataset.reg)) || await fotoModelo(fig.dataset.modelo);
    if (!fig.isConnected) return;
    const img = fig.querySelector('.img');
    if (!f?.src) { img.classList.add('vazia'); img.innerHTML = ICONES.aeroporto; return; }
    img.innerHTML = `<a href="${esc(f.link || '#')}" target="_blank" rel="noopener"><img src="${esc(f.src)}" alt="${esc(fig.dataset.reg || fig.dataset.modelo)}" loading="lazy"></a>`;
    fig.querySelector('.autor').textContent = f.autor ? '© ' + f.autor : '';
  });
}

