'use strict';
/* ================= Menu ================= */
/* ================= Primeiro acesso ================= */
// Conta nova (sem nenhum lugar): boas-vindas → onde você mora → marcação rápida. Aparece uma vez por conta.
const chaveBV = () => 'poa-bv-' + (S.user?.id || '');
function precisaBoasVindas() {
  if (S.publico || !S.user || S.lugares.length) return false;
  try { return !localStorage.getItem(chaveBV()); } catch { return true; }
}
function fimBoasVindas() { try { localStorage.setItem(chaveBV(), '1'); } catch {} }
function telaCheia(html) { const el = document.createElement('div'); el.className = 'onb'; el.setAttribute('role', 'dialog'); el.innerHTML = html; document.body.appendChild(el); return el; }
const passosOnb = n => `<div class="onb-passos">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
function abreBoasVindas() {
  const el = telaCheia(`<button class="onb-pular">Pular</button>${passosOnb(1)}
    <div class="onb-corpo">
      <div class="onb-hero"><svg viewBox="0 0 360 200" preserveAspectRatio="xMidYMid slice"><text x="24" y="40" fill="#d9b45a" font-size="12" font-weight="700" letter-spacing="3">POR ONDE ANDEI</text>
        <path d="M50 150 Q110 50 190 100 T320 55" stroke="#e4572e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 175 Q170 130 290 168" stroke="#e4572e" stroke-width="3" fill="none" opacity=".7"/>
        <g fill="#f2e8d5"><circle cx="50" cy="150" r="7"/><circle cx="190" cy="100" r="7"/><circle cx="320" cy="55" r="7"/><circle cx="70" cy="175" r="6"/><circle cx="290" cy="168" r="6"/></g></svg></div>
      <h2>Seu mapa de tudo por onde você já andou</h2>
      <div class="onb-lista">
        <div><span>🗺️</span><div><b>Marque onde esteve</b><small>Países, estados, cidades e aeroportos pintam o seu mapa.</small></div></div>
        <div><span>🏅</span><div><b>Veja o mapa crescer</b><small>Estatísticas, bandeiras e selos a cada viagem.</small></div></div>
        <div><span>✈️</span><div><b>Passaporte de voos</b><small>Com o número do voo, o app completa o resto.</small></div></div>
      </div>
      <button class="btn principal onb-btn" id="onb-ir">Começar</button>
    </div>`);
  el.querySelector('.onb-pular').onclick = () => { fimBoasVindas(); el.remove(); };
  el.querySelector('#onb-ir').onclick = () => { el.remove(); passoCasa(); };
}
function passoCasa() {
  const el = telaCheia(`<button class="onb-pular">Pular</button>${passosOnb(2)}
    <div class="onb-corpo">
      <h2>Onde você mora?</h2>
      <p class="onb-sub">Sua cidade vira o ponto de partida: distâncias, “mais longe de casa” e os selos do seu país.</p>
      <input id="onb-cid" type="search" placeholder="Digite sua cidade" autocomplete="off" aria-label="Sua cidade">
      <div id="onb-sug" class="onb-sug"></div>
      <p class="onb-sub" id="onb-nota" hidden>Ela já entra marcada como <b style="color:var(--visit)">${esc(rotuloVisitaPadrao()?.nome || 'Estive')}</b>.</p>
      <button class="btn principal onb-btn" id="onb-ok" disabled>Continuar</button>
    </div>`);
  const inp = el.querySelector('#onb-cid'), box = el.querySelector('#onb-sug'), ok = el.querySelector('#onb-ok'), nota = el.querySelector('#onb-nota');
  let escolhida = null, seq = 0, t;
  el.querySelector('.onb-pular').onclick = () => { el.remove(); abreMarcacaoRapida(true); };
  const mostra = lista => {
    box.innerHTML = lista.map((c, i) => `<button data-i="${i}" class="${escolhida === c ? 'on' : ''}"><b>${esc(c.nome)}</b> <small>· ${esc([nomeEstado(c.estado), nomePais(c.pais)].filter(Boolean).join(', '))}</small></button>`).join('');
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { escolhida = lista[+b.dataset.i]; inp.value = escolhida.nome; mostra([escolhida]); ok.disabled = false; nota.hidden = false; });
  };
  inp.oninput = () => {
    clearTimeout(t); escolhida = null; ok.disabled = true; nota.hidden = true;
    const q = inp.value.trim(); if (q.length < 2) { box.innerHTML = ''; return; }
    t = setTimeout(async () => {
      const s = ++seq;
      try { await carregaMunicipios(); } catch {}
      const br = S.mun ? buscaMunicipios(q, 4).map(m => ({ nome: m.nome, lat: m.lat, lon: m.lon, pais: 'BR', estado: 'BR-' + m.uf, ref: refIbge(m) })) : [];
      if (s !== seq) return;
      mostra(br);
      if (q.length < 3) return;
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=10&addressdetails=1&accept-language=pt-BR`).then(r => r.json()).catch(() => []);
      if (s !== seq || escolhida) return;
      const fora = r.filter(x => tipoDoResultado(x) === 'cidade' && (x.address?.country_code || '').toUpperCase() !== 'BR').slice(0, 4).map(x => {
        const lat = +x.lat, lon = +x.lon, cc = (x.address?.country_code || '').toUpperCase(), loc = localizar(lat, lon, cc);
        return { nome: x.name || x.display_name.split(',')[0], lat, lon, pais: loc.pais || cc, estado: loc.estado, ref: null };
      });
      mostra([...br, ...fora]);
    }, 250);
  };
  ok.onclick = async () => {
    if (!escolhida) return; ok.disabled = true;
    const rot = rotuloVisitaPadrao();
    const c = (rot && await marcaCandidato(escolhida, rot)) || cidadeExistente(escolhida);
    if (c) await salvaCasa(c.id);
    atualizaTudo(); el.remove(); abreMarcacaoRapida(true);
  };
  setTimeout(() => inp.focus(), 60);
}

