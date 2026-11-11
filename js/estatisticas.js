'use strict';
/* ================= Estatísticas ================= */
const RAD = Math.PI / 180;
function areaAnel(r) {
  let soma = 0;
  for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; soma += (x2 - x1) * RAD * (2 + Math.sin(y1 * RAD) + Math.sin(y2 * RAD)); }
  return Math.abs(soma) * 6371 * 6371 / 2;
}
const areaFeicao = f => f._area ??= f.polys.reduce((t, p) => t + areaAnel(p[0]) - p.slice(1).reduce((h, b) => h + areaAnel(b), 0), 0);
const pct = (a, b) => b ? (100 * a / b).toLocaleString('pt-BR', { maximumFractionDigits: a / b < 0.1 ? 2 : 1 }) + '%' : '0%';
const num = n => n.toLocaleString('pt-BR');
function barra(rot, a, b) {
  const w = b ? Math.max(a ? 2 : 0, Math.round(100 * a / b)) : 0;
  return `<div class="barra"><div class="barra-topo"><span>${esc(rot)}</span><b>${num(a)} <small>de ${num(b)}</small></b></div><div class="barra-fundo"><div style="width:${w}%"></div></div></div>`;
}
// ---- dados do Brasil para as estatísticas
const CAPITAIS = ['1200401','2704302','1600303','1302603','2927408','2304400','5300108','3205309','5208707','2111300','5103403','5002704','3106200','1501402','2507507','4106902','2611606','2211001','3304557','2408102','4314902','1100205','1400100','4205407','3550308','2800308','1721000'];
const REGIOES_BR = { Norte: ['AC','AM','AP','PA','RO','RR','TO'], Nordeste: ['AL','BA','CE','MA','PB','PE','PI','RN','SE'], 'Centro-Oeste': ['DF','GO','MS','MT'], Sudeste: ['ES','MG','RJ','SP'], Sul: ['PR','RS','SC'] };
// casa: a cidade escolhida; sem escolha, a primeira marcada como "Morei"
function casa() {
  const c = S.config?.casa_lugar_id && S.lugares.find(l => l.id === S.config.casa_lugar_id);
  if (c) return c;
  const morei = S.rotulos.find(r => norm(r.nome) === 'morei');
  return morei ? S.lugares.find(l => l.tipo === 'cidade' && rotulosDe(l.id).has(morei.id)) : null;
}
async function salvaCasa(id) {
  const { error } = await supa.from('viagem_config').upsert({ user_id: S.user.id, casa_lugar_id: id || null, atualizado_em: new Date().toISOString() });
  if (error) return toast('Erro: ' + error.message);
  S.config = { ...(S.config || {}), casa_lugar_id: id || null }; salvaCopia();
}
// ---- Selos: coleções com total (pequenas: 3 níveis + 💎; grandes: 5 níveis + 💎) e marcos por contagem
const NOME_NIVEL = { cobre: 'Cobre', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', diamante: 'Diamante' };
const ESCALA_PEQ = [[.25, 'bronze'], [.5, 'prata'], [.75, 'ouro'], [1, 'diamante']];
const ESCALA_GRD = [[.05, 'cobre'], [.15, 'bronze'], [.3, 'prata'], [.6, 'ouro'], [.9, 'platina'], [1, 'diamante']];
const COLECAO_GRANDE = 50; // acima disso, a coleção usa a escala de 5 níveis
const MARCOS = { cidades: [10, 25, 50, 100, 250], aeroportos: [3, 5, 10, 25, 50], metropoles: [1, 3, 5, 10, 25] };
const NIVEIS_MARCO = ['cobre', 'bronze', 'prata', 'ouro', 'platina'];
function selo(id, grupo, icone, nome, n, total, marcos) {
  let degraus;
  if (marcos) degraus = marcos.map((q, i) => [q, NIVEIS_MARCO[i]]);
  else {
    let ant = 0;
    degraus = (total > COLECAO_GRANDE ? ESCALA_GRD : ESCALA_PEQ).map(([p, nv]) => { const q = p === 1 ? total : Math.max(ant + 1, Math.ceil(p * total)); ant = q; return [q, nv]; });
  }
  const nivel = degraus.filter(([q]) => n >= q).length; // quantos degraus já subiu
  return { id, grupo, icone, nome, n, total, degraus, nivel, atual: nivel ? degraus[nivel - 1][1] : null, prox: degraus[nivel] || null, diamante: !marcos };
}
// calcula todos os selos; o que depende de arquivo (ranking, população, municípios) entra se carregar
async function calculaSelos() {
  const c = calcula(), vis = idsVisita();
  const visitados = S.lugares.filter(l => visitado(l.id, vis));
  const cidadesVis = visitados.filter(l => l.tipo === 'cidade');
  const lista = [];
  const conts = new Map();
  S.paises.forEach(p => { const k = CONTINENTES[p.continente] || 'Outros'; if (!conts.has(k)) conts.set(k, 0); if (paisesVis.has(p.id)) conts.set(k, conts.get(k) + 1); });
  conts.delete('Outros');
  lista.push(selo('paises', 'Mundo', ICONES.pais, 'Países', paisesVis.size, S.paises.length));
  lista.push(selo('continentes', 'Mundo', GLOBO, 'Continentes', [...conts.values()].filter(Boolean).length, conts.size));
  const temAero = S.lugares.some(l => l.tipo === 'aeroporto');
  if (temAero) {
    try {
      const rk = await carregaRanking();
      const gig = new Set(rk.posMundo.keys());
      new Set([...rk.posNac.keys(), ...rk.posCont.keys()]).forEach(i => { if ((paxDe(i)?.pax || 0) >= 15e6) gig.add(i); });
      const meus = new Set(S.lugares.filter(l => l.tipo === 'aeroporto' && (l.ref_externa || '').startsWith('iata:') && (visitado(l.id, vis) || soLugar(l.id, idsSoLugar()))).map(l => l.ref_externa.slice(5)));
      lista.push(selo('aero-gigantes', 'Mundo', ICONES.aeroporto, 'Aeroportos muito grandes', [...meus].filter(i => gig.has(i)).length, gig.size));
    } catch {}
  }
  lista.push(selo('cidades', 'Marcos', ICONES.cidade, 'Cidades', c.cidade, null, MARCOS.cidades));
  lista.push(selo('aeroportos', 'Marcos', ICONES.aeroporto, 'Aeroportos', c.aeroporto, null, MARCOS.aeroportos));
  if ((S.voos || []).length) {
    await carregaBase('aeroporto').catch(() => {});
    const vs = S.voos;
    lista.push(selo('voos', 'Voos', ICONES.aeroporto, 'Voos', vs.length, null, [5, 10, 25, 50, 100]));
    lista.push(selo('km-voados', 'Voos', GLOBO, 'Km voados', vs.reduce((t, v) => t + kmVoo(v), 0), null, [10000, 25000, 50000, 100000, 250000]));
    lista.push(selo('companhias', 'Voos', ICONES.aeroporto, 'Companhias', new Set(vs.map(chaveCia).filter(Boolean)).size, null, [2, 3, 5, 10, 20]));
    lista.push(selo('modelos', 'Voos', ICONES.aeroporto, 'Modelos de avião', new Set(vs.map(v => v.modelo).filter(Boolean)).size, null, [2, 3, 5, 10, 20]));
  }
  try {
    await (cidadesVis.some(l => l.pais && l.pais !== 'BR') ? carregaMundo() : carregaPop());
    lista.push(selo('metropoles', 'Marcos', METROPOLE, 'Metrópoles (1 mi+)', cidadesVis.filter(l => porteCidade(l) === 'muito').length, null, MARCOS.metropoles));
  } catch {}
  // no seu país: estados de qualquer país; no Brasil, também regiões e capitais
  const pc = casa()?.pais || 'BR', g = `No seu país · ${nomePais(pc)}`;
  const ests = S.estados.filter(e => e.pais === pc);
  if (ests.length) lista.push(selo('estados-' + pc, g, ICONES.estado, pc === 'BR' ? 'Estados' : 'Estados e províncias', ests.filter(e => estadosVis.has(e.id)).length, ests.length));
  const ibgeVis = new Set(cidadesVis.filter(l => l.ref_externa?.startsWith('ibge:')).map(l => l.ref_externa.slice(5)));
  if (pc === 'BR') {
    const ufs = new Set([...estadosVis].filter(e => e.startsWith('BR-')).map(e => e.slice(3)));
    lista.push(selo('regioes-BR', g, GLOBO, 'Regiões', Object.values(REGIOES_BR).filter(u => u.some(x => ufs.has(x))).length, 5));
    lista.push(selo('capitais-BR', g, ICONES.cidade, 'Capitais', CAPITAIS.filter(x => ibgeVis.has(x)).length, 27));
  }
  // municípios: um selo por estado brasileiro onde você já esteve (estado com menos de 5 municípios fica de fora)
  if (ibgeVis.size) {
    try {
      const mun = await carregaMunicipios();
      const tot = new Map(), feitos = new Map();
      mun.forEach(x => tot.set(x.uf, (tot.get(x.uf) || 0) + 1));
      ibgeVis.forEach(cod => { const x = S.munPorCod.get(cod); if (x) feitos.set(x.uf, (feitos.get(x.uf) || 0) + 1); });
      [...feitos].filter(([uf]) => tot.get(uf) >= 5).sort((a, b) => b[1] / tot.get(b[0]) - a[1] / tot.get(a[0])).forEach(([uf, n]) => lista.push(selo('mun-' + uf, 'Municípios por estado', ICONES.estado, nomeEstado('BR-' + uf) || uf, n, tot.get(uf))));
    } catch {}
  }
  return lista;
}
const GLOBO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';
const METROPOLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M4 21V11h4v10M10 21V4h4v17M16 21V8h4v13"/></svg>';
const faltaTexto = s => s.prox ? `${NOME_NIVEL[s.prox[1]].toLowerCase()} com ${num(s.prox[0])}` : (s.diamante ? 'completo!' : 'nível máximo');
function htmlSelos(lista, todos) {
  const grupos = [];
  lista.filter(s => todos || s.nivel).forEach(s => { let g = grupos.find(x => x[0] === s.grupo); if (!g) grupos.push(g = [s.grupo, []]); g[1].push(s); });
  const cartao = s => {
    const alvo = s.total || s.degraus[s.degraus.length - 1][0], p = Math.min(100, Math.round(s.n / alvo * 100));
    return `<div class="sl" data-selo="${esc(s.id)}"><div class="med ${s.atual || 'nenhum'}">${s.icone}</div>
      <div class="niveis">${s.degraus.map(([, nv], i) => `<i class="${i < s.nivel ? 'on' : ''}${nv === 'diamante' ? ' d' : ''}"></i>`).join('')}</div>
      <b>${esc(s.nome)}</b><small>${s.atual ? NOME_NIVEL[s.atual] + ' · ' : ''}${num(s.n)}${s.total ? ' de ' + num(s.total) : ''} · ${faltaTexto(s)}</small>
      <div class="prog"><i style="width:${Math.max(p, 2)}%"></i></div></div>`;
  };
  // o mais perto: menor proporção que falta para o próximo nível
  const perto = lista.filter(s => s.prox).map(s => ({ s, f: (s.prox[0] - s.n) / s.prox[0] })).sort((a, b) => a.f - b.f)[0]?.s;
  const conquistados = lista.reduce((t, s) => t + s.nivel, 0);
  return `<div class="selos-resumo"><b>${conquistados}</b><span>${conquistados === 1 ? 'nível conquistado' : 'níveis conquistados'}${perto ? ` · o próximo mais perto: <strong>${esc(perto.nome)}, ${NOME_NIVEL[perto.prox[1]].toLowerCase()}</strong> (${perto.prox[0] - perto.n === 1 ? 'falta 1' : 'faltam ' + num(perto.prox[0] - perto.n)})` : ''}</span></div>
    <label class="meta" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="selos-todos" ${todos ? 'checked' : ''}> Mostrar também os que ainda não têm selo</label>
    ${grupos.length ? '' : '<p class="meta">Nenhum selo ainda. Marque a caixa para ver o que falta.</p>'}
    ${grupos.map(([g, ss]) => `<h4>${esc(g)}</h4><div class="sl-grade">${ss.map(cartao).join('')}</div>`).join('')}
    <div class="selos-escala"><b>Coleções de até ${COLECAO_GRANDE}</b>: bronze 25% · prata 50% · ouro 75% · 💎 100%<br>
    <b>Coleções maiores</b>: cobre 5% · bronze 15% · prata 30% · ouro 60% · platina 90% · 💎 100%<br>
    <b>Marcos</b>: 5 níveis por quantidade, sem diamante. Muito grande: aeroporto no top 50 do mundo ou com 15 milhões de passageiros ou mais.</div>`;
}
// avisa quando um selo sobe de nível (guarda o último nível de cada um neste aparelho)
let tSelos;
function agendaSelos() {
  if (S.publico || !S.user) return;
  clearTimeout(tSelos); tSelos = setTimeout(verificaSelos, 1500);
}
async function verificaSelos() {
  const chave = 'poa-selos-' + S.user.id;
  let antes = null; try { antes = JSON.parse(localStorage.getItem(chave) || 'null'); } catch {}
  const lista = await calculaSelos();
  const agora = { ...(antes || {}) }; lista.forEach(s => agora[s.id] = s.nivel);
  try { localStorage.setItem(chave, JSON.stringify(agora)); } catch {}
  if (!antes) return; // primeira vez neste aparelho: só registra
  const subiram = lista.filter(s => s.nivel > (antes[s.id] ?? 0)).sort((a, b) => b.nivel - a.nivel);
  if (subiram.length) toast(`🏅 Novo selo: ${subiram[0].nome} · ${NOME_NIVEL[subiram[0].atual]}${subiram.length > 1 ? ` (e mais ${subiram.length - 1})` : ''}`, 4000);
}
// "?" da legenda: o que cada rótulo faz, a partir da configuração de cada um (vale para rótulos criados pela pessoa)
function ajudaRotulos() {
  const faz = r => r.conta_como_visita ? 'pinta o mapa e conta nas estatísticas'
    : r.so_lugar ? 'conta o lugar, mas não pinta o país nem o estado (ex.: aeroporto de conexão)'
    : norm(r.nome) === 'quero ir' ? 'sua lista de desejos; não pinta o mapa'
    : 'marcação pessoal; dá para usar junto com as outras e não pinta o mapa sozinha';
  abreModal(`<h3>O que cada marca quer dizer</h3>
    <div class="ajuda-lista">${S.rotulos.map(r => `<div style="--c:${esc(r.cor)}"><i></i><span><b>${esc(r.nome)}</b> · ${esc(faz(r))}${r.tipos?.length ? ` <small class="meta">(só em ${esc(r.tipos.map(t => TIPOS[t]?.curto.toLowerCase() || t).join(', '))})</small>` : ''}</span></div>`).join('')}</div>
    <p class="meta">Toque na caixinha ao lado do lugar para ligar ou desligar. Toque no nome na legenda para mostrar só aquele. Para criar, renomear ou mudar cor: Menu › Rótulos.</p>
    <div class="acoes"><button class="btn principal" id="ar-ok">Entendi</button></div>`, (m, fechar) => { m.querySelector('#ar-ok').onclick = fechar; });
}
// Bandeiras e Estatísticas numa conta sem nada marcado: um convite em vez da tela de zeros
function modalVazio(titulo, emoji, chamada, texto, botao) {
  abreModal(`<h3>${esc(titulo)}</h3><div class="vazio-acao"><div class="e">${emoji}</div><b>${esc(chamada)}</b><p>${esc(texto)}</p>
    <button class="btn principal" id="va-ir">${esc(botao)}</button></div>
    <div class="acoes"><button class="btn" id="va-fechar">Fechar</button></div>`, (m, fechar) => {
    m.querySelector('#va-fechar').onclick = fechar;
    m.querySelector('#va-ir').onclick = () => { fechar(); abreMarcacaoRapida(); };
  });
}
function abreEstatisticas() {
  calcula();
  if (!S.publico && !paisesVis.size) return modalVazio('Estatísticas', '📊', 'Ainda não tem o que contar', 'Área do mundo, continentes, distâncias e selos aparecem assim que você marcar onde já esteve.', 'Marcar países e estados');
  const vis = idsVisita(), visitados = S.lugares.filter(l => visitado(l.id, vis));
  const areaMundo = S.paises.reduce((t, p) => t + areaFeicao(p), 0);
  const areaEst = [...estadosVis].reduce((t, id) => t + (S.estadoPorId.get(id) ? areaFeicao(S.estadoPorId.get(id)) : 0), 0);
  const conts = new Map();
  S.paises.forEach(p => { const c = CONTINENTES[p.continente] || 'Outros'; if (!conts.has(c)) conts.set(c, [0, 0]); conts.get(c)[1]++; if (paisesVis.has(p.id)) conts.get(c)[0]++; });
  const contsVis = [...conts].filter(([, [v]]) => v);
  const faltam = [...conts].filter(([, [v]]) => !v).map(([c]) => c).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const ufsBR = new Set([...estadosVis].filter(e => e.startsWith('BR-')).map(e => e.slice(3)));
  const cidadesVis = visitados.filter(l => l.tipo === 'cidade');
  const ibgeVis = new Set(cidadesVis.filter(l => l.ref_externa?.startsWith('ibge:')).map(l => l.ref_externa.slice(5)));
  const ext = k => cidadesVis.reduce((m, l) => !m || k(l, m) ? l : m, null);
  const norte = ext((a, b) => a.lat > b.lat), sul = ext((a, b) => a.lat < b.lat), leste = ext((a, b) => a.lon > b.lon), oeste = ext((a, b) => a.lon < b.lon);
  const so = idsSoLugar(), porTipo = {}; S.lugares.filter(l => visitado(l.id, vis) || soLugar(l.id, so)).forEach(l => { const t = ehParque(l) ? 'parque' : l.tipo; porTipo[t] = (porTipo[t] || 0) + 1; });
  const NOMES_T = { cidade: 'Cidades', unesco: 'Patrimônios UNESCO', aeroporto: 'Aeroportos', atracao: 'Atrações', parque: 'Parques nacionais', museu: 'Museus' };
  const porRot = S.rotulos.map(r => [r, S.lugares.filter(l => rotulosDe(l.id).has(r.id)).length]);
  const capitais = CAPITAIS.filter(c => ibgeVis.has(c)).length;
  // países para a aba País: o da sua casa primeiro
  const paisCasaSt = casa()?.pais || 'BR';
  const paisesStats = [...paisesVis].sort((a, b) => (b === paisCasaSt) - (a === paisCasaSt) || nomePais(a).localeCompare(nomePais(b), 'pt-BR'));
  const c0 = casa();
  const longe = c0 ? visitados.filter(l => l.tipo === 'cidade' && l.id !== c0.id).map(l => [l, distKm(c0.lat, c0.lon, l.lat, l.lon)]).sort((a, b) => b[1] - a[1])[0] : null;
  const opcoesCasa = (() => {
    const morei = S.rotulos.find(r => norm(r.nome) === 'morei');
    const cs = cidadesVis.slice().sort((a, b) => (morei && rotulosDe(b.id).has(morei.id)) - (morei && rotulosDe(a.id).has(morei.id)) || a.nome.localeCompare(b.nome, 'pt-BR'));
    return cs.map(l => `<option value="${l.id}" ${c0?.id === l.id ? 'selected' : ''}>${esc(l.nome)}${l.estado ? ' · ' + esc(nomeEstado(l.estado)) : ''}</option>`).join('');
  })();
  abreModal(`
    <h3>Estatísticas</h3>
    <div class="destaques">
      <div><b>${pct(areaEst, areaMundo)}</b><span>da área do mundo</span></div>
      <div><b>${paisesVis.size}</b><span>de ${S.paises.length} países (${pct(paisesVis.size, S.paises.length)})</span></div>
      <div><b>${contsVis.length}</b><span>de ${conts.size} continentes</span></div>
    </div>
    <p class="meta">A área soma cada estado ou província onde você esteve, inteiro: passar por Manaus conta o Amazonas todo.</p>
    <div class="abas-band st-abas" role="tablist">
      <button role="tab" data-st="geral">Geral</button><button role="tab" data-st="pais">País</button><button role="tab" data-st="aero">Aeroportos</button><button role="tab" data-st="selos">Selos</button>${(S.viagens || []).length >= 3 ? '<button role="tab" data-st="viagens">Viagens</button>' : ''}
    </div>
    <section data-st-sec="geral">
      <h4>Por continente</h4>
      ${contsVis.sort((a, b) => b[1][0] - a[1][0]).map(([c, [v, t]]) => barra(c, v, t)).join('')}
      ${faltam.length ? `<p class="meta">Faltam ${faltam.length}: ${esc(faltam.join(', '))}.</p>` : '<p class="meta">Todos os continentes!</p>'}
      <h4>Distâncias</h4>
      ${S.publico ? '' : `<div class="campo casa-campo"><label for="st-casa">Sua casa</label><select id="st-casa"><option value="">Escolha a cidade</option>${opcoesCasa}</select></div>`}
      <div class="tabela">
        ${longe ? `<span>Mais longe de casa</span><b>${esc(longe[0].nome)} · ${fmtKm(Math.round(longe[1]))}</b>` : ''}
        ${norte ? `<span>Cidade mais ao norte</span><b>${esc(norte.nome)}</b><span>Mais ao sul</span><b>${esc(sul.nome)}</b>
        <span>Mais a leste</span><b>${esc(leste.nome)}</b><span>Mais a oeste</span><b>${esc(oeste.nome)}</b>` : ''}</div>
      <h4>Tamanho das cidades</h4><div id="st-cid"><p class="meta">Carregando…</p></div>
      <h4>O que você já marcou</h4>
      <div class="tabela">${Object.keys(NOMES_T).filter(t => porTipo[t]).map(t => `<span>${NOMES_T[t]}</span><b>${num(porTipo[t])}</b>`).join('')}
        ${porRot.map(([r, n]) => `<span><i class="bolinha" style="background:${esc(r.cor)}"></i>${esc(r.nome)}</span><b>${num(n)}</b>`).join('')}</div>
    </section>
    <section data-st-sec="pais" hidden>
      <div class="st-paises">${paisesStats.map(p => `<button data-st-pais="${p}">${bandeira(p)} ${esc(nomePais(p))}</button>`).join('')}</div>
      <div id="st-pais"></div>
    </section>
    <section data-st-sec="selos" hidden><div id="st-selos"><p class="meta">Carregando…</p></div></section>
    <section data-st-sec="aero" hidden><div id="st-aero"><p class="meta">Carregando…</p></div></section>
    <section data-st-sec="viagens" hidden>
    ${(S.viagens || []).length ? `<div class="tabela">
      <span>Viagens registradas</span><b>${num(S.viagens.length)}</b>
      <span>Distância percorrida (linha reta)</span><b>${fmtKm(S.viagens.reduce((t, vg) => t + kmViagem(vg.id), 0))}</b>
      ${(() => { const maior = [...S.viagens].sort((a, b) => kmViagem(b.id) - kmViagem(a.id))[0]; return maior ? `<span>Mais longa: ${esc(maior.nome)}</span><b>${fmtKm(kmViagem(maior.id))}</b>` : ''; })()}
      <span>Voltas na Terra</span><b>${(S.viagens.reduce((t, vg) => t + kmViagem(vg.id), 0) / 40075).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</b></div>
      <h4>Por meio de transporte</h4><div class="tabela">
      ${(() => { const tot = kmPorTransporte(); return [...Object.keys(TRANSPORTES), 'local', 'sem'].filter(k => tot.get(k) >= 0.5).map(k => `<span>${k === 'sem' ? 'Trechos sem transporte marcado' : k === 'local' ? 'Trajetos até aeroportos' : TRANSPORTES[k].join(' ')}</span><b>${fmtKm(Math.round(tot.get(k)))}</b>`).join(''); })()}</div>` : '<p class="meta">Nenhuma viagem registrada ainda. Crie em Menu › Viagens.</p>'}
    </section>
    <div class="acoes"><button class="btn" id="st-fechar">Fechar</button></div>`, (m, fechar) => {
    m.querySelector('#st-fechar').onclick = fechar;
    const mostraAba = aba => {
      m.querySelectorAll('[data-st]').forEach(b => b.setAttribute('aria-selected', b.dataset.st === aba));
      m.querySelectorAll('[data-st-sec]').forEach(sec => sec.hidden = sec.dataset.stSec !== aba);
      try { localStorage.setItem('poa-st-aba', aba); } catch {}
    };
    m.querySelectorAll('[data-st]').forEach(b => b.onclick = () => mostraAba(b.dataset.st));
    mostraAba((() => { try { let a = localStorage.getItem('poa-st-aba') || 'geral'; if (a === 'brasil') a = 'pais'; if (a === 'voos') a = 'geral'; return m.querySelector(`[data-st="${a}"]`) ? a : 'geral'; } catch { return 'geral'; } })());
    const sel = m.querySelector('#st-casa');
    if (sel) sel.onchange = async () => { await salvaCasa(sel.value); fechar(); abreEstatisticas(); };
    // aba País: o que você conhece de cada país (no Brasil, mais os dados do IBGE)
    const desenhaPais = cc => {
      const box = m.querySelector('#st-pais'); if (!box) return;
      m.querySelectorAll('[data-st-pais]').forEach(b => b.setAttribute('aria-pressed', b.dataset.stPais === cc));
      try { localStorage.setItem('poa-st-pais', cc); } catch {}
      const ests = S.estados.filter(e => e.pais === cc), estsVis = ests.filter(e => estadosVis.has(e.id));
      const noPais = visitados.filter(l => l.pais === cc), cids = noPais.filter(l => l.tipo === 'cidade');
      const conta = t => noPais.filter(l => (t === 'transporte' ? l.tipo === 'aeroporto' : l.tipo === t)).length;
      const ehBR = cc === 'BR';
      box.innerHTML = `
        <h4>Estados e províncias</h4>
        ${ests.length ? barra(ehBR ? 'Estados' : 'Estados/províncias', estsVis.length, ests.length) : ''}
        ${estsVis.length ? `<p class="meta">${esc(estsVis.map(e => nomeEstado(e.id)).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', '))}</p>` : ''}
        ${ehBR ? `${barra('Capitais', capitais, 27)}<div id="st-mun-total"></div>
          <h4>Por região</h4>${Object.entries(REGIOES_BR).map(([r, ufs]) => barra(r, ufs.filter(u => ufsBR.has(u)).length, ufs.length)).join('')}` : ''}
        <h4>Cidades</h4><div id="st-pais-cid"><div class="tabela"><span>Cidades visitadas</span><b>${num(cids.length)}</b></div></div>
        ${ehBR ? '<h4>Municípios por estado</h4><div id="st-mun-uf"><p class="meta">Carregando…</p></div>' : ''}
        <h4>Patrimônios da UNESCO</h4><div id="st-unesco"><p class="meta">Carregando…</p></div>
        <h4>Outros lugares</h4><div class="tabela">
          <span>Aeroportos</span><b>${num(conta('transporte'))}</b>
          <span>Atrações e parques</span><b>${num(conta('atracao'))}</b>
          <span>Museus</span><b>${num(conta('museu'))}</b></div>`;
      (cc !== 'BR' ? carregaMundo() : carregaPop()).then(() => {
        const alvo = m.querySelector('#st-pais-cid'); if (!alvo) return;
        const cp = cids.map(l => ({ l, p: popCidade(l) })).filter(x => x.p).sort((a, b) => b.p.pop - a.p.pop);
        if (!cp.length) return;
        alvo.innerHTML = `<div class="tabela"><span>Cidades visitadas</span><b>${num(cids.length)}</b>
          <span>Maior</span><b>${esc(cp[0].l.nome)} · ${fmtHab(cp[0].p.pop)}</b>
          ${cp.length > 1 ? `<span>Menor</span><b>${esc(cp[cp.length - 1].l.nome)} · ${fmtHab(cp[cp.length - 1].p.pop)}</b>` : ''}</div>`;
      }).catch(() => {});
      if (ehBR) carregaMunicipios().then(mun => {
        const totUF = new Map(); mun.forEach(x => totUF.set(x.uf, (totUF.get(x.uf) || 0) + 1));
        const visUF = new Map(); ibgeVis.forEach(c => { const x = S.munPorCod.get(c); if (x) visUF.set(x.uf, (visUF.get(x.uf) || 0) + 1); });
        const t = m.querySelector('#st-mun-total'); if (t) t.innerHTML = barra('Municípios', ibgeVis.size, mun.length);
        const caixa = m.querySelector('#st-mun-uf'); if (!caixa) return;
        const linhas = [...visUF].map(([uf, n]) => [uf, n, totUF.get(uf)]).sort((a, b) => b[1] / b[2] - a[1] / a[2] || b[1] - a[1]);
        caixa.innerHTML = linhas.length ? linhas.map(([uf, n, t]) => barra(`${nomeEstado('BR-' + uf) || uf} · ${pct(n, t)}`, n, t)).join('') : '<p class="meta">Nenhum município ainda.</p>';
      }).catch(() => { const caixa = m.querySelector('#st-mun-uf'); if (caixa) caixa.innerHTML = '<p class="meta">Sem conexão para carregar a lista do IBGE.</p>'; });
      carregaBase('unesco').then(base => {
        const caixa = m.querySelector('#st-unesco'); if (!caixa) return;
        const doPais = base.filter(b => (b.paises || [b.pais]).includes(cc));
        const feitos = new Set(S.lugares.filter(l => l.tipo === 'unesco' && visitado(l.id, vis)).map(l => l.ref_externa));
        caixa.innerHTML = doPais.length ? barra('Visitados', doPais.filter(b => feitos.has(b.ref)).length, doPais.length) : '<p class="meta">Este país não tem patrimônio da UNESCO.</p>';
      }).catch(() => { const caixa = m.querySelector('#st-unesco'); if (caixa) caixa.innerHTML = '<p class="meta">Sem conexão para carregar a lista da UNESCO.</p>'; });
    };
    m.querySelectorAll('[data-st-pais]').forEach(b => b.onclick = () => desenhaPais(b.dataset.stPais));
    if (paisesStats.length) desenhaPais((() => { try { const p = localStorage.getItem('poa-st-pais'); return paisesStats.includes(p) ? p : paisesStats[0]; } catch { return paisesStats[0]; } })());
    calculaSelos().then(lista => {
      const box = m.querySelector('#st-selos'); if (!box) return;
      const desenha = todos => {
        box.innerHTML = htmlSelos(lista, todos);
        box.querySelector('#selos-todos').onchange = e => { try { localStorage.setItem('poa-selos-todos', e.target.checked ? '1' : '0'); } catch {} desenha(e.target.checked); };
      };
      desenha((() => { try { return localStorage.getItem('poa-selos-todos') === '1'; } catch { return false; } })());
    }).catch(() => { const box = m.querySelector('#st-selos'); if (box) box.innerHTML = '<p class="meta">Não foi possível calcular os selos.</p>'; });
    // ranking dos seus aeroportos: Brasil (ANAC) e mundo (top 50 do ACI)
    carregaRanking().then(rk => {
      const box = m.querySelector('#st-aero'); if (!box) return;
      const REG = { america_latina: 'Am. Latina', america_norte: 'Am. do Norte', europa: 'Europa', asia: 'Ásia', oriente_medio: 'Or. Médio', africa: 'África' };
      const meus = S.lugares.filter(l => l.tipo === 'aeroporto' && l.ref_externa?.startsWith('iata:') && (visitado(l.id, vis) || soLugar(l.id, so)))
        .map(l => ({ l, iata: l.ref_externa.slice(5) })).map(x => ({ ...x, nac: rk.posNac.get(x.iata), cont: rk.posCont.get(x.iata), mundo: rk.posMundo.get(x.iata) })).map(x => ({ ...x, br: x.nac?.pais === 'BR' ? x.nac.pos : null }))
        .sort((a, b) => (a.mundo || 999) - (b.mundo || 999) || (a.cont?.pos || 999) - (b.cont?.pos || 999) || (a.nac?.pos || 999) - (b.nac?.pos || 999) || a.l.nome.localeCompare(b.l.nome, 'pt-BR'));
      if (!meus.length) { box.innerHTML = '<p class="meta">Nenhum aeroporto marcado ainda.</p>'; return; }
      const curto = n => n.replace(/\s*\([A-Z]{3}\)\s*$/, '').replace(/^Aeroporto\s+(Internacional\s+)?((de|do|da|dos)\s+)?/i, '');
      const top = (lista, n) => lista.filter(x => x <= n).length;
      const mundos = meus.map(x => x.mundo).filter(Boolean), brs = meus.map(x => x.br).filter(Boolean);
      box.innerHTML = `<div class="destaques">
          <div><b>${top(mundos, 50)}</b><span>no top 50 do mundo</span></div>
          <div><b>${top(brs, 10)}</b><span>no top 10 do Brasil</span></div>
          <div><b>${meus.length}</b><span>aeroportos seus</span></div>
        </div>
        ${(() => { const c = { muito: 0, grande: 0, medio: 0, pequeno: 0 }; meus.forEach(x => { const p = porteAero(x.l); if (p) c[p]++; });
          return `<div class="portes">${Object.keys(c).filter(k => c[k]).map(k => `<span data-porte="${k}"><i></i>${c[k]} ${k === 'muito' ? (c[k] === 1 ? 'muito grande' : 'muito grandes') : k === 'medio' ? (c[k] === 1 ? 'médio' : 'médios') : k + (c[k] === 1 ? '' : 's')}</span>`).join('')}</div>`; })()}
        <div class="aero-lista">${meus.map(x => `<div class="aero-linha"><span class="sigla"${attrPorte(x.l)}>${esc(x.iata)}</span><span class="aero-nome">${esc(curto(x.l.nome))}</span>
          <span class="aero-pos">${x.mundo ? `<span title="Posição no mundo">🌎 ${x.mundo}º</span>` : ''}${x.cont ? `<span title="Posição no continente">${REG[x.cont.reg] || ''} ${x.cont.pos}º</span>` : ''}${x.nac ? `<span title="Posição no país">${bandeira(x.nac.pais)} ${x.nac.pos}º</span>` : ''}${!x.mundo && !x.cont && !x.nac ? '<span class="fora">sem ranking</span>' : ''}</span></div>`).join('')}</div>
        <p class="meta">🌎 mundo: top 50 do ACI ${rk.mundo.ano}${rk.continentes ? ` · continentes: listas regionais da Wikipedia (ACI e órgãos oficiais) ${Object.values(rk.continentes)[0].ano}` : ''} · país: ANAC ${rk.brasil.ano}${rk.argentina ? `, ANAC Argentina ${rk.argentina.ano}` : ''}${rk.europa_paises ? `, Eurostat ${rk.europa_paises.ano} (Europa)` : ''}${rk.reino_unido ? `, CAA ${rk.reino_unido.ano} (Reino Unido)` : ''}${rk.eua ? `, FAA ${rk.eua.ano} (EUA, por embarques)` : ''}</p>`;
    }).catch(() => { const box = m.querySelector('#st-aero'); if (box) box.innerHTML = '<p class="meta">Sem conexão para carregar o ranking.</p>'; });
    (precisaMundo() ? carregaMundo() : carregaPop()).then(() => {
      const box = m.querySelector('#st-cid'); if (!box) return;
      const cids = visitados.filter(l => l.tipo === 'cidade').map(l => ({ l, p: popCidade(l) })).filter(x => x.p).sort((a, b) => b.p.pop - a.p.pop);
      if (!cids.length) { box.innerHTML = '<p class="meta">Sem dados de população ainda.</p>'; return; }
      const c = { muito: 0, grande: 0, medio: 0, pequeno: 0 }; cids.forEach(x => c[porteCidade(x.l)]++);
      const nomes = { muito: ['metrópole', 'metrópoles'], grande: ['grande', 'grandes'], medio: ['média', 'médias'], pequeno: ['pequena', 'pequenas'] };
      const maior = cids[0], menor = cids[cids.length - 1], brs = cids.filter(x => x.p.ibge);
      box.innerHTML = `<div class="portes">${Object.keys(c).filter(k => c[k]).map(k => `<span data-porte="${k}"><i></i>${c[k]} ${nomes[k][c[k] === 1 ? 0 : 1]}</span>`).join('')}</div>
        <div class="tabela"><span>Maior cidade</span><b>${esc(maior.l.nome)} · ${fmtHab(maior.p.pop)}</b>
        <span>Menor cidade</span><b>${esc(menor.l.nome)} · ${fmtHab(menor.p.pop)}</b>
        ${brs.length ? `<span>Moradores das cidades do Brasil que você visitou</span><b>${fmtHab(brs.reduce((t, x) => t + x.p.pop, 0))}</b>` : ''}</div>
        <p class="meta">Metrópole: 1 milhão de habitantes ou mais · grande: 500 mil a 1 milhão · média: 100 a 500 mil · pequena: menos de 100 mil. Brasil: IBGE ${popCidades.brasil.ano}; fora: GeoNames, aproximado.</p>`;
    }).catch(() => { const box = m.querySelector('#st-cid'); if (box) box.innerHTML = '<p class="meta">Sem conexão para carregar a população.</p>'; });
  });
}

/* ================= Mapa de bandeiras ================= */
// Estados: imagem oficial do Wikimedia Commons (tabela viagem_bandeiras, código ISO 3166-2 -> arquivo)
const ISO_REGIAO = {"FR-RGUYANEFRAN":"FR-GUF","FR-RHAUTSDEFRA":"FR-HDF","FR-RGRANDEST":"FR-GES","ES-RCEUTA":"ES-CE","IT-RVALLEDAOST":"IT-23","IT-RPIEMONTE":"IT-21","IT-RLOMBARDIA":"IT-25","IT-RTRENTINOAL":"IT-32","IT-RLIGURIA":"IT-42","FR-RPROVENCEAL":"FR-PAC","FR-RAUVERGNERH":"FR-ARA","ES-RMELILLA":"ES-ML","IT-REMILIAROMA":"IT-45","IT-RMARCHE":"IT-57","IT-RVENETO":"IT-34","IT-RFRIULIVENE":"IT-36","FR-RNOUVELLEAQ":"FR-NAQ","ES-RFORALDENAV":"ES-NA","ES-RPAISVASCO":"ES-PV","ES-RARAGON":"ES-AR","FR-ROCCITANIE":"FR-OCC","ES-RCATALUNA":"ES-CT","FR-RBOURGOGNEF":"FR-BFC","ES-REXTREMADUR":"ES-EX","ES-RANDALUCIA":"ES-AN","ES-RGALICIA":"ES-GA","ES-RCASTILLAYL":"ES-CL","IT-RABRUZZO":"IT-65","IT-RMOLISE":"IT-67","IT-RAPULIA":"IT-75","IT-RBASILICATA":"IT-77","IT-RCALABRIA":"IT-78","IT-RCAMPANIA":"IT-72","IT-RLAZIO":"IT-62","IT-RTOSCANA":"IT-52","ES-RVALENCIANA":"ES-VC","ES-RMURCIA":"ES-MU","ES-RASTURIAS":"ES-AS","ES-RCANTABRIA":"ES-CB","FR-RPAYSDELALO":"FR-PDL","FR-RBRETAGNE":"FR-BRE","FR-RNORMANDIE":"FR-NOR","FR-RMARTINIQUE":"FR-MTQ","FR-RGUADELOUPE":"FR-GUA","FR-RREUNION":"FR-LRE","FR-RMAYOTTE":"FR-MAY","ES-RCANARYIS":"ES-CN","IT-RSICILY":"IT-82","ES-RISLASBALEA":"ES-PM","IT-RSARDEGNA":"IT-88","FR-RCORSE":"FR-COR","ES-RLARIOJA":"ES-LO","ES-RCASTILLALA":"ES-CM","IT-RUMBRIA":"IT-55","FR-RCENTREVALD":"FR-CVL","FR-RILEDEFRANC":"FR-IDF","ES-RMADRID":"ES-MD"};
const isoEstado = id => ISO_REGIAO[id] || id;
const urlBandeira = arq => `https://commons.wikimedia.org/wiki/Special:FilePath/${arq}?width=160`;
let albumCompleto = (() => { try { return localStorage.getItem('poa-album') !== '0'; } catch { return true; } })();
async function abreBandeiras(abaInicial = 'paises') {
  calcula();
  if (!S.publico && !paisesVis.size && !paisesQuero.size) return modalVazio('Minhas bandeiras', '🏳️', 'Sua coleção começa aqui', 'Cada país onde você esteve ganha a bandeira nesta tela.', 'Marcar países onde já estive');
  const vis = idsVisita();
  const ord = ids => [...ids].sort((a, b) => nomePais(a).localeCompare(nomePais(b), 'pt-BR'));
  // classe do cartão: visitado, quero ir ou falta (cinza, só no álbum completo)
  const estado = (set, quero, id) => set.has(id) ? '' : quero.has(id) ? ' quero' : ' falta';
  const card = id => `<button class="band-card${estado(paisesVis, paisesQuero, id)}" data-pais="${esc(id)}"><span>${bandeira(id)}</span><small>${esc(nomePais(id))}</small></button>`;
  // estados de cada país com algum estado visitado (o álbum mostra todos eles)
  const paisesComEstado = new Set([...estadosVis].map(id => S.estadoPorId.get(id)?.pais).filter(Boolean));
  const paisCasa = casa()?.pais || 'BR'; paisesComEstado.add(paisCasa);
  const todosEstados = S.estados.filter(e => paisesComEstado.has(e.pais)).map(e => e.id);
  let arquivos = {};
  {
    const codigos = [...new Set([...todosEstados, ...estadosQuero].map(isoEstado))].concat(CAPITAIS.map(c => 'ibge:' + c));
    for (let i = 0; i < codigos.length; i += 150) {
      const { data } = await supa.from('viagem_bandeiras').select('codigo,arquivo').in('codigo', codigos.slice(i, i + 150));
      (data || []).forEach(r => arquivos[r.codigo] = r.arquivo);
    }
  }
  const imgBand = (arq, reserva) => arq ? `<img src="${urlBandeira(arq)}" alt="" loading="lazy" onerror="this.outerHTML='<span>${reserva}</span>'">` : `<span>${reserva}</span>`;
  const cardEstado = id => {
    const pais = S.estadoPorId.get(id)?.pais;
    return `<button class="band-card estado${estado(estadosVis, estadosQuero, id)}" data-estado="${esc(id)}">${imgBand(arquivos[isoEstado(id)], bandeira(pais))}<small>${esc(nomeEstado(id))}</small></button>`;
  };
  const porNome = (a, b) => nomeEstado(a).localeCompare(nomeEstado(b), 'pt-BR');
  const htmlEstados = () => {
    let h = '';
    const grupos = [...paisesComEstado].sort((a, b) => (b === paisCasa) - (a === paisCasa) || nomePais(a).localeCompare(nomePais(b), 'pt-BR'));
    for (const p of grupos) {
      const ids = S.estados.filter(e => e.pais === p).map(e => e.id), feitos = ids.filter(id => estadosVis.has(id));
      if (!feitos.length && !albumCompleto) continue;
      const mostrar = albumCompleto ? ids : feitos;
      h += `<div class="grupo-band"><span>${bandeira(p)} ${esc(nomePais(p))}</span><span>${feitos.length} de ${ids.length}</span></div>`;
      h += `<div class="bandeiras">${mostrar.sort((a, b) => estadosVis.has(b) - estadosVis.has(a) || porNome(a, b)).map(cardEstado).join('')}</div>`;
    }
    const outros = [...estadosQuero].filter(id => !paisesComEstado.has(S.estadoPorId.get(id)?.pais));
    if (outros.length) h += `<h4>Quero ir</h4><div class="bandeiras">${outros.sort(porNome).map(cardEstado).join('')}</div>`;
    return h || '<p>Nenhum estado visitado ainda.</p>';
  };
  const htmlPaises = () => {
    let h = '';
    if (albumCompleto) {
      // álbum por continente: todos os países dos continentes onde você já esteve
      const conts = new Map();
      S.paises.forEach(p => { const c = CONTINENTES[p.continente] || 'Outros'; if (!conts.has(c)) conts.set(c, []); conts.get(c).push(p.id); });
      const visitados = [...conts].filter(([, ids]) => ids.some(id => paisesVis.has(id))).sort((a, b) => b[1].filter(id => paisesVis.has(id)).length - a[1].filter(id => paisesVis.has(id)).length);
      for (const [c, ids] of visitados) {
        const feitos = ids.filter(id => paisesVis.has(id)).length;
        h += `<div class="grupo-band"><span>${esc(c)}</span><span>${feitos} de ${ids.length}</span></div>`;
        h += `<div class="bandeiras">${ord(ids).sort((a, b) => paisesVis.has(b) - paisesVis.has(a)).map(card).join('')}</div>`;
      }
      const jaMostrados = new Set(visitados.flatMap(([, ids]) => ids));
      const quero = ord(paisesQuero).filter(id => !jaMostrados.has(id));
      if (quero.length) h += `<h4>Quero ir</h4><div class="bandeiras">${quero.map(card).join('')}</div>`;
      return h || '<p>Nenhum país visitado ainda.</p>';
    }
    return `<div class="bandeiras">${ord(paisesVis).map(card).join('')}</div>
      ${paisesQuero.size ? `<h4>Quero ir</h4><div class="bandeiras">${ord(paisesQuero).map(card).join('')}</div>` : ''}`;
  };
  // capitais brasileiras (bandeira municipal da Wikidata)
  const capVisitadas = new Set(S.lugares.filter(l => l.tipo === 'cidade' && l.ref_externa?.startsWith('ibge:') && visitado(l.id, vis)).map(l => l.ref_externa.slice(5)).filter(c => CAPITAIS.includes(c)));
  // capitais: a lista é a do Brasil; quem mora fora só vê a aba se já passou por alguma
  const temCapitais = paisCasa === 'BR' || capVisitadas.size > 0;
  const htmlCapitais = () => {
    const mun = S.munPorCod;
    const lista = CAPITAIS.filter(c => albumCompleto || capVisitadas.has(c))
      .map(c => ({ c, nome: mun?.get(c)?.nome || '', uf: mun?.get(c)?.uf || '' }))
      .sort((a, b) => capVisitadas.has(b.c) - capVisitadas.has(a.c) || a.nome.localeCompare(b.nome, 'pt-BR'));
    return `<div class="grupo-band"><span>🇧🇷 Capitais do Brasil</span><span>${capVisitadas.size} de 27</span></div>
      <div class="bandeiras">${lista.map(({ c, nome, uf }) => `<button class="band-card estado${capVisitadas.has(c) ? '' : ' falta'}" data-cap="${c}">${imgBand(arquivos['ibge:' + c], '🏙️')}<small>${esc(nome)}${uf ? ' · ' + uf : ''}</small></button>`).join('') || '<p>Nenhuma capital ainda.</p>'}</div>`;
  };
  await carregaMunicipios().catch(() => {});
  abreModal(`
    <h3>Minhas bandeiras</h3>
    <div class="abas-band" role="tablist">
      <button role="tab" data-aba-band="paises">Países <b>${paisesVis.size}</b></button>
      <button role="tab" data-aba-band="estados">Estados <b>${estadosVis.size}</b></button>
      ${temCapitais ? `<button role="tab" data-aba-band="capitais">Capitais <b>${capVisitadas.size}</b></button>` : ''}
      <button role="tab" data-aba-band="mapa">Mapa</button>
    </div>
    <div class="band-opcoes"></div>
    <div id="band-corpo"></div>
    <div class="acoes"><button class="btn" id="bd-fechar">Fechar</button></div>`, (m, fechar) => {
    if (abaInicial === 'capitais' && !temCapitais) abaInicial = 'paises';
    let abaAtual = abaInicial, mapaModo = 'paises';
    const opcoes = m.querySelector('.band-opcoes');
    const mostra = aba => {
      abaAtual = aba;
      m.querySelectorAll('[data-aba-band]').forEach(b => b.setAttribute('aria-selected', b.dataset.abaBand === aba));
      opcoes.innerHTML = aba === 'mapa'
        ? `<div class="seg"><button data-modo="paises" aria-pressed="${mapaModo === 'paises'}">Países</button>${[...paisesComEstado].sort((a, b) => (b === paisCasa) - (a === paisCasa) || nomePais(a).localeCompare(nomePais(b), 'pt-BR')).map(p => `<button data-modo="estados:${p}" aria-pressed="${mapaModo === 'estados:' + p}" title="Estados de ${esc(nomePais(p))}">${bandeira(p)}</button>`).join('')}</div>`
        : `<label class="album"><input type="checkbox" ${albumCompleto ? 'checked' : ''}> Mostrar as que faltam</label>`;
      const corpo = m.querySelector('#band-corpo');
      corpo.innerHTML = aba === 'paises' ? htmlPaises() : aba === 'estados' ? htmlEstados() : aba === 'capitais' ? htmlCapitais() : '<canvas class="mapa-band"></canvas>';
      if (aba === 'mapa') desenhaMapaBandeiras(m.querySelector('.mapa-band'), mapaModo, arquivos);
      opcoes.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { mapaModo = b.dataset.modo; mostra('mapa'); });
      const chk = opcoes.querySelector('.album input');
      if (chk) chk.onchange = () => { albumCompleto = chk.checked; try { localStorage.setItem('poa-album', albumCompleto ? '1' : '0'); } catch {} mostra(abaAtual); };
      m.querySelectorAll('[data-pais]').forEach(b => b.onclick = () => { fechar(); const p = S.paisPorId.get(b.dataset.pais); S.aba = 'paises'; atualizaTudo(); if (p) mapa.fitBounds([[p.maior[1], p.maior[0]], [p.maior[3], p.maior[2]]]); });
      m.querySelectorAll('[data-estado]').forEach(b => b.onclick = () => { fechar(); const e = S.estadoPorId.get(b.dataset.estado); S.aba = 'estados'; atualizaTudo(); if (e) mapa.fitBounds([[e.bbox[1], e.bbox[0]], [e.bbox[3], e.bbox[2]]]); });
      m.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => { const x = S.munPorCod?.get(b.dataset.cap); if (!x) return; fechar(); S.aba = 'cidade'; atualizaTudo(); mapa.setView([x.lat, x.lon], 11); });
    };
    m.querySelectorAll('[data-aba-band]').forEach(b => b.onclick = () => mostra(b.dataset.abaBand));
    m.querySelector('#bd-fechar').onclick = fechar;
    mostra(abaInicial);
  });
}

