/* Kości – zapis wyników gry w kości (PWA, czysty JavaScript) */
'use strict';

/* =========================================================
   1. Stałe i dane
   ========================================================= */
const STORE_KEY = 'kosci.v1';
const TOP = ['1', '2', '3', '4', '5', '6'];
const LOW = ['1P', '2P', 'T', 'MS', 'DS', 'F', 'K', 'P', 'Sz'];
const FIELDS = TOP.concat(LOW);                 // 15 pól: indeksy 0–5 góra, 6–14 dół
const LOW_NAMES = {
  '1P': 'Jedna para', '2P': 'Dwie pary', T: 'Trójka', MS: 'Mały strit', DS: 'Duży strit',
  F: 'Full', K: 'Kareta', P: 'Poker', Sz: 'Szansa'
};
const MIN_PLAYERS = 2, MAX_PLAYERS = 99, MAX_DIGITS = 3;

/* Struktura danych w localStorage:
   { players: [{ id, name }],
     games:   [{ id, date, status: 'active' | 'finished', playerIds: [], scores: { [playerId]: [15 × liczba|null] } }] }
   Porzucona gra jest usuwana – nie trafia do statystyk. */
let db = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.players) && Array.isArray(d.games)) return d;
  } catch (e) { /* uszkodzone dane – zaczynamy od zera */ }
  return { players: [], games: [] };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('Nie udało się zapisać danych na urządzeniu'); }
}

/* =========================================================
   2. Pomocnicze
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.trim().replace(/\s+/g, ' ');
const nkey = (s) => norm(s).toLocaleLowerCase('pl');
const fmt = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));            // prawdziwy znak minus
const fmtAvg = (n) => {
  const s = (Math.round(n * 10) / 10).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return s.replace('-', '−');
};
const gierLabel = (n) => {
  if (n === 1) return '1 gra';
  const d = n % 10, dd = n % 100;
  return n + (d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? ' gry' : ' gier');
};
const playerById = (id) => db.players.find((p) => p.id === id);
const playerName = (id) => (playerById(id) || { name: '?' }).name;
const activeGame = () => db.games.find((g) => g.status === 'active');
const finishedGames = () => db.games.filter((g) => g.status === 'finished');
const gamesCount = (pid) => finishedGames().filter((g) => g.playerIds.includes(pid)).length;

/* Punktacja jednego gracza */
function score(vals) {
  const top = vals.slice(0, 6), low = vals.slice(6);
  const topFilled = top.filter((v) => v !== null).length;
  const raw = top.reduce((a, v) => a + (v ?? 0), 0);
  const complete = topFilled === 6;
  // Bonus dopiero po wypełnieniu całej góry: ≥ 9 → +50, 0–8 → 0, < 0 → −50
  const bonus = complete ? (raw >= 9 ? 50 : raw < 0 ? -50 : 0) : 0;
  const up = raw + bonus;
  const down = low.reduce((a, v) => a + (v ?? 0), 0);
  return {
    raw, bonus, complete, up, down, all: up + down, topFilled,
    unlocked: topFilled >= 3,
    filled: vals.filter((v) => v !== null).length
  };
}
const gameFilled = (g) => g.playerIds.reduce((a, pid) => a + score(g.scores[pid]).filled, 0);

/* Ikony */
const ICON = {
  back: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  arrow: (c) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  stats: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  play: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#141829" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>',
  minus: (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
  plus: (c, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  chevron: (c = '#5A6075', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`,
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A6075" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  backspace: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1z"/><path d="M15 9.5l-4 5M11 9.5l4 5"/></svg>',
  dice: `<svg width="260" height="220" viewBox="0 0 260 220" role="img" aria-label="Dwie kości do gry">
    <g transform="rotate(-12 85 120)"><rect x="20" y="55" width="130" height="130" rx="26" fill="#FFFFFF" stroke="#141829" stroke-width="4"/>
    <circle cx="55" cy="90" r="9" fill="#141829"/><circle cx="85" cy="120" r="9" fill="#141829"/><circle cx="115" cy="150" r="9" fill="#141829"/>
    <circle cx="115" cy="90" r="9" fill="#141829"/><circle cx="55" cy="150" r="9" fill="#141829"/></g>
    <g transform="rotate(14 185 90)"><rect x="125" y="20" width="110" height="110" rx="24" fill="#FFB400" stroke="#141829" stroke-width="4"/>
    <circle cx="155" cy="50" r="8" fill="#141829"/><circle cx="205" cy="100" r="8" fill="#141829"/><circle cx="180" cy="75" r="8" fill="#141829"/></g></svg>`
};
const topbar = (title, extra = '', backLabel = 'Wróć do ekranu głównego') =>
  `<header class="topbar"><a class="icon-btn" href="#/" aria-label="${backLabel}">${ICON.back}</a><h1>${title}</h1>${extra}</header>`;

/* Komunikat na chwilę */
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

/* Okno potwierdzenia – zwraca Promise<boolean> */
function confirmDialog({ title, text, ok, cancel = 'Anuluj', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">
      <h2 id="dlg-t">${title}</h2><p id="dlg-d">${text}</p>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${ok}</button>
      <button class="btn btn-outline" data-r="0">${cancel}</button></div>`;
    const done = (r) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(r); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
      else if (e.target === wrap) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-r="0"]').focus();
  });
}