/* ================= Marcação rápida ================= */
// País ou estado inteiro marcado de uma vez (lugar do tipo "pais"/"estado", como o "País inteiro" da busca).
// Se o país já está pintado por outros lugares, a caixinha vem marcada e travada.
async function marcaInteiro(tipo, id, ligar, rot) {
  const ref = tipo + ':' + id; let lp = S.lugares.find(l => l.ref_externa === ref);
  const falha = e => { toast('Não deu pra salvar: ' + e.message); return false; };
  if (ligar) {
    if (!lp) {
      const f = tipo === 'pais' ? S.paisPorId.get(id) : S.estadoPorId.get(id); if (!f) return false;
      const c = centroBox(tipo === 'pais' ? f.maior : f.bbox);
      lp = { id: novoId(), tipo, nome: f.nome, lat: c.lat, lon: c.lon, pais: tipo === 'pais' ? id : f.pais, estado: tipo === 'estado' ? id : null, ref_externa: ref, notas: null };
      const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugares', linha: lp }); if (error) return falha(error);
      S.lugares.push(lp);
    }
    if (!rotulosDe(lp.id).has(rot.id)) {
      const { error } = await grava({ tipo: 'inserir', tabela: 'viagem_lugar_rotulos', linha: { lugar_id: lp.id, rotulo_id: rot.id } }); if (error) return falha(error);
      const m = rotulosDe(lp.id); m.set(rot.id, null); S.lr.set(lp.id, m);
    }
  } else if (lp) {
    const m = rotulosDe(lp.id);
    // criado só para isto (só tem este rótulo e nenhuma data): sai inteiro; senão, sai só o rótulo
    if ([...m.keys()].every(r => r === rot.id) && !visitasDe(lp.id).length && !lp.notas) {
      const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_lugares', filtro: { id: lp.id } }); if (error) return falha(error);
      S.lugares = S.lugares.filter(x => x.id !== lp.id); S.lr.delete(lp.id);
    } else {
      const { error } = await grava({ tipo: 'apagar', tabela: 'viagem_lugar_rotulos', filtro: { lugar_id: lp.id, rotulo_id: rot.id } }); if (error) return falha(error);
      m.delete(rot.id); if (!m.size) S.lr.delete(lp.id);
    }
  }
  atualizaTudo(); return true;
}
function abreMarcacaoRapida(inicio) {
  const rot = rotuloVisitaPadrao(); if (!rot) return toast('Crie um rótulo que conte como visitado primeiro');
  const paisCasa = casa()?.pais || 'BR';
  const temEstados = S.estados.some(e => e.pais === paisCasa);
  const CONTS = ['South America', 'North America', 'Europe', 'Africa', 'Asia', 'Oceania'];
  const abas = [['paises', 'Países'], ...(temEstados ? [['estados', paisCasa === 'BR' ? 'Estados do Brasil' : `Estados · ${nomePais(paisCasa)}`]] : []), ...CONTS.map(k => ['c:' + k, CONTINENTES[k]])];
  let aba = 'paises', filtro = '';
  const el = telaCheia(`<div class="onb-topo">Por onde você já andou?</div>${inicio ? passosOnb(3) : ''}
    <div class="onb-busca"><input type="search" id="mr-busca" placeholder="Buscar" autocomplete="off" aria-label="Buscar"></div>
    <div class="onb-abas">${abas.map(([k, n]) => `<button data-aba="${esc(k)}">${esc(n)}</button>`).join('')}</div>
    <div class="onb-itens" id="mr-itens"></div>
    <div class="onb-rodape"><div class="conta" id="mr-conta"></div><button class="btn principal onb-btn" id="mr-ok">${inicio ? 'Ver meu mapa' : 'Pronto'}</button></div>`);
  const itens = el.querySelector('#mr-itens');
  const desenha = () => {
    const vis = idsVisita(), porPais = new Map(), porEstado = new Map();
    for (const l of S.lugares) {
      if (!visitado(l.id, vis)) continue;
      const ref = l.ref_externa || '';
      if (l.pais && !ref.startsWith('pais:')) porPais.set(l.pais, (porPais.get(l.pais) || 0) + 1);
      if (l.estado && !ref.startsWith('estado:')) porEstado.set(l.estado, (porEstado.get(l.estado) || 0) + 1);
    }
    const f = norm(filtro);
    const linha = (tipo, id, nome, bandeiraHtml) => {
      const outros = (tipo === 'pais' ? porPais : porEstado).get(id) || 0;
      const lp = S.lugares.find(l => l.ref_externa === tipo + ':' + id);
      const marcado = outros > 0 || (lp && rotulosDe(lp.id).has(rot.id));
      const sub = outros ? `<small>já pintado por ${outros} ${outros === 1 ? "lugar seu" : "lugares seus"}</small>` : "";
      return `<button class="onb-it" data-t="${tipo}" data-id="${esc(id)}" aria-pressed="${!!marcado}" ${outros ? 'disabled' : ''}>${bandeiraHtml}<span class="n">${esc(nome)}${sub}</span><span class="ck"></span></button>`;
    };
    let html = '';
    if (aba === 'estados') {
      html = S.estados.filter(e => e.pais === paisCasa && norm(e.nome).includes(f)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(e => linha('estado', e.id, e.nome, `<span class="f" style="font-size:1rem;width:24px;text-align:center;color:var(--muted)">${esc(e.id.split('-')[1] || '')}</span>`)).join('');
    } else {
      const ct = aba.startsWith('c:') ? aba.slice(2) : null;
      html = S.paises.filter(p => p.nome && (!ct || p.continente === ct) && norm(p.nome).includes(f)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(p => linha('pais', p.id, p.nome, `<span class="f">${bandeira(p.id)}</span>`)).join('');
    }
    const topo = itens.scrollTop;
    itens.innerHTML = html || '<div class="onb-vazio">Nada com esse nome.</div>';
    itens.scrollTop = topo;
    const nP = paisesVis.size, nE = [...estadosVis].filter(id => S.estadoPorId.get(id)?.pais === paisCasa).length;
    el.querySelector('#mr-conta').innerHTML = `<b>${nP} ${nP === 1 ? 'país' : 'países'}</b>${temEstados ? ` · ${nE} ${nE === 1 ? 'estado' : 'estados'}${paisCasa === 'BR' ? ' do Brasil' : ''}` : ''}`;
    el.querySelectorAll('.onb-abas button').forEach(b => b.setAttribute('aria-pressed', b.dataset.aba === aba));
  };
  el.querySelector('.onb-abas').onclick = e => { const b = e.target.closest('[data-aba]'); if (!b) return; aba = b.dataset.aba; itens.scrollTop = 0; desenha(); };
  el.querySelector('#mr-busca').oninput = e => { filtro = e.target.value; desenha(); };
  itens.onclick = async e => {
    const b = e.target.closest('.onb-it'); if (!b || b.disabled || b.dataset.ocupado) return;
    const ligar = b.getAttribute('aria-pressed') !== 'true';
    b.dataset.ocupado = '1'; b.setAttribute('aria-pressed', ligar);
    await marcaInteiro(b.dataset.t, b.dataset.id, ligar, rot);
    desenha();
  };
  el.querySelector('#mr-ok').onclick = () => {
    if (inicio) fimBoasVindas();
    el.remove();
    if (paisesVis.size) { S.aba = 'paises'; atualizaTudo(); verTudo(); }
  };
  desenha();
}

function abreMenu() {
  abreModal(`
    <h3>Menu</h3>
    <div class="menu-lista">
      <button id="m-rapida">Marcação rápida<small>Marque de uma vez os países e estados onde já esteve</small></button>
      <button id="m-viagens">Viagens<small>Roteiros, trechos e quilômetros</small></button>
      <button id="m-tempo">Linha do tempo<small>Suas visitas por ano e mês</small></button>
      <button id="m-card">Imagem para compartilhar<small>Mapa e números prontos para WhatsApp e Instagram</small></button>
      <button id="m-comp">Compartilhar meu mapa<small>Link só de leitura para amigos e família</small></button>
      <button id="m-backup">Baixar meus dados<small>Cópia em planilha ou arquivo completo</small></button>
      <button id="m-rot">Rótulos<small>Criar, renomear, mudar cor</small></button>
      <button id="m-sair">Sair<small>${esc(S.user?.email || '')}</small></button>
    </div>
    <p id="m-versao" style="text-align:center;opacity:.55;font-size:.72rem;margin:10px 0 0"></p>`, (m, fechar) => {
    // versão em uso neste aparelho: vem do nome do cache criado pelo service worker
    try { caches.keys().then(ks => { const v = ks.map(k => /^poa-v(\d+)$/.exec(k)?.[1]).filter(Boolean).sort((a, b) => b - a)[0]; if (v) m.querySelector('#m-versao').textContent = 'Versão ' + v; }).catch(() => {}); } catch {}
    m.querySelector('#m-rot').onclick = () => { fechar(); abreRotulos(); };
    m.querySelector('#m-rapida').onclick = () => { fechar(); abreMarcacaoRapida(); };
    m.querySelector('#m-tempo').onclick = () => { fechar(); abreLinhaDoTempo(); };
    m.querySelector('#m-viagens') && (m.querySelector('#m-viagens').onclick = () => { fechar(); abreViagens(); });
    m.querySelector('#m-card').onclick = () => { fechar(); abreCard(); };
    m.querySelector('#m-est') && (m.querySelector('#m-est').onclick = () => { fechar(); abreEstatisticas(); });
    m.querySelector('#m-band') && (m.querySelector('#m-band').onclick = () => { fechar(); abreBandeiras(); });
    m.querySelector('#m-comp').onclick = () => { fechar(); abreCompartilhar(); };
    m.querySelector('#m-backup').onclick = () => { fechar(); abreBackup(); };
    m.querySelector('#m-sair').onclick = async () => { if ((fila.length || falhas.length) && !confirmaSaida()) return; try { localStorage.removeItem(CHAVE_COPIA); localStorage.removeItem(CHAVE_FILA); localStorage.removeItem(CHAVE_FALHAS); } catch {} await supa.auth.signOut(); location.reload(); };
  });
}
function confirmaSaida() { toast(fila.length ? `Há ${fila.length} alteração(ões) sem internet ainda não enviadas. Conecte-se antes de sair.` : `Há ${falhas.length} alteração(ões) não salvas. Toque no aviso no topo para resolver antes de sair.`, 5000); return false; }
function saiMira() { S.modoMira = false; $('#aviso-mira').hidden = true; document.body.classList.remove('mira'); }

/* ================= Login ================= */
let modoCadastro = false;
function telaLogin() {
  $('#carregando').hidden = true; $('#app').hidden = true; $('#tela-login').hidden = false;
  const erro = msg => { const e = $('#login-erro'); e.hidden = !msg; e.textContent = msg || ''; };
  $('#login-alternar').onclick = () => {
    modoCadastro = !modoCadastro;
    $('#login-btn').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
    $('#login-alternar').textContent = modoCadastro ? 'Já tenho conta. Entrar' : 'Primeira vez? Criar conta';
    $('#login-senha').autocomplete = modoCadastro ? 'new-password' : 'current-password'; erro('');
  };
  $('#login-esqueci').onclick = async () => {
    const email = $('#login-email').value.trim(); if (!email) return erro('Digite seu e-mail primeiro.');
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    erro(error ? 'Erro: ' + error.message : ''); if (!error) toast('Enviamos um link para redefinir a senha', 4000);
  };
  $('#form-login').onsubmit = async e => {
    e.preventDefault(); erro('');
    const email = $('#login-email').value.trim(), password = $('#login-senha').value;
    $('#login-btn').disabled = true;
    try {
      if (modoCadastro) {
        const { data, error } = await supa.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) { $('#login-sub').textContent = 'Conta criada. Abra o e-mail de confirmação, clique no link e depois volte aqui para entrar.'; modoCadastro = true; $('#login-alternar').click(); }
      } else {
        const { error } = await supa.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (er) {
      const m = er.message || '';
      erro(/invalid login/i.test(m) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(m) ? 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).' : /already registered/i.test(m) ? 'Esse e-mail já tem conta. Use “Entrar”.' : 'Erro: ' + m);
    } finally { $('#login-btn').disabled = false; }
  };
}

/* ================= Início ================= */
let iniciado = false;
async function entrar(user) {
  if (iniciado) return; iniciado = true;
  S.user = user;
  try { window.Sentry?.setUser({ id: user.id }); } catch {}
  $('#tela-login').hidden = true; $('#carregando').hidden = false;
  await sincroniza().catch(() => {});
  try {
    await Promise.all([carregaGeo(), carregaDados()]);
  } catch (e) {
    const c = leCopia();
    if (c && c.user?.id === user.id && erroDeRede(e)) {
      aplicaCopia(c);
      try { await carregaGeo(); } catch (e2) { $('#carregando').textContent = 'Sem internet e sem os mapas guardados. Abra o app uma vez com internet.'; iniciado = false; return; }
      montaApp(); atualizaSinal();
      toast(`Sem internet: mostrando seus dados de ${new Date(c.em).toLocaleDateString('pt-BR')}`, 4000);
      return;
    }
    $('#carregando').textContent = 'Erro ao carregar: ' + e.message; iniciado = false; return;
  }
  montaApp(); atualizaSinal();
}

function ligaNavegacao() {
  const nav = $('#barra-nav'); if (!nav) return;
  if (S.publico) nav.hidden = true;
  const marca = k => nav.querySelectorAll('button').forEach(b => b.dataset.nav === k ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const fechaModais = () => document.querySelectorAll('#modais .fundo').forEach(f => f.remove());
  const acoes = { mapa: () => {}, band: () => abreBandeiras(), voos: () => abreVoos(), est: () => abreEstatisticas(), viagens: () => abreViagens(), mais: () => abreMenu() };
  // telas que carregam dados antes de abrir (Bandeiras, Voos): a marcação espera a tela aparecer
  let pendente = null;
  nav.querySelectorAll('button').forEach(b => b.onclick = () => { pendente = b.dataset.nav === 'mapa' ? null : b.dataset.nav; fechaModais(); marca(b.dataset.nav); acoes[b.dataset.nav](); });
  // ao fechar qualquer tela, a barra volta para "Mapa"
  new MutationObserver(() => {
    if (document.querySelector('#modais .fundo')) { if (pendente) { marca(pendente); pendente = null; } }
    else if (!pendente) marca('mapa');
  }).observe($('#modais'), { childList: true });
}
// lista em gaveta: três alturas (fechada, meia, cheia); arrasta pela alça ou toca para alternar
function ligaGaveta() {
  const painel = $('#painel'), alca = $('#alca'); if (!painel || !alca) return;
  const ALTURAS = ['fechada', 'meia', 'cheia'];
  const ajustaMapa = () => { const h = painel.getBoundingClientRect().height; const fab = $('#mapa .fab'); if (fab) fab.style.bottom = (h + 12) + 'px';
    document.querySelectorAll('#mapa .leaflet-bottom').forEach(e => e.style.bottom = h + 'px'); };
  const define = g => { painel.dataset.gaveta = g; setTimeout(() => { ajustaMapa(); mapa && mapa.invalidateSize(); }, 260); };
  let y0 = null, h0 = 0, moveu = false;
  alca.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = painel.getBoundingClientRect().height; moveu = false; painel.classList.add('arrastando'); alca.setPointerCapture(e.pointerId); });
  alca.addEventListener('pointermove', e => { if (y0 == null) return; const d = y0 - e.clientY; if (Math.abs(d) > 4) moveu = true; painel.style.height = Math.max(90, h0 + d) + 'px'; ajustaMapa(); });
  alca.addEventListener('pointerup', e => {
    painel.classList.remove('arrastando'); const h = painel.getBoundingClientRect().height, total = painel.parentElement.getBoundingClientRect().height; painel.style.height = '';
    if (!moveu) { define(ALTURAS[(ALTURAS.indexOf(painel.dataset.gaveta) + 1) % 3]); y0 = null; return; }
    define(h < total * 0.25 ? 'fechada' : h < total * 0.7 ? 'meia' : 'cheia'); y0 = null;
  });
  painel.querySelector('.painel-topo').addEventListener('click', e => { if (e.target.closest('input')) { if (painel.dataset.gaveta === 'fechada') define('meia'); return; } if (painel.dataset.gaveta === 'fechada') define('meia'); });
  window.addEventListener('resize', ajustaMapa); setTimeout(ajustaMapa, 300);
}
function montaApp() {
  carregaRanking().then(() => atualizaTudo()).catch(() => {});
  carregaPop().then(() => atualizaTudo()).catch(() => {});
  // população das cidades de fora: depois que o app já abriu, sem atrasar a primeira tela
  if (precisaMundo()) setTimeout(() => carregaMundo().then(() => atualizaTudo()).catch(() => {}), 4000);
  $('#carregando').hidden = true; $('#app').hidden = false;
  document.body.classList.toggle('publico', !!S.publico);
  iniciaMapa(); atualizaTudo();
  carregaBase('unesco').then(() => atualizaTudo()).catch(() => {});
  setTimeout(verTudo, 350); // espera a lista se acomodar para descontar a altura dela

  $('#contadores').addEventListener('click', e => { const b = e.target.closest('.contador'); if (!b) return; if (b.dataset.extras) return abreExtras(); S.aba = b.dataset.aba; S.filtro = ''; $('#filtro').value = ''; atualizaTudo(); });
  let tLista; mapa.on('moveend', () => { clearTimeout(tLista); tLista = setTimeout(() => { renderLista(); desenhaBase(); desenhaMunicipios(); }, 120); });
  $('#lista').addEventListener('click', e => {
    if (e.target.closest('[data-ver-todos]')) {
      verTudo();
      return;
    }
    const mk = e.target.closest('.marca');
    if (mk) { if (S.publico) return; return mk.dataset.base ? marcaBase(mk.dataset.base, mk.dataset.r) : alternaRotulo(mk.dataset.l, mk.dataset.r); }
    const abb = e.target.closest('[data-abrir-base]'); if (abb) return abreBase(abb.dataset.abrirBase);
    const ed = e.target.closest('[data-editar-lugar]'); if (ed) return abreLugar(ed.dataset.editarLugar);
    const ab = e.target.closest('[data-abrir]'); if (ab) return mostraNoMapa(ab.dataset.abrir);
    if (e.target.closest('[data-add-pais]')) { const b = $('#busca'); b.focus(); b.placeholder = 'Digite o nome do país…'; return; }
    const zp = e.target.closest('[data-zoom-pais]'); if (zp) { const p = S.paisPorId.get(zp.dataset.zoomPais); if (p) mapa.fitBounds([[p.maior[1], p.maior[0]], [p.maior[3], p.maior[2]]]); return; }
    const ze = e.target.closest('[data-zoom-estado]'); if (ze) { const p = S.estadoPorId.get(ze.dataset.zoomEstado); if (p) mapa.fitBounds([[p.bbox[1], p.bbox[0]], [p.bbox[3], p.bbox[2]]]); }
  });
  $('#filtro').addEventListener('input', e => { S.filtro = e.target.value; renderLista(); });
  $('#ordem').addEventListener('change', e => { guardaOrdem(S.aba, e.target.value); if (e.target.value === 'perto') pedeMinhaPos(); renderLista(); });
  if (Object.values((() => { try { return JSON.parse(localStorage.getItem('poa-ordem') || '{}'); } catch { return {}; } })()).includes('perto')) pedeMinhaPos();
  $('#cab-rotulos').addEventListener('click', e => {
    if (e.target.closest('[data-ajuda-rot]')) return ajudaRotulos();
    const b = e.target.closest('[data-filtro-rot]'); if (!b) return;
    S.filtroRot = b.dataset.filtroRot && S.filtroRot !== b.dataset.filtroRot ? b.dataset.filtroRot : null;
    atualizaTudo();
  });
  $('#btn-menu').onclick = S.publico ? abreMenuPublico : abreMenu;
  ligaNavegacao(); ligaGaveta();
  if (S.publico) return;
  $('#busca').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim().length > 1) buscar(e.target.value.trim()); if (e.key === 'Escape') $('#resultados').hidden = true; });
  $('#busca').addEventListener('input', e => sugereEnquantoDigita(e.target.value));
  $('#busca').addEventListener('search', e => { if (!e.target.value) $('#resultados').hidden = true; });
  document.addEventListener('click', e => { if (!e.target.closest('.busca')) $('#resultados').hidden = true; });
  $('#btn-add').onclick = () => { S.modoMira = true; $('#aviso-mira').hidden = false; document.body.classList.add('mira'); };
  $('#cancelar-mira').onclick = e => { e.stopPropagation(); saiMira(); };
  if (precisaBoasVindas()) setTimeout(abreBoasVindas, 300);
}

