'use strict';
/* ================= Rótulos ================= */
function abreRotulos() {
  const desenhar = m => {
    m.querySelector('#lista-rot').innerHTML = S.rotulos.map(r => `
      <div class="rot-edit" data-id="${r.id}">
        <input type="color" value="${esc(r.cor)}" aria-label="Cor de ${esc(r.nome)}">
        <input type="text" value="${esc(r.nome)}" aria-label="Nome do rótulo">
        <button class="btn perigo" type="button" style="margin:0;padding:8px 10px">Excluir</button>
        <select class="conta" aria-label="Como ${esc(r.nome)} conta">
          <option value="visita" ${r.conta_como_visita ? 'selected' : ''}>Conta como visitado (pinta país e estado)</option>
          <option value="lugar" ${!r.conta_como_visita && r.so_lugar ? 'selected' : ''}>Conta só o lugar (escala: não pinta país nem estado)</option>
          <option value="nao" ${!r.conta_como_visita && !r.so_lugar ? 'selected' : ''}>Não conta (lista de desejos)</option>
        </select>
        <select class="conta onde" aria-label="Onde ${esc(r.nome)} aparece">
          <option value="" ${!r.tipos?.length ? 'selected' : ''}>Aparece em todos os tipos de lugar</option>
          ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${r.tipos?.length === 1 && r.tipos[0] === k ? 'selected' : ''}>Só em ${v.curto.toLowerCase()}</option>`).join('')}
        </select>
      </div>`).join('');
    m.querySelectorAll('.rot-edit').forEach(div => {
      const r = S.rotulos.find(x => x.id === div.dataset.id);
      const salvar = async mud => {
        const { error } = await supa.from('viagem_rotulos').update(mud).eq('id', r.id);
        if (error) return toast('Erro: ' + (error.code === '23505' ? 'já existe um rótulo com esse nome' : error.message));
        Object.assign(r, mud); atualizaTudo();
      };
      div.querySelector('input[type=color]').onchange = e => salvar({ cor: e.target.value });
      div.querySelector('input[type=text]').onchange = e => { const n = e.target.value.trim(); if (n) salvar({ nome: n }); else e.target.value = r.nome; };
      div.querySelector('select.onde').onchange = e => salvar({ tipos: e.target.value ? [e.target.value] : null });
      div.querySelector('select.conta:not(.onde)').onchange = e => salvar({ conta_como_visita: e.target.value === 'visita', so_lugar: e.target.value === 'lugar' });
      // excluir um rótulo tira ele de todos os lugares (o banco apaga as marcações junto): mostra quantos,
      // não deixa apagar o último que pinta o mapa e guarda tudo para o Desfazer
      const usos = [...S.lr].filter(([, mm]) => mm.has(r.id)).map(([lid, mm]) => ({ lugar_id: lid, rotulo_id: r.id, data: mm.get(r.id) ?? null }));
      const ultimoVisita = r.conta_como_visita && S.rotulos.filter(x => x.conta_como_visita).length === 1;
      const btEx = div.querySelector('.perigo');
      if (ultimoVisita) { btEx.onclick = () => toast(`“${r.nome}” é o único rótulo que pinta o mapa. Crie outro que conte como visitado antes de excluir este.`, 5000); }
      else botaoDuploToque(btEx, async () => {
        const copia = { ...r };
        const { error } = await supa.from('viagem_rotulos').delete().eq('id', r.id);
        if (error) return toast('Erro: ' + error.message);
        S.rotulos = S.rotulos.filter(x => x.id !== r.id);
        for (const [k, mm] of S.lr) { mm.delete(r.id); if (!mm.size) S.lr.delete(k); }
        atualizaTudo(); desenhar(m);
        toast(`Rótulo “${copia.nome}” excluído${usos.length ? ` de ${usos.length} ${usos.length === 1 ? 'lugar' : 'lugares'}` : ''}`, 8000, { rotulo: 'Desfazer', fn: async () => {
          const { user_id, criado_em, ...reg } = copia;
          const { error: e1 } = await supa.from('viagem_rotulos').insert(reg); if (e1) return toast('Não deu pra desfazer: ' + e1.message);
          for (let i = 0; i < usos.length; i += 500) { const { error: e2 } = await supa.from('viagem_lugar_rotulos').insert(usos.slice(i, i + 500)); if (e2) return toast('Rótulo voltou, mas algumas marcações não: ' + e2.message); }
          await carregaDados(); atualizaTudo(); desenhar(m); toast(`“${copia.nome}” voltou`);
        } });
      }, usos.length ? `Tirar de ${usos.length} ${usos.length === 1 ? 'lugar' : 'lugares'}? Toque de novo` : 'Confirmar');
    });
  };
  abreModal(`
    <h3>Rótulos</h3>
    <p>Crie os seus (Morei, Escala, A trabalho…). Um lugar pode ter vários ao mesmo tempo.</p>
    <div id="lista-rot"></div>
    <div class="linha"><div class="campo" style="flex-basis:200px"><label for="novo-rot">Novo rótulo</label><input id="novo-rot" placeholder="Ex.: Morei"></div>
      <div class="campo" style="flex:0 0 auto"><label for="novo-cor">Cor</label><input id="novo-cor" type="color" value="#7c3aed" style="width:56px;height:42px;padding:2px"></div></div>
    <div class="acoes"><button class="btn" id="r-fechar">Fechar</button><button class="btn principal" id="r-add">Adicionar rótulo</button></div>`, (m, fechar) => {
    desenhar(m);
    m.querySelector('#r-fechar').onclick = fechar;
    m.querySelector('#r-add').onclick = async () => {
      const nome = m.querySelector('#novo-rot').value.trim(); if (!nome) return m.querySelector('#novo-rot').focus();
      const ordem = Math.max(0, ...S.rotulos.map(r => r.ordem)) + 1;
      const { data, error } = await supa.from('viagem_rotulos').insert({ nome, cor: m.querySelector('#novo-cor').value, ordem }).select().single();
      if (error) return toast('Erro: ' + (error.code === '23505' ? 'já existe um rótulo com esse nome' : error.message));
      S.rotulos.push(data); m.querySelector('#novo-rot').value = ''; desenhar(m); atualizaTudo();
    };
  });
}

/* ================= Fotos dos lugares ================= */
// Ficam no Supabase Storage (bucket privado viagem-fotos), em <usuário>/<lugar>/<arquivo>.jpg
const fotosCache = new Map();
const pastaFotos = id => `${S.user.id}/${id}`;
async function listaFotos(id, renovar) {
  if (!renovar && fotosCache.has(id)) return fotosCache.get(id);
  const { data, error } = await supa.storage.from('viagem-fotos').list(pastaFotos(id), { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  if (error || !data?.length) { fotosCache.set(id, []); return []; }
  const caminhos = data.filter(f => f.name && !f.name.startsWith('.')).map(f => `${pastaFotos(id)}/${f.name}`);
  const { data: urls } = await supa.storage.from('viagem-fotos').createSignedUrls(caminhos, 3600);
  const fotos = (urls || []).filter(u => u.signedUrl).map(u => ({ path: u.path, url: u.signedUrl }));
  fotosCache.set(id, fotos); return fotos;
}
// reduz para no máximo 1600 px e JPEG ~80%, para caber folgado no plano grátis
function reduzImagem(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image(), url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      cv.toBlob(b => b ? ok(b) : falha(new Error('não deu para ler a imagem')), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('formato de imagem não suportado')); };
    img.src = url;
  });
}
async function enviaFotos(id, arquivos) {
  let ok = 0;
  for (const f of arquivos) {
    try {
      const blob = await reduzImagem(f);
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supa.storage.from('viagem-fotos').upload(`${pastaFotos(id)}/${nome}`, blob, { contentType: 'image/jpeg' });
      if (error) throw error; ok++;
    } catch (e) { toast('Uma foto falhou: ' + e.message, 4000); }
  }
  return ok;
}
function verFoto(url) {
  abreModal(`<img class="foto-grande" src="${url}" alt=""><div class="acoes"><button class="btn" id="vf-fechar">Fechar</button></div>`, (m, fechar) => { m.querySelector('#vf-fechar').onclick = fechar; });
}
// monta a seção de fotos dentro do formulário do lugar
async function secaoFotos(m, lugarId) {
  const box = m.querySelector('#f-fotos'); if (!box) return;
  const desenhar = async renovar => {
    box.innerHTML = '<span class="meta">Carregando fotos…</span>';
    const fotos = await listaFotos(lugarId, renovar);
    box.innerHTML = fotos.map((f, i) => `<div class="foto"><img src="${f.url}" alt="" data-ver="${i}" loading="lazy"><button type="button" class="tira-foto" data-tira="${i}" aria-label="Apagar foto">×</button></div>`).join('')
      + `<label class="foto add"><input type="file" accept="image/*" multiple hidden id="f-arq-foto"><span>+ Foto</span></label>`;
    box.querySelectorAll('[data-ver]').forEach(img => img.onclick = () => verFoto(fotos[+img.dataset.ver].url));
    box.querySelectorAll('[data-tira]').forEach(b => {
      let armado = false;
      b.onclick = async () => {
        if (!armado) { armado = true; b.classList.add('armado'); b.textContent = 'Apagar?'; setTimeout(() => { armado = false; b.classList.remove('armado'); b.textContent = '×'; }, 3000); return; }
        const { error } = await supa.storage.from('viagem-fotos').remove([fotos[+b.dataset.tira].path]);
        if (error) return toast('Erro: ' + error.message);
        desenhar(true);
      };
    });
    box.querySelector('#f-arq-foto').onchange = async e => {
      const arqs = [...e.target.files]; if (!arqs.length) return;
      box.insertAdjacentHTML('beforeend', `<span class="meta">Enviando ${arqs.length}…</span>`);
      const n = await enviaFotos(lugarId, arqs); if (n) toast(n === 1 ? 'Foto salva' : `${n} fotos salvas`);
      desenhar(true);
    };
  };
  desenhar(false);
}

/* ================= Mapa de bandeiras ================= */
// Países visitados pintados com a própria bandeira (imagens da flagcdn.com)
function carregaImg(src, cors = true) {
  return new Promise(ok => { const i = new Image(); if (cors) i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}
async function desenhaMapaBandeiras(canvas, modo = 'paises', arquivos = {}) {
  calcula();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth * dpr, H = Math.round(W * 0.75); canvas.width = W; canvas.height = H; canvas.style.height = (H / dpr) + 'px';
  const c = canvas.getContext('2d');
  // modo 'paises': países visitados com a bandeira; 'estados:XX': estados do país XX (sem XX, o da sua casa)
  const [tipoModo, paisModo] = modo.split(':'), ehEstados = tipoModo === 'estados';
  const paisBase = paisModo || casa()?.pais || 'BR';
  const feicoes = ehEstados ? S.estados.filter(e => e.pais === paisBase) : S.paises;
  const vis = feicoes.filter(f => (ehEstados ? estadosVis : paisesVis).has(f.id));
  const enquadrar = ehEstados ? feicoes : vis;
  // enquadra (com folga); sem nenhum, mostra o mundo
  let [x0, y0, x1, y1] = enquadrar.length ? enquadrar.reduce((b, p) => [Math.min(b[0], p.maior[0]), Math.min(b[1], p.maior[1]), Math.max(b[2], p.maior[2]), Math.max(b[3], p.maior[3])], [180, 90, -180, -90]) : [-170, -58, 190, 84];
  const folga = ehEstados ? [0.06, 0.05] : [0.25, 0.15];
  const padX = Math.max(ehEstados ? 1 : 8, (x1 - x0) * folga[0]), padY = Math.max(ehEstados ? 1 : 6, (y1 - y0) * folga[1]);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const latMeio = (y0 + y1) / 2, kx = Math.cos(latMeio * Math.PI / 180);
  let lw = (x1 - x0) * kx, lh = y1 - y0;
  if (lw / lh > W / H) { const nh = lw * H / W; y0 -= (nh - lh) / 2; y1 += (nh - lh) / 2; lh = nh; } else { const nw = lh * W / H; x0 -= (nw - lw) / kx / 2; x1 += (nw - lw) / kx / 2; lw = nw; }
  const px = lon => (lon - x0) * kx / lw * W, py = lat => (y1 - lat) / lh * H;
  const caminho = f => { c.beginPath(); for (const p of f.polys) for (const anel of p) { anel.forEach(([x, y], i) => i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))); c.closePath(); } };
  c.fillStyle = '#cfe3ea'; c.fillRect(0, 0, W, H);
  c.lineWidth = dpr * 0.6; c.strokeStyle = '#ffffff';
  for (const p of S.paises) { if (p.bbox[2] < x0 - 10 || p.bbox[0] > x1 + 10) continue; caminho(p); c.fillStyle = '#e9e4da'; c.fill('evenodd'); c.stroke(); }
  if (ehEstados) for (const e of feicoes) { caminho(e); c.fillStyle = '#ddd6c8'; c.fill('evenodd'); c.strokeStyle = '#ffffff'; c.stroke(); }
  const src = f => ehEstados
    ? (arquivos[isoEstado(f.id)] ? urlBandeira(arquivos[isoEstado(f.id)]).replace('width=160', 'width=480') : null)
    : (/^[A-Z]{2}$/.test(f.id) ? `https://flagcdn.com/w640/${f.id.toLowerCase()}.png` : null);
  // estados vêm do Wikimedia: sem crossOrigin (o quadro só é exibido, não exportado)
  const imgs = await Promise.all(vis.map(f => src(f) ? carregaImg(src(f), !ehEstados) : null));
  vis.forEach((p, i) => {
    c.save(); caminho(p); c.clip('evenodd');
    const img = imgs[i], [a, b, d, e] = p.maior;
    if (img) c.drawImage(img, px(a), py(e), px(d) - px(a), py(b) - py(e)); else { c.fillStyle = corToken('--visit'); c.fill(); }
    c.restore(); caminho(p); c.lineWidth = dpr * 1.2; c.strokeStyle = '#1b2b2d'; c.stroke();
  });
}