/* =========================================================
   3. Nawigacja (hash): #/  #/nowa  #/gra  #/wyniki/<id>  #/statystyki
   ========================================================= */
function go(path, replace = false) {
  const h = '#/' + path;
  if (location.hash === h || (h === '#/' && !location.hash)) return route();
  if (replace) { location.replace(h); } else { location.hash = h; }
}
function route() {
  closeSheet();
  document.querySelectorAll('.dialog-wrap').forEach((d) => d.remove());
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  switch (page) {
    case 'nowa': return renderNew();
    case 'gra': return activeGame() ? renderGame() : go('', true);
    case 'wyniki': return renderResults(arg);
    case 'statystyki': return renderStats();
    default: return renderHome();
  }
}
window.addEventListener('hashchange', route);

/* =========================================================
   4. Ekran główny
   ========================================================= */
function renderHome() {
  const g = activeGame();
  let cont = '';
  if (g) {
    const names = g.playerIds.map(playerName).join(', ');
    cont = `<a class="btn btn-big btn-yellow" href="#/gra">
      <span class="btn-col"><span>Kontynuuj grę</span><span class="btn-sub">${gameFilled(g)} / ${g.playerIds.length * 15} pól · ${esc(names)}</span></span>${ICON.play}</a>`;
  }
  app.innerHTML = `<main class="screen home">
    <div class="home-blob" aria-hidden="true"></div>
    <div class="home-title"><span class="eyebrow">Zapis wyników</span><h1>Kości</h1></div>
    <div class="home-art">${ICON.dice}</div>
    <nav class="home-actions">
      ${cont}
      <button class="btn btn-big btn-primary" id="btn-new"><span>Nowa gra</span>${ICON.arrow('#FFFFFF')}</button>
      <a class="btn btn-big btn-outline" href="#/statystyki"><span>Statystyki</span>${ICON.stats}</a>
    </nav></main>`;
  $('#btn-new').addEventListener('click', async () => {
    const ag = activeGame();
    if (ag) {
      const ok = await confirmDialog({
        title: 'Niedokończona gra',
        text: 'Masz niedokończoną grę. Porzucić ją i zacząć nową? Porzucona gra nie trafi do statystyk.',
        ok: 'Porzuć i zacznij nową', danger: true
      });
      if (!ok) return;
      db.games = db.games.filter((x) => x !== ag);
      save();
    }
    go('nowa');
  });
}

/* =========================================================
   5. Nowa gra
   ========================================================= */
let ng = null;   // stan formularza: { count, names[], errors[], open }