// Visitante abrindo o link compartilhado: só leitura, sem notas nem datas
async function entrarPublico(token) {
  S.publico = true;
  try {
    const [{ data, error }] = await Promise.all([supa.rpc('viagem_publico', { t: token }), carregaGeo()]);
    if (error) throw error;
    if (!data) { $('#carregando').innerHTML = '<div style="text-align:center;padding:24px"><b>Este link não está mais ativo.</b><br><a href="/">Ir para o Por Onde Andei</a></div>'; return; }
    S.rotulos = (data.rotulos || []).sort((a, b) => a.ordem - b.ordem);
    S.lugares = (data.lugares || []).map(l => l.tipo === 'porto' ? { ...l, tipo: 'atracao' } : l); S.visitas = [];
    S.lr = new Map(); for (const x of data.marcas || []) { if (!S.lr.has(x.lugar_id)) S.lr.set(x.lugar_id, new Map()); S.lr.get(x.lugar_id).set(x.rotulo_id, null); }
    S.nomePublico = data.nome || '';
    document.title = S.nomePublico ? `Viagens de ${S.nomePublico}` : 'Por Onde Andei';
    $('.topo h1').innerHTML = S.nomePublico ? `Viagens de <span>${esc(S.nomePublico)}</span>` : 'Por Onde <span>Andei</span>';
  } catch (e) { $('#carregando').textContent = 'Não consegui abrir este mapa: ' + e.message; return; }
  montaApp();
}