/* ================= Resumo do lugar (toque no pino) ================= */
function resumoLugar(l, marcador) {
  const rots = S.rotulos.filter(r => rotulosDe(l.id).has(r.id));
  const vis = visitasDe(l.id);
  const html = `<div class="resumo">
    <b>${esc(l.nome)}</b>
    <small>${esc([ehParque(l) ? 'Parque nacional' : TIPOS[l.tipo].um, nomeEstado(l.estado), nomePais(l.pais)].filter(Boolean).join(' · '))}</small>
    <div class="selos">${rots.map(r => `<span class="selo" style="--c:${esc(r.cor)}">${esc(r.nome)}</span>`).join('')}</div>
    ${vis.length ? `<small>Visitas: ${esc(vis.slice(0, 4).map(fmtVisita).join(', '))}${vis.length > 4 ? '…' : ''}</small>` : ''}
    ${l.notas && !S.publico ? `<small class="nota">${esc(l.notas)}</small>` : ''}
    ${S.publico ? '' : '<div class="resumo-foto"></div>'}
    ${S.publico ? '' : `<button class="btn principal" data-editar="${l.id}">Editar</button>`}
  </div>`;
  const pop = L.popup({ closeButton: true, autoPanPaddingTopLeft: [20, 60], autoPanPaddingBottomRight: [20, alturaLista() + 20], className: 'pop-resumo' }).setLatLng(marcador.getLatLng()).setContent(html).openOn(mapa);
  setTimeout(() => { const b = pop.getElement()?.querySelector('[data-editar]'); if (b) b.onclick = () => { mapa.closePopup(); abreLugar(l.id); }; }, 0);
  if (!S.publico) listaFotos(l.id).then(fotos => {
    const box = pop.getElement()?.querySelector('.resumo-foto'); if (!box || !fotos.length) return;
    box.innerHTML = `<img src="${fotos[0].url}" alt="">${fotos.length > 1 ? `<span>+${fotos.length - 1}</span>` : ''}`;
    box.onclick = () => verFoto(fotos[0].url); pop.update();
  }).catch(() => {});
}