/* ================= Compartilhar ================= */
async function abreCompartilhar() {
  let { data: reg } = await supa.from('viagem_compartilhar').select('*').maybeSingle();
  const link = () => `${location.origin}/?v=${reg.token}`;
  const desenhar = m => {
    m.querySelector('#cp-corpo').innerHTML = !reg ? `
      <p>Crie um link para mostrar seu mapa a quem você quiser. Quem abrir vê o mapa, as listas, as estatísticas e as bandeiras, sem poder mudar nada.</p>
      <p class="meta">Notas e datas das visitas não aparecem no link.</p>
      <div class="campo"><label for="cp-nome">Seu nome no mapa</label><input id="cp-nome" placeholder="Ex.: Lucas"></div>
      <div class="acoes"><button class="btn" id="cp-fechar">Fechar</button><button class="btn principal" id="cp-criar">Criar link</button></div>` : `
      <div class="campo"><label for="cp-link">Seu link</label><input id="cp-link" readonly value="${esc(link())}"></div>
      <div class="acoes" style="justify-content:flex-start"><button class="btn principal" id="cp-copiar">Copiar link</button>${navigator.share ? '<button class="btn" id="cp-enviar">Enviar…</button>' : ''}</div>
      <div class="campo"><label for="cp-nome">Seu nome no mapa</label><input id="cp-nome" value="${esc(reg.nome || '')}"></div>
      <label class="meta" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cp-ativo" ${reg.ativo ? 'checked' : ''}> Link ativo (desmarque para ninguém mais conseguir abrir)</label>
      <div class="acoes"><button class="btn" id="cp-fechar">Fechar</button></div>`;
    m.querySelector('#cp-fechar').onclick = () => m.closest('.fundo').remove();
    if (!reg) {
      m.querySelector('#cp-criar').onclick = async () => {
        const { data, error } = await supa.from('viagem_compartilhar').insert({ nome: m.querySelector('#cp-nome').value.trim() || null }).select().single();
        if (error) return toast('Erro: ' + error.message);
        reg = data; desenhar(m);
      };
      return;
    }
    m.querySelector('#cp-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(link()); toast('Link copiado'); }
      catch { const i = m.querySelector('#cp-link'); i.select(); toast('Selecionei o link: é só copiar'); }
    };
    const env = m.querySelector('#cp-enviar');
    if (env) env.onclick = () => navigator.share({ title: 'Meu mapa de viagens', text: 'Olha por onde eu já andei:', url: link() }).catch(() => {});
    m.querySelector('#cp-nome').onchange = async e => { const { error } = await supa.from('viagem_compartilhar').update({ nome: e.target.value.trim() || null }).eq('user_id', reg.user_id); if (error) toast('Erro: ' + error.message); else toast('Nome salvo'); };
    m.querySelector('#cp-ativo').onchange = async e => { const { error } = await supa.from('viagem_compartilhar').update({ ativo: e.target.checked }).eq('user_id', reg.user_id); if (error) return toast('Erro: ' + error.message); reg.ativo = e.target.checked; toast(reg.ativo ? 'Link ativado' : 'Link desativado'); };
  };
  abreModal(`<h3>Compartilhar meu mapa</h3><div id="cp-corpo"></div>`, m => desenhar(m));
}