function renderNew() {
  ng = { count: 4, names: [], errors: [], open: -1 };
  app.innerHTML = `<main class="screen">
    ${topbar('Nowa gra')}
    <section class="card counter" aria-label="Liczba graczy">
      <div class="counter-label"><b>Liczba graczy</b><span>od 2 do 99</span></div>
      <div class="stepper">
        <button class="step step-minus" id="dec" aria-label="Mniej graczy">${ICON.minus('#141829')}</button>
        <span class="count" id="count" aria-live="polite">${ng.count}</span>
        <button class="step step-plus" id="inc" aria-label="Więcej graczy">${ICON.plus('#FFFFFF')}</button>
      </div>
    </section>
    <div class="section-label" id="plabel">Gracze</div>
    <div class="plist" id="plist" role="list" aria-labelledby="plabel"></div>
    <footer class="footer">
      <p class="err-text" id="start-err" hidden></p>
      <button class="btn btn-primary" id="start" style="min-height:60px">Rozpocznij grę</button>
    </footer></main>`;
  $('#dec').addEventListener('click', () => setCount(ng.count - 1));
  $('#inc').addEventListener('click', () => setCount(ng.count + 1));
  $('#start').addEventListener('click', startGame);
  renderPlayerRows();

  const list = $('#plist');
  list.addEventListener('input', (e) => {
    if (!e.target.matches('input')) return;
    const i = +e.target.dataset.i;
    ng.names[i] = e.target.value;
    if (ng.errors[i]) { ng.errors[i] = ''; markError(i); }
    showMenu(i);
  });
  list.addEventListener('focusin', (e) => { if (e.target.matches('input')) showMenu(+e.target.dataset.i); });
  list.addEventListener('focusout', () => {
    setTimeout(() => { if (!list.contains(document.activeElement)) hideMenu(); }, 0);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideMenu(); return; }
    if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); hideMenu(); focusNext(+e.target.dataset.i); }
  });
  // pointerdown + preventDefault: kliknięcie w listę nie zabiera fokusu z pola
  list.addEventListener('pointerdown', (e) => { if (e.target.closest('.menu, .ptoggle')) e.preventDefault(); });
  list.addEventListener('click', (e) => {
    const tog = e.target.closest('.ptoggle');
    if (tog) {
      const i = +tog.dataset.i;
      if (ng.open === i) hideMenu();
      else { $(`input[data-i="${i}"]`).focus(); showMenu(i, true); }
      return;
    }
    const item = e.target.closest('.menu-item');
    if (!item) return;
    const i = +item.dataset.i;
    const val = item.dataset.add ? norm(ng.names[i] || '') : item.dataset.name;
    ng.names[i] = val;
    $(`input[data-i="${i}"]`).value = val;
    hideMenu();
    focusNext(i);
  });
}

function setCount(n) {
  n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
  if (n === ng.count) return;
  ng.count = n;
  $('#count').textContent = n;
  renderPlayerRows();
}

function renderPlayerRows() {
  ng.open = -1;
  let html = '';
  for (let i = 0; i < ng.count; i++) {
    const err = ng.errors[i] || '';
    html += `<div class="prow${err ? ' error' : ''}" role="listitem" data-row="${i}">
      <div class="pbox">
        <span class="pno" aria-hidden="true">${i + 1}</span>
        <input type="text" data-i="${i}" value="${esc(ng.names[i] || '')}" placeholder="Nazwa gracza" aria-label="Nazwa gracza ${i + 1}"
          autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="30" enterkeyhint="next" aria-expanded="false">
        <button class="ptoggle" data-i="${i}" tabindex="-1" aria-label="Pokaż graczy, którzy grali wcześniej">${ICON.chevron()}</button>
      </div>
      <p class="perr"${err ? '' : ' hidden'}>${esc(err)}</p>
      <div class="menu" hidden></div></div>`;
  }
  $('#plist').innerHTML = html;
  $('#dec').disabled = ng.count <= MIN_PLAYERS;
  $('#inc').disabled = ng.count >= MAX_PLAYERS;
}

function markError(i) {
  const row = $(`[data-row="${i}"]`);
  if (!row) return;
  const err = ng.errors[i] || '';
  row.classList.toggle('error', !!err);
  const p = row.querySelector('.perr');
  p.textContent = err; p.hidden = !err;
}

function focusNext(i) {
  for (let j = i + 1; j < ng.count; j++) {
    if (!norm(ng.names[j] || '')) { $(`input[data-i="${j}"]`).focus(); return; }
  }
  document.activeElement.blur();
}

function hideMenu() {
  if (ng.open < 0) return;
  const row = $(`[data-row="${ng.open}"]`);
  if (row) {
    row.classList.remove('open');
    row.querySelector('.menu').hidden = true;
    row.querySelector('input').setAttribute('aria-expanded', 'false');
  }
  ng.open = -1;
}