(async () => {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  carregaGeo().catch(() => {});
  carregaMunicipios().catch(() => {});
  supa.auth.onAuthStateChange((ev, sessao) => {
    if (ev === 'PASSWORD_RECOVERY') {
      abreModal(`<h3>Nova senha</h3><div class="campo"><label for="nova">Senha nova</label><input id="nova" type="password" minlength="6"></div><div class="acoes"><button class="btn principal" id="salvar-senha">Salvar</button></div>`, (m, fechar) => {
        m.querySelector('#salvar-senha').onclick = async () => { const { error } = await supa.auth.updateUser({ password: m.querySelector('#nova').value }); if (error) return toast('Erro: ' + error.message); fechar(); toast('Senha alterada'); };
      });
    }
    if (sessao?.user && !new URLSearchParams(location.search).get('v')) entrar(sessao.user);
  });
  const tokenPublico = new URLSearchParams(location.search).get('v');
  if (tokenPublico) return entrarPublico(tokenPublico);
  let sessao = null;
  try { sessao = (await supa.auth.getSession()).data.session; } catch {}
  if (sessao?.user) entrar(sessao.user);
  else if (!navigator.onLine && leCopia()?.user) entrar(leCopia().user); // sem internet: abre com a última cópia
  else telaLogin();
})();