function abreMenuPublico() {
  abreModal(`
    <h3>${esc(S.nomePublico ? 'Viagens de ' + S.nomePublico : 'Por Onde Andei')}</h3>
    <div class="menu-lista">
      <button id="m-est">Estatísticas<small>Países, continentes e área do mundo</small></button>
      <button id="m-band">Bandeiras<small>Países visitados</small></button>
      <button id="m-card">Imagem do mapa<small>Para salvar ou enviar</small></button>
      <a class="menu-link" href="/">Criar o meu mapa</a>
    </div>`, (m, fechar) => {
    m.querySelector('#m-est').onclick = () => { fechar(); abreEstatisticas(); };
    m.querySelector('#m-band').onclick = () => { fechar(); abreBandeiras(); };
    m.querySelector('#m-card').onclick = () => { fechar(); abreCard(); };
  });
}

/* ================= Backup ================= */
function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
function abreBackup() {
  const hoje = new Date().toISOString().slice(0, 10);
  abreModal(`
    <h3>Baixar meus dados</h3>
    <p>Uma cópia de tudo o que você marcou: lugares, rótulos, datas e notas. Guarde no Drive ou no computador.</p>
    <div class="menu-lista">
      <button id="bk-csv">Planilha (CSV)<small>Abre no Excel e no Google Planilhas</small></button>
      <button id="bk-json">Cópia completa (JSON)<small>Serve para restaurar tudo no app depois</small></button>
    </div>
    <div class="acoes"><button class="btn" id="bk-fechar">Fechar</button></div>`, (m, fechar) => {
    m.querySelector('#bk-fechar').onclick = fechar;
    m.querySelector('#bk-json').onclick = () => {
      const dados = { app: 'Por Onde Andei', versao: 2, gerado_em: new Date().toISOString(), rotulos: S.rotulos, lugares: S.lugares,
        marcas: [...S.lr].flatMap(([l, mm]) => [...mm.keys()].map(r => ({ lugar_id: l, rotulo_id: r }))), visitas: S.visitas || [], viagens: S.viagens || [], paradas: S.paradas || [], voos: S.voos || [] };
      baixarArquivo(`por-onde-andei-${hoje}.json`, JSON.stringify(dados, null, 2), 'application/json');
      toast('Cópia baixada');
    };
    m.querySelector('#bk-csv').onclick = () => {
      const c = v => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const linhas = [['Tipo', 'Nome', 'Estado', 'País', 'Rótulos', 'Visitas', 'Notas', 'Latitude', 'Longitude', 'Referência'].join(';')];
      for (const l of [...S.lugares].sort((a, b) => (a.pais || '').localeCompare(b.pais || '') || (a.estado || '').localeCompare(b.estado || '') || a.nome.localeCompare(b.nome, 'pt-BR'))) {
        const rots = S.rotulos.filter(r => rotulosDe(l.id).has(r.id)).map(r => r.nome).join(', ');
        const vis = visitasDe(l.id).reverse().map(fmtVisita).join(', ');
        linhas.push([ehParque(l) ? 'Parque nacional' : TIPOS[l.tipo].um, l.nome, nomeEstado(l.estado), nomePais(l.pais), rots, vis, l.notas, l.lat, l.lon, l.ref_externa].map(c).join(';'));
      }
      baixarArquivo(`por-onde-andei-${hoje}.csv`, '\uFEFF' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
      toast('Planilha baixada');
    };
  });
}

/* ================= Imagem para compartilhar ================= */
async function geraCard() {
  calcula();
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  try { await document.fonts?.ready; } catch {}
  const fd = getComputedStyle(document.documentElement).getPropertyValue('--f-display').trim() || 'sans-serif';
  const fb = getComputedStyle(document.documentElement).getPropertyValue('--f-body').trim() || 'sans-serif';
  const caixa = (x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  c.fillStyle = '#123a3f'; c.fillRect(0, 0, W, H);
  // mapa-múndi em projeção simples; países visitados e estados visitados em destaque
  const mx = 40, my = 220, mw = W - 80, mh = mw * 0.5;
  const px = lon => mx + (lon + 180) / 360 * mw, py = lat => my + (90 - lat) / 180 * mh;
  c.save(); caixa(mx, my, mw, mh, 28); c.clip();
  c.fillStyle = '#0e2c30'; c.fillRect(mx, my, mw, mh);
  const desenha = (f, cor) => { c.fillStyle = cor; c.beginPath(); for (const p of f.polys) for (const anel of p) { anel.forEach(([x, y], i) => i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))); c.closePath(); } c.fill('evenodd'); };
  S.paises.forEach(p => desenha(p, paisesVis.has(p.id) ? '#2fb3a3' : '#2a4a4e'));
  S.estados.filter(e => estadosVis.has(e.id)).forEach(e => desenha(e, '#7fe3d5'));
  c.restore();
  c.fillStyle = '#f2e8d5'; c.font = `800 72px ${fd}`; c.fillText(S.publico && S.nomePublico ? `Viagens de ${S.nomePublico}` : 'Por onde andei', 60, 130);
  c.fillStyle = '#e4572e'; c.font = `600 34px ${fb}`; c.fillText(`${paisesVis.size} ${paisesVis.size === 1 ? 'país' : 'países'} · ${estadosVis.size} estados`, 60, 185);
  const vis = idsVisita(), cont = { cidade: 0, unesco: 0, aeroporto: 0, atracao: 0 };
  const so = idsSoLugar();
  S.lugares.forEach(l => { if ((visitado(l.id, vis) || soLugar(l.id, so)) && l.tipo in cont) cont[l.tipo]++; });
  // núcleo do app: cidades, aeroportos, estados do país de casa e municípios (fora do Brasil, continentes)
  const pc = (!S.publico && casa()?.pais) || 'BR', ests = S.estados.filter(e => e.pais === pc);
  const mun = new Set(S.lugares.filter(l => l.tipo === 'cidade' && l.ref_externa?.startsWith('ibge:') && visitado(l.id, vis)).map(l => l.ref_externa));
  const conts = new Set(S.paises.filter(p => paisesVis.has(p.id)).map(p => CONTINENTES[p.continente]).filter(Boolean));
  const itens = [[cont.cidade, 'cidades'], [cont.aeroporto, 'aeroportos'],
    [`${ests.filter(e => estadosVis.has(e.id)).length}/${ests.length}`, `estados ${pc === 'BR' ? 'do Brasil' : 'de ' + nomePais(pc)}`],
    mun.size ? [mun.size, 'municípios do Brasil'] : [conts.size, conts.size === 1 ? 'continente' : 'continentes']];
  const by = my + mh + 50, bw = (W - 120 - 30) / 2, bh = 150;
  itens.forEach(([n, t], i) => {
    const x = 60 + (i % 2) * (bw + 30), y = by + Math.floor(i / 2) * (bh + 30);
    c.fillStyle = '#0e2c30'; caixa(x, y, bw, bh, 24); c.fill();
    c.fillStyle = '#f2e8d5'; c.font = `800 76px ${fd}`; c.fillText(String(n), x + 34, y + 86);
    c.fillStyle = '#9fc3c0'; c.font = `500 30px ${fb}`; c.fillText(t, x + 34, y + 128);
  });
  // os 3 selos mais altos
  try {
    const ORD = ['cobre', 'bronze', 'prata', 'ouro', 'platina', 'diamante'];
    const COR = { cobre: ['#d7895f', '#9a4f2c'], bronze: ['#e3a26b', '#b5733e'], prata: ['#e4e9ec', '#8e9aa3'], ouro: ['#f5d76e', '#d4a017'], platina: ['#f2f6f8', '#9fb4c2'], diamante: ['#c9f3ff', '#3fb7e0'] };
    const top = (await calculaSelos()).filter(x => x.atual).sort((a, b) => ORD.indexOf(b.atual) - ORD.indexOf(a.atual) || b.n / (b.total || b.degraus.at(-1)[0]) - a.n / (a.total || a.degraus.at(-1)[0])).slice(0, 3);
    if (top.length) {
      const sy = by + 2 * bh + 30 + 40, sw = (W - 120) / 3;
      top.forEach((x, i) => {
        const cx = 60 + i * sw + 44, cy = sy + 44, g = c.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, 44);
        g.addColorStop(0, COR[x.atual][0]); g.addColorStop(1, COR[x.atual][1]);
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 40, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#123a3f'; c.font = `800 30px ${fd}`; c.textAlign = 'center'; c.fillText(x.atual === 'diamante' ? '◆' : '★', cx, cy + 11); c.textAlign = 'left';
        let nome = x.nome.replace(/\s*\(.*\)$/, ''); c.font = `700 28px ${fb}`; while (c.measureText(nome).width > sw - 110 && nome.length > 4) nome = nome.slice(0, -2).trimEnd() + '…';
        c.fillStyle = '#f2e8d5'; c.fillText(nome, cx + 56, cy - 4);
        c.fillStyle = '#9fc3c0'; c.font = `500 26px ${fb}`; c.fillText(NOME_NIVEL[x.atual], cx + 56, cy + 30);
      });
    }
  } catch {}
  c.fillStyle = '#9fc3c0'; c.font = `500 28px ${fb}`; c.fillText('Feito com o Por Onde Andei', 60, H - 50);
  return new Promise(r => cv.toBlob(r, 'image/png'));
}
async function abreCard() {
  const blob = await geraCard(), url = URL.createObjectURL(blob);
  const arq = new File([blob], 'por-onde-andei.png', { type: 'image/png' });
  let podeEnviar = false; try { podeEnviar = !!navigator.canShare?.({ files: [arq] }); } catch {}
  abreModal(`<h3>Imagem para compartilhar</h3><img class="card-prev" src="${url}" alt="Resumo das suas viagens">
    <div class="acoes">${podeEnviar ? '<button class="btn principal" id="cd-enviar">Enviar…</button>' : ''}<button class="btn" id="cd-baixar">Baixar</button><button class="btn" id="cd-fechar">Fechar</button></div>`, (m, fechar) => {
    m.querySelector('#cd-fechar').onclick = () => { URL.revokeObjectURL(url); fechar(); };
    m.querySelector('#cd-baixar').onclick = () => baixarArquivo('por-onde-andei.png', blob, 'image/png');
    const e = m.querySelector('#cd-enviar'); if (e) e.onclick = () => navigator.share({ files: [arq], title: 'Por onde andei' }).catch(() => {});
  });
}