function showMenu(i, all = false) {
  const q = all ? '' : nkey(ng.names[i] || '');
  const used = new Set(Array.from({ length: ng.count }, (_, j) => (j === i ? '' : nkey(ng.names[j] || ''))).filter(Boolean));
  const cands = db.players
    .filter((p) => !used.has(nkey(p.name)) && (!q || nkey(p.name).includes(q)))
    .map((p) => ({ p, games: gamesCount(p.id), starts: q && nkey(p.name).startsWith(q) }))
    .sort((a, b) => (b.starts - a.starts) || (b.games - a.games) || a.p.name.localeCompare(b.p.name, 'pl'))
    .slice(0, 6);
  const typed = norm(ng.names[i] || '');
  const exact = db.players.some((p) => nkey(p.name) === nkey(typed));
  const canAdd = typed && !exact && !used.has(nkey(typed));

  let html = '';
  if (cands.length) {
    html += '<div class="menu-head">Grali wcześniej</div>';
    for (const c of cands) {
      let label = esc(c.p.name);
      if (q) {
        const at = nkey(c.p.name).indexOf(q);
        if (at >= 0) {
          const n = c.p.name;
          label = esc(n.slice(0, at)) + '<b>' + esc(n.slice(at, at + q.length)) + '</b>' + esc(n.slice(at + q.length));
        }
      }
      html += `<button class="menu-item" data-i="${i}" data-name="${esc(c.p.name)}"><span>${label}</span><span class="games">${gierLabel(c.games)}</span></button>`;
    }
  }
  if (canAdd) {
    html += `<button class="menu-item menu-add" data-i="${i}" data-add="1">${ICON.plus('#2F35C9', 18)} Dodaj jako nowego gracza</button>`;
  }

  if (ng.open !== i) hideMenu();
  const row = $(`[data-row="${i}"]`);
  const menu = row.querySelector('.menu');
  if (!html) { hideMenu(); return; }
  menu.innerHTML = html;
  menu.hidden = false;
  row.classList.add('open');
  row.querySelector('input').setAttribute('aria-expanded', 'true');
  ng.open = i;
  if (!cands.length) menu.style.borderTopWidth = '2px';
  requestAnimationFrame(() => menu.scrollIntoView({ block: 'nearest' }));
}

function startGame() {
  hideMenu();
  const names = Array.from({ length: ng.count }, (_, i) => norm(ng.names[i] || ''));
  const errors = [];
  const seen = new Map();
  names.forEach((n, i) => {
    if (!n) { errors[i] = 'Wpisz nazwę gracza'; return; }
    const k = nkey(n);
    if (seen.has(k)) { errors[i] = 'Ten gracz już jest w tej grze'; }
    else seen.set(k, i);
  });
  ng.errors = errors;
  for (let i = 0; i < ng.count; i++) markError(i);
  const bad = errors.filter(Boolean).length;
  const se = $('#start-err');
  if (bad) {
    se.textContent = bad === 1 ? 'Popraw 1 pole z nazwą gracza' : `Popraw pola z nazwami graczy (${bad})`;
    se.hidden = false;
    const first = errors.findIndex(Boolean);
    $(`[data-row="${first}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  se.hidden = true;
  const playerIds = names.map((n) => {
    let p = db.players.find((x) => nkey(x.name) === nkey(n));
    if (!p) { p = { id: uid(), name: n }; db.players.push(p); }
    return p.id;
  });
  const scores = {};
  playerIds.forEach((id) => { scores[id] = Array(15).fill(null); });
  db.games.push({ id: uid(), date: new Date().toISOString(), status: 'active', playerIds, scores });
  save();
  go('gra', true);
}

/* =========================================================
   6. Tabela gry
   ========================================================= */
function renderGame() {
  const g = activeGame();
  const wrapOld = $('.table-wrap');
  const scroll = wrapOld && $('#game-screen') ? { t: wrapOld.scrollTop, l: wrapOld.scrollLeft } : null;

  const ids = g.playerIds;
  const sc = ids.map((id) => score(g.scores[id]));
  const total = ids.length * 15;
  const filled = sc.reduce((a, s) => a + s.filled, 0);
  const minW = 64 + 92 * ids.length;

  const valueCell = (pi, f) => {
    const id = ids[pi], v = g.scores[id][f], name = playerName(id), fl = FIELDS[f];
    const where = f < 6 ? 'góra ' + fl : 'dół ' + fl;
    if (f >= 6 && !sc[pi].unlocked) {
      return `<button class="tcell locked" data-p="${pi}" data-f="${f}" aria-disabled="true" aria-label="${esc(name)}, ${where} – zablokowane">${ICON.lock}</button>`;
    }
    if (v === null) {
      return `<button class="tcell empty" data-p="${pi}" data-f="${f}" aria-label="${esc(name)}, ${where}: wpisz wynik">+</button>`;
    }
    return `<button class="tcell${v < 0 ? ' neg' : ''}" data-p="${pi}" data-f="${f}" aria-label="${esc(name)}, ${where}: ${v}">${fmt(v)}</button>`;
  };

  let rows = `<div class="trow thead"><div class="tlab" aria-hidden="true"></div>${ids.map((id) => `<div class="tname"><span>${esc(playerName(id))}</span></div>`).join('')}</div>`;
  for (let f = 0; f < 6; f++) rows += `<div class="trow"><div class="tlab">${FIELDS[f]}</div>${ids.map((_, pi) => valueCell(pi, f)).join('')}</div>`;
  rows += `<div class="trow sum"><div class="tlab">Suma z góry</div>${sc.map((s) => {
    const b = s.complete ? `<span class="bonus">${s.bonus > 0 ? 'bonus +50' : s.bonus < 0 ? 'bonus −50' : 'bez bonusu'}</span>` : '';
    return `<div class="tcell">${fmt(s.up)}${b}</div>`;
  }).join('')}</div>`;
  for (let f = 6; f < 15; f++) rows += `<div class="trow"><div class="tlab">${FIELDS[f]}</div>${ids.map((_, pi) => valueCell(pi, f)).join('')}</div>`;
  rows += `<div class="trow sum"><div class="tlab">Suma z dołu</div>${sc.map((s) => `<div class="tcell">${fmt(s.down)}</div>`).join('')}</div>`;
  rows += `<div class="trow total"><div class="tlab">Suma całk.</div>${sc.map((s) => `<div class="tcell">${fmt(s.all)}</div>`).join('')}</div>`;

  const anyLocked = sc.some((s) => !s.unlocked);
  app.innerHTML = `<main class="screen" id="game-screen">
    ${topbar('Gra w toku', `<span class="pill" aria-label="Wypełnione pola: ${filled} z ${total}">${filled} / ${total} pól</span>`, 'Wyjdź do ekranu głównego (gra zostanie zapisana)')}
    <div class="table-wrap"><div class="grid" style="min-width:${minW}px">${rows}</div></div>
    <footer class="footer">
      ${anyLocked ? '<p class="note">Dół odblokowuje się po trzech wynikach z góry u danego gracza</p>' : ''}
      <button class="btn btn-primary" id="finish" ${filled === total ? '' : 'disabled'}>Zakończ grę</button>
    </footer></main>`;

  const wrap = $('.table-wrap');
  if (scroll) { wrap.scrollTop = scroll.t; wrap.scrollLeft = scroll.l; }
  wrap.addEventListener('click', (e) => {
    const c = e.target.closest('.tcell[data-f]');
    if (!c) return;
    if (c.classList.contains('locked')) { toast('Dół odblokuje się po trzech wynikach z góry'); return; }
    openSheet(+c.dataset.p, +c.dataset.f);
  });
  $('#finish').addEventListener('click', async () => {
    if (gameFilled(g) !== total) return;
    const ok = await confirmDialog({
      title: 'Zakończyć grę?',
      text: 'Po zakończeniu gry wyników nie będzie można już poprawić.',
      ok: 'Zakończ grę'
    });
    if (!ok) return;
    g.status = 'finished';
    g.finishedAt = new Date().toISOString();
    save();
    go('wyniki/' + g.id, true);
  });
}

/* =========================================================
   7. Wpis wyniku (dolny panel)
   ========================================================= */
let sheet = null;   // { el, pi, f, str, fresh, onKey }

function openSheet(pi, f) {
  closeSheet();
  const g = activeGame();
  const pid = g.playerIds[pi];
  const cur = g.scores[pid][f];
  const isTop = f < 6, fl = FIELDS[f];
  const title = isTop ? `Pole ${fl}` : `${LOW_NAMES[fl]} (${fl})`;
  const el = document.createElement('div');
  el.className = 'backdrop';
  const digit = (d) => `<button class="key" data-k="${d}">${d}</button>`;
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <div class="grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <div><div class="who">${esc(playerName(pid))} · ${isTop ? 'góra' : 'dół'}</div><h2 id="sh-t" tabindex="-1">${title}</h2></div>
      <button class="icon-btn sheet-close" data-act="close" aria-label="Zamknij bez zapisywania">${ICON.close}</button>
    </div>
    <div class="display" id="disp" aria-live="polite"></div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit).join('')}
      <button class="key key-alt" data-k="-" aria-label="Zmień znak (minus)" ${isTop ? '' : 'disabled title="Na dole wyniki nie mogą być ujemne"'}>−</button>
      ${digit(0)}
      <button class="key key-alt" data-k="del" aria-label="Usuń ostatnią cyfrę">${ICON.backspace}</button>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-outline btn-zero" data-act="zero">Nie zrobiono<br>(wpisz 0)</button>
      <button class="btn btn-primary" data-act="save" id="sh-save">Zapisz</button>
    </div></div>`;
  document.body.appendChild(el);
  sheet = { el, pi, f, isTop, str: cur === null ? '' : String(cur), fresh: cur !== null };
  updateDisplay();

  el.addEventListener('click', (e) => {
    if (e.target === el) return closeSheet();
    const k = e.target.closest('[data-k]');
    if (k && !k.disabled) return press(k.dataset.k);
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    if (a.dataset.act === 'close') closeSheet();
    if (a.dataset.act === 'zero') commit(0);
    if (a.dataset.act === 'save') commit(Number(sheet.str));
  });
  sheet.onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
    else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === '-' && sheet.isTop) { e.preventDefault(); press('-'); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
    else if (e.key === 'Enter' && validStr(sheet.str) && !e.target.closest('button')) { e.preventDefault(); commit(Number(sheet.str)); }
  };
  document.addEventListener('keydown', sheet.onKey);
  $('#sh-t').focus();
}

const validStr = (s) => /^-?\d+$/.test(s);

function press(k) {
  let s = sheet.fresh && k !== '-' ? '' : sheet.str;   // edycja wpisanego pola: pierwsza cyfra zastępuje wartość
  sheet.fresh = false;
  const neg = s.startsWith('-');
  let digits = neg ? s.slice(1) : s;
  if (k === '-') { s = neg ? digits : '-' + digits; }
  else if (k === 'del') { s = s.slice(0, -1); }
  else {
    if (digits === '0') digits = '';
    if (digits.length >= MAX_DIGITS) return;
    s = (neg ? '-' : '') + digits + k;
  }
  sheet.str = s;
  updateDisplay();
}

function updateDisplay() {
  const d = $('#disp');
  const s = sheet.str;
  const neg = s.startsWith('-');
  const txt = s ? (neg ? '−' + s.slice(1) : s) : '';
  d.classList.toggle('neg', neg && s.length > 1);
  d.innerHTML = (txt ? `<span>${txt}</span>` : '<span class="placeholder">0</span>') + '<span class="caret" aria-hidden="true"></span>';
  $('#sh-save').disabled = !validStr(s);
}

function commit(v) {
  const g = activeGame();
  g.scores[g.playerIds[sheet.pi]][sheet.f] = v === 0 ? 0 : v;   // bez „−0”
  save();
  closeSheet();
  renderGame();
}

function closeSheet() {
  if (!sheet) return;
  document.removeEventListener('keydown', sheet.onKey);
  sheet.el.remove();
  const { pi, f } = sheet;
  sheet = null;
  const cell = $(`.tcell[data-p="${pi}"][data-f="${f}"]`);
  if (cell) cell.focus({ preventScroll: true });
}

/* =========================================================
   8. Wyniki zakończonej gry
   ========================================================= */
function renderResults(id) {
  const g = db.games.find((x) => x.id === id && x.status === 'finished');
  if (!g) return go('', true);
  const list = g.playerIds.map((pid) => ({ pid, s: score(g.scores[pid]) })).sort((a, b) => b.s.all - a.s.all);
  list.forEach((r) => { r.place = 1 + list.filter((o) => o.s.all > r.s.all).length; });
  const winners = list.filter((r) => r.place === 1).length;
  const date = new Date(g.finishedAt || g.date).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const cards = list.map((r) => {
    const b = r.s.bonus > 0 ? ' (bonus +50)' : r.s.bonus < 0 ? ' (bonus −50)' : '';
    return `<div class="card rank${r.place === 1 ? ' first' : ''}" role="listitem">
      <span class="place" aria-label="Miejsce ${r.place}">${r.place}</span>
      <div class="rank-mid">
        ${r.place === 1 ? `<span class="winner">${winners > 1 ? 'Remis – zwycięzca' : 'Zwycięzca'}</span>` : ''}
        <span class="rank-name">${esc(playerName(r.pid))}</span>
        <span class="rank-detail">góra ${fmt(r.s.up)}${b} · dół ${fmt(r.s.down)}</span>
      </div>
      <span class="rank-total" aria-label="Suma ${r.s.all} punktów">${fmt(r.s.all)}</span></div>`;
  }).join('');

  app.innerHTML = `<main class="screen">
    ${topbar('Wyniki gry')}
    <div class="scroll"><p class="date">Gra zakończona ${esc(date)}</p><div role="list" style="display:flex;flex-direction:column;gap:10px">${cards}</div></div>
    <footer class="footer"><a class="btn btn-primary" href="#/">Ekran główny</a></footer></main>`;
}

/* =========================================================
   9. Statystyki (tylko zakończone gry)
   ========================================================= */
let statsPid = null;

function renderStats() {
  const players = db.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if (!players.length) {
    app.innerHTML = `<main class="screen">${topbar('Statystyki')}
      <div class="scroll"><p class="empty-state">Nie ma jeszcze żadnych graczy.<br>Rozegraj pierwszą grę, aby zobaczyć statystyki.</p></div></main>`;
    return;
  }
  if (!players.some((p) => p.id === statsPid)) statsPid = players[0].id;
  app.innerHTML = `<main class="screen stats">
    ${topbar('Statystyki')}
    <div class="scroll" style="gap:16px">
      <div><label for="gracz" class="field-label">Gracz</label>
        <div class="select-wrap"><select id="gracz">${players.map((p) => `<option value="${p.id}"${p.id === statsPid ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${ICON.chevron('#141829', 22)}</div>
      </div>
      <div id="stats-body"></div>
    </div></main>`;
  $('#gracz').addEventListener('change', (e) => { statsPid = e.target.value; renderStatsBody(); });
  renderStatsBody();
}

function renderStatsBody() {
  const games = finishedGames().filter((g) => g.playerIds.includes(statsPid));
  const n = games.length;
  const body = $('#stats-body');
  if (!n) {
    body.innerHTML = `<div class="tiles"><div class="tile wide tile-games"><span class="tile-label">Ilość gier</span><span class="tile-val">0</span></div></div>
      <p class="empty-state">Ten gracz nie ma jeszcze zakończonych gier.<br>Statystyki liczone są tylko z zakończonych gier.</p>`;
    return;
  }
  const scores = games.map((g) => g.scores[statsPid]);
  const ss = scores.map(score);
  const avg = (arr) => arr.reduce((a, v) => a + v, 0) / arr.length;
  const avgUp = avg(ss.map((s) => s.up)), avgDown = avg(ss.map((s) => s.down)), avgAll = avg(ss.map((s) => s.all));

  const rows = FIELDS.map((fl, f) => {
    const vals = scores.map((v) => v[f]).filter((v) => v !== null);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    return `<div class="srow${f >= 6 ? ' low' : ''}"><span>${fl}</span>
      <span class="${mn < 0 ? 'neg' : ''}">${fmt(mn)}</span><span class="${mx < 0 ? 'neg' : ''}">${fmt(mx)}</span><span class="avg">${fmtAvg(avg(vals))}</span></div>`;
  }).join('');

  body.innerHTML = `<div class="tiles">
      <div class="tile wide tile-games"><span class="tile-label">Ilość gier</span><span class="tile-val">${n}</span></div>
      <div class="tile tile-plain"><span class="tile-label">Średnia z góry</span><span class="tile-val">${fmtAvg(avgUp)}</span></div>
      <div class="tile tile-plain"><span class="tile-label">Średnia z dołu</span><span class="tile-val">${fmtAvg(avgDown)}</span></div>
      <div class="tile wide tile-avg"><span class="tile-label">Średnia punktów z gry</span><span class="tile-val">${fmtAvg(avgAll)}</span></div>
    </div>
    <h2 style="margin-top:16px;margin-bottom:8px">Wyniki wg kombinacji</h2>
    <div class="card stable" role="table" aria-label="Wyniki wg kombinacji">
      <div class="srow head"><span>Pole</span><span>Min</span><span>Max</span><span>Śr.</span></div>${rows}
    </div>`;
}

/* =========================================================
   10. Start
   ========================================================= */
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Poproś przeglądarkę, żeby nie usuwała danych aplikacji przy braku miejsca
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
