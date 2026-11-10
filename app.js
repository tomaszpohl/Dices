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
const APP_VERSION = '1.3.1';
const BACKUP_APP = 'kosci', BACKUP_FORMAT = 1;

/* Struktura danych w localStorage:
   { players: [{ id, name }],
     games:   [{ id, date, finishedAt?, status: 'active' | 'finished', playerIds: [], scores: { [playerId]: [15 × liczba|null] } }],
     lastBackup: data ISO ostatniego zapisu kopii do pliku | null }
   Porzucona gra jest usuwana – nie trafia do statystyk. */
let db = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.players) && Array.isArray(d.games)) {
      if (!('lastBackup' in d)) d.lastBackup = null;
      return d;
    }
  } catch (e) { /* uszkodzone dane – zaczynamy od zera */ }
  return { players: [], games: [], lastBackup: null };
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

/* Daty po polsku */
const fmtDate = (iso) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateTime = (iso) => fmtDate(iso) + ', ' + new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/* Podświetlenie dopasowanego fragmentu nazwy (q = tekst już znormalizowany, małe litery) */
function highlight(name, q, cls = '') {
  if (!q) return esc(name);
  const at = nkey(name).indexOf(q);
  if (at < 0) return esc(name);
  return esc(name.slice(0, at)) + `<b${cls ? ` class="${cls}"` : ''}>` + esc(name.slice(at, at + q.length)) + '</b>' + esc(name.slice(at + q.length));
}

/* Ikony */
const ICON = {
  back: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  arrow: (c) => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  stats: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  history: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  gear: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5A6075" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  clear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  alert: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C1D18" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  chipX: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  lockInfo:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F35C9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  download: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  upload: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
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
                        #/historia  #/podglad/<id>  #/ustawienia
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
    case 'statystyki': return renderStats(arg);
    case 'historia': return renderHistory();
    case 'podglad': return renderPreview(arg);
    case 'ustawienia': return renderSettings();
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
    const filled = gameFilled(g), total = g.playerIds.length * 15;
    const pct = Math.round((filled / total) * 100);
    cont = `<a class="continue" href="#/gra" aria-label="Kontynuuj grę: ${filled} z ${total} pól, gracze: ${esc(names)}">
      <span class="continue-top"><span class="continue-title">Kontynuuj grę</span><span class="continue-count">${filled} / ${total} pól</span></span>
      <span class="progress" aria-hidden="true"><span style="width:${pct}%"></span></span>
      <span class="continue-names">${esc(names)}</span></a>`;
  }
  app.innerHTML = `<main class="screen home">
    <div class="home-blob" aria-hidden="true"></div>
    <a class="gear" href="#/ustawienia" aria-label="Ustawienia">${ICON.gear}</a>
    <div class="home-title"><span class="eyebrow">Zapis wyników</span><h1>Kości</h1></div>
    <div class="home-art">${ICON.dice}</div>
    <nav class="home-actions">
      ${cont}
      <button class="btn btn-big btn-primary" id="btn-new"><span>Nowa gra</span>${ICON.arrow('#FFFFFF')}</button>
      <a class="btn btn-big btn-outline" href="#/statystyki"><span>Statystyki</span>${ICON.stats}</a>
      <a class="btn btn-big btn-outline" href="#/historia"><span>Historia gier</span>${ICON.history}</a>
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
  ng = { count: 2, names: [], errors: [], open: -1 };
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
    <div class="err-banner" id="start-err" role="alert" hidden>${ICON.alert}<span></span></div>
    <div class="section-label" id="plabel">Gracze</div>
    <div class="plist" id="plist" role="list" aria-labelledby="plabel"></div>
    <footer class="footer">
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
    if (ng.errors[i]) {
      ng.errors[i] = ''; markError(i);
      if (!ng.errors.some(Boolean)) $('#start-err').hidden = true;
    }
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
    se.querySelector('span').textContent = bad === 1 ? 'Popraw nazwę gracza, aby rozpocząć grę' : 'Popraw nazwy graczy, aby rozpocząć grę';
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
/* Wiersze tabeli – wspólne dla gry i podglądu.
   readonly = podgląd zakończonej gry (pola nie są dotykowe, zwycięzca na żółto). */
function tableParts(g, readonly = false) {
  const ids = g.playerIds;
  const sc = ids.map((id) => score(g.scores[id]));

  const valueCell = (pi, f) => {
    const id = ids[pi], v = g.scores[id][f], name = playerName(id), fl = FIELDS[f];
    const where = f < 6 ? 'góra ' + fl : 'dół ' + fl;
    if (readonly) {
      return `<div class="tcell ro${v !== null && v < 0 ? ' neg' : ''}">${v === null ? '' : fmt(v)}</div>`;
    }
    if (v === null) {
      return `<button class="tcell empty" data-p="${pi}" data-f="${f}" aria-label="${esc(name)}, ${where}: niewpisany, wpisz wynik">+</button>`;
    }
    return `<button class="tcell${v < 0 ? ' neg' : ''}" data-p="${pi}" data-f="${f}" aria-label="${esc(name)}, ${where}: ${v}, zmień lub usuń">${fmt(v)}</button>`;
  };

  // W podglądzie zakończonej gry wyróżniamy gracza(y) z najwyższym wynikiem
  const best = readonly ? Math.max(...sc.map((s) => s.all)) : null;
  const isTop = (pi) => readonly && sc[pi].all === best;
  const row = (f) => `<div class="trow"><div class="tlab">${FIELDS[f]}</div>${ids.map((_, pi) => valueCell(pi, f)).join('')}</div>`;

  return {
    sc,
    minW: 64 + 92 * ids.length,
    head: `<div class="trow thead"><div class="tlab" aria-hidden="true"></div>${ids.map((id, pi) => `<div class="tname${isTop(pi) ? ' top' : ''}"><span>${esc(playerName(id))}</span>${isTop(pi) ? '<span class="sr-only"> – najwyższy wynik</span>' : ''}</div>`).join('')}</div>`,
    topRows: [0, 1, 2, 3, 4, 5].map(row).join(''),
    topSum: `<div class="trow sum"><div class="tlab">Suma z góry</div>${sc.map((s) => {
      const b = s.complete ? `<span class="bonus">${s.bonus > 0 ? 'bonus +50' : s.bonus < 0 ? 'bonus −50' : 'bez bonusu'}</span>` : '';
      return `<div class="tcell">${fmt(s.up)}${b}</div>`;
    }).join('')}</div>`,
    lowRows: [6, 7, 8, 9, 10, 11, 12, 13, 14].map(row).join(''),
    lowSum: `<div class="trow sum"><div class="tlab">Suma z dołu</div>${sc.map((s) => `<div class="tcell">${fmt(s.down)}</div>`).join('')}</div>`,
    total: `<div class="trow total"><div class="tlab">Suma całk.</div>${sc.map((s, pi) => `<div class="tcell${isTop(pi) ? ' top' : ''}">${fmt(s.all)}</div>`).join('')}</div>`
  };
}

/* Pełna tabela tylko do podglądu (historia) */
function buildTable(g) {
  const t = tableParts(g, true);
  return { html: `<div class="table-wrap"><div class="grid" style="min-width:${t.minW}px">${t.head}${t.topRows}${t.topSum}${t.lowRows}${t.lowSum}${t.total}</div></div>`, sc: t.sc };
}

/* Stan sekcji tabeli gry, zapisywany w grze:
   topOpen – góra rozwinięta; bottomUnlocked – dół odblokowany (zostaje odblokowany na stałe);
   bottomOpen – dół rozwinięty. */
function gameUi(g) {
  if (!g.ui) {
    // gra zaczęta w starszej wersji (lub nowa): stan sekcji wynika z wpisanych wyników
    const unlocked = g.playerIds.every((pid) => topCount(g, pid) >= 3);
    g.ui = { topOpen: !allTopFilled(g), bottomUnlocked: unlocked, bottomOpen: unlocked };
  }
  return g.ui;
}
const topCount = (g, pid) => g.scores[pid].slice(0, 6).filter((v) => v !== null).length;
const allTopFilled = (g) => g.playerIds.every((pid) => topCount(g, pid) === 6);

/* Automatyczne zmiany sekcji po zapisaniu / usunięciu wyniku */
function updateSections(g, wasTopFull) {
  const ui = gameUi(g);
  // Dół: odblokowuje się i rozwija sam, gdy każdy gracz ma ≥ 3 wyniki z góry; potem zostaje odblokowany
  if (!ui.bottomUnlocked && g.playerIds.every((pid) => topCount(g, pid) >= 3)) {
    ui.bottomUnlocked = true;
    ui.bottomOpen = true;
  }
  // Góra: zwija się sama w chwili wypełnienia ostatniego pola góry (po usunięciu wyniku zostaje, jak jest)
  if (!wasTopFull && allTopFilled(g)) ui.topOpen = false;
}

const CHEV_DOWN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const CHEV_RIGHT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141829" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const LOCK_BAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3A4056" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

function renderGame() {
  const g = activeGame();
  const ui = gameUi(g);
  const wrapOld = $('.table-wrap');
  const scroll = wrapOld && $('#game-screen') ? { t: wrapOld.scrollTop, l: wrapOld.scrollLeft } : null;
  const total = g.playerIds.length * 15;
  const t = tableParts(g);
  const filled = t.sc.reduce((a, s) => a + s.filled, 0);

  const topHint = !ui.topOpen && allTopFilled(g) ? '<span class="sec-hint">Wszystko wpisane</span>' : '';
  const topBar = `<div class="sec"><button class="sec-bar" id="sec-top" aria-expanded="${ui.topOpen}">
      <span class="sec-inner">${ui.topOpen ? CHEV_DOWN : CHEV_RIGHT}<span class="sec-title">Góra</span>${topHint}</span></button></div>`;
  let lowBar;
  if (ui.bottomUnlocked) {
    lowBar = `<div class="sec"><button class="sec-bar" id="sec-low" aria-expanded="${ui.bottomOpen}">
      <span class="sec-inner">${ui.bottomOpen ? CHEV_DOWN : CHEV_RIGHT}<span class="sec-title">Dół</span></span></button></div>`;
  } else {
    const missing = g.playerIds.filter((pid) => topCount(g, pid) < 3).map(playerName).join(', ');
    lowBar = `<div class="sec"><div class="sec-bar locked"><span class="sec-inner">${LOCK_BAR}
      <span class="sec-col"><span class="sec-title">Dół</span><span class="sec-note">Rozwinie się, gdy każdy gracz ma 3 wyniki z góry (brakuje: ${esc(missing)})</span></span></span></div></div>`;
  }

  const rows = t.head + topBar + (ui.topOpen ? t.topRows : '') + t.topSum +
    lowBar + (ui.bottomUnlocked && ui.bottomOpen ? t.lowRows : '') + t.lowSum + t.total;

  app.innerHTML = `<main class="screen" id="game-screen">
    ${topbar('Gra w toku', `<span class="pill" aria-label="Wypełnione pola: ${filled} z ${total}">${filled} / ${total} pól</span>`, 'Wyjdź do ekranu głównego (gra zostanie zapisana)')}
    <div class="table-wrap"><div class="grid" style="min-width:${t.minW}px">${rows}</div></div>
    <footer class="footer">
      <p class="note">Dotknij pola, aby wpisać, zmienić lub usunąć wynik</p>
      <button class="btn btn-primary" id="finish" ${filled === total ? '' : 'disabled'}>Zakończ grę</button>
    </footer></main>`;

  const wrap = $('.table-wrap');
  setSectionWidth();
  if (scroll) { wrap.scrollTop = scroll.t; wrap.scrollLeft = scroll.l; }
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('#sec-top')) { ui.topOpen = !ui.topOpen; save(); renderGame(); $('#sec-top').focus(); return; }
    if (e.target.closest('#sec-low')) { ui.bottomOpen = !ui.bottomOpen; save(); renderGame(); $('#sec-low').focus(); return; }
    const c = e.target.closest('.tcell[data-f]');
    if (c) openSheet(+c.dataset.p, +c.dataset.f);
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
    delete g.ui;
    save();
    go('wyniki/' + g.id, true);
  });
}

/* Paski sekcji mają szerokość widocznej części tabeli (przy przewijaniu w bok zostają na miejscu) */
function setSectionWidth() {
  const wrap = $('#game-screen .table-wrap');
  if (wrap) wrap.style.setProperty('--vw', wrap.clientWidth + 'px');
}
window.addEventListener('resize', setSectionWidth);

/* =========================================================
   7. Wpis, zmiana i usunięcie wyniku (dolny panel)
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
      <div><div class="who">${esc(playerName(pid))} · ${isTop ? 'góra' : 'dół'}${cur !== null ? ' · edycja wyniku' : ''}</div><h2 id="sh-t" tabindex="-1">${title}</h2></div>
      <button class="icon-btn sheet-close" data-act="close" aria-label="Zamknij bez zapisywania">${ICON.close}</button>
    </div>
    <div class="display" id="disp" aria-live="polite"></div>
    ${isTop ? '' : '<p class="sheet-hint">Na dole nie wpisuje się wartości ujemnych</p>'}
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit).join('')}
      ${isTop ? '<button class="key key-alt" data-k="-" aria-label="Zmień znak (minus)">−</button>'
              : '<button class="key key-off" data-k="-" aria-label="Minus niedostępny na dole" disabled>−</button>'}
      ${digit(0)}
      <button class="key key-alt" data-k="del" aria-label="Usuń ostatnią cyfrę">${ICON.backspace}</button>
    </div>
    <button class="btn btn-delete" data-act="remove" ${cur === null ? 'disabled' : ''}>${ICON.trash} Usuń wynik</button>
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
    if (a.dataset.act === 'remove') commit(null);
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

/* v = liczba (zapis) albo null (usunięcie wyniku) */
function commit(v) {
  const g = activeGame();
  const wasTopFull = allTopFilled(g);
  g.scores[g.playerIds[sheet.pi]][sheet.f] = v === null ? null : (v === 0 ? 0 : v);   // bez „−0”
  updateSections(g, wasTopFull);
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
  const hasTie = new Set(list.map((r) => r.place)).size < list.length;

  const cards = list.map((r) => {
    const b = r.s.bonus > 0 ? ' (bonus +50)' : r.s.bonus < 0 ? ' (bonus −50)' : '';
    return `<div class="rank${r.place === 1 ? ' first' : ''}" role="listitem">
      <span class="place" aria-label="Miejsce ${r.place}">${r.place}</span>
      <div class="rank-mid">
        ${r.place === 1 ? `<span class="winner">${winners > 1 ? 'Zwycięzca (remis)' : 'Zwycięzca'}</span>` : ''}
        <span class="rank-name">${esc(playerName(r.pid))}</span>
        <span class="rank-detail">Góra ${fmt(r.s.up)}${b} · Dół ${fmt(r.s.down)}</span>
      </div>
      <span class="rank-total" aria-label="Suma ${r.s.all} punktów">${fmt(r.s.all)}</span></div>`;
  }).join('');

  app.innerHTML = `<main class="screen">
    <header class="results-head"><h1>Wyniki gry</h1><span>Zakończona ${esc(fmtDate(g.finishedAt || g.date))}</span></header>
    <div class="scroll" style="padding-top:8px">
      <h2 class="field-label" style="margin:0">Ranking</h2>
      <div role="list" class="rank-list">${cards}</div>
      ${hasTie ? '<p class="date">Remis: gracze z tym samym wynikiem dzielą miejsce.</p>' : ''}
    </div>
    <footer class="footer"><a class="btn btn-primary" href="#/">Ekran główny</a></footer></main>`;
}

/* =========================================================
   9. Statystyki (tylko zakończone gry): zakładki Gracz / Porównanie
   ========================================================= */
let statsPid = null;
let compSel = new Set();   // gracze zaznaczeni w porównaniu (do zamknięcia aplikacji)

const zwyciestwLabel = (n) => {
  if (n === 1) return 'zwycięstwo';
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'zwycięstwa' : 'zwycięstw';
};

function statsTabs(active) {
  return `<nav class="tabs" aria-label="Rodzaj statystyk">
    <a href="#/statystyki" class="tab${active === 'gracz' ? ' on' : ''}"${active === 'gracz' ? ' aria-current="page"' : ''}>Gracz</a>
    <a href="#/statystyki/porownanie" class="tab${active === 'por' ? ' on' : ''}"${active === 'por' ? ' aria-current="page"' : ''}>Porównanie</a>
  </nav>`;
}

function renderStats(tab) {
  const players = db.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if (!players.length) {
    app.innerHTML = `<main class="screen">${topbar('Statystyki')}
      <div class="scroll"><p class="empty-state">Nie ma jeszcze żadnych graczy.<br>Rozegraj pierwszą grę, aby zobaczyć statystyki.</p></div></main>`;
    return;
  }
  if (tab === 'porownanie') return renderCompare(players);
  if (!players.some((p) => p.id === statsPid)) statsPid = players[0].id;
  app.innerHTML = `<main class="screen stats">
    ${topbar('Statystyki')}
    ${statsTabs('gracz')}
    <div class="scroll" style="gap:16px">
      <div><label for="gracz" class="field-label">Gracz</label>
        <div class="select-wrap"><select id="gracz">${players.map((p) => `<option value="${p.id}"${p.id === statsPid ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${ICON.chevron('#141829', 22)}</div>
        <p class="hint">Liczone tylko z zakończonych gier</p>
      </div>
      <div id="stats-body"></div>
    </div></main>`;
  $('#gracz').addEventListener('change', (e) => { statsPid = e.target.value; renderStatsBody(); });
  renderStatsBody();
}

/* Porównanie zwycięstw: tylko gry rozegrane dokładnie w wybranym składzie */
function renderCompare(players) {
  compSel = new Set([...compSel].filter((id) => playerById(id)));
  app.innerHTML = `<main class="screen stats">
    ${topbar('Statystyki')}
    ${statsTabs('por')}
    <div class="scroll" style="gap:16px">
      <div class="comp-pick">
        <h2 class="field-label">Skład graczy</h2>
        <div class="chips" id="comp-chips">${players.map((p) => {
          const on = compSel.has(p.id);
          return `<button class="chip${on ? ' on' : ''}" data-id="${p.id}" aria-pressed="${on}">${on ? ICON.check : ''}<span>${esc(p.name)}</span></button>`;
        }).join('')}</div>
        <p class="hint" style="margin:0">Liczone z zakończonych gier rozegranych dokładnie w tym składzie.</p>
      </div>
      <div id="comp-body" aria-live="polite"></div>
    </div></main>`;
  $('#comp-chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const id = b.dataset.id;
    if (compSel.has(id)) compSel.delete(id); else compSel.add(id);
    const on = compSel.has(id);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    b.innerHTML = (on ? ICON.check : '') + `<span>${esc(playerName(id))}</span>`;
    renderCompareBody(players);
  });
  renderCompareBody(players);
}

function renderCompareBody(players) {
  const body = $('#comp-body');
  const sel = players.filter((p) => compSel.has(p.id)).map((p) => p.id);
  if (sel.length < 2) {
    body.innerHTML = '<div class="msg-card">Wybierz co najmniej 2 graczy, aby porównać zwycięstwa.</div>';
    return;
  }
  const games = finishedGames().filter((g) => g.playerIds.length === sel.length && sel.every((id) => g.playerIds.includes(id)));
  if (!games.length) {
    body.innerHTML = '<div class="msg-card">Brak zakończonych gier w tym składzie.</div>';
    return;
  }
  const wins = Object.fromEntries(sel.map((id) => [id, 0]));
  let ties = 0;
  for (const g of games) {
    const totals = sel.map((id) => score(g.scores[id]).all);
    const max = Math.max(...totals);
    const top = sel.filter((id, i) => totals[i] === max);
    if (top.length === 1) wins[top[0]] += 1; else ties += 1;   // remis na 1. miejscu nie jest zwycięstwem
  }
  const best = Math.max(...sel.map((id) => wins[id]));
  const total = games.length;
  const cards = sel.map((id) => {
    const leader = best > 0 && wins[id] === best;
    const pct = Math.round((wins[id] / total) * 100);
    return `<div class="win-card${leader ? ' leader' : ''}">
      <div class="win-top">
        <div class="win-name"><span>${esc(playerName(id))}</span>${leader ? '<span class="winner">Najwięcej zwycięstw</span>' : ''}</div>
        <div class="win-num"><b>${wins[id]}</b><span>${zwyciestwLabel(wins[id])}</span></div>
      </div>
      <div class="win-bar" role="img" aria-label="${pct}% gier w tym składzie"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
  body.innerHTML = `<div class="comp-total">
      <div><span class="ct-label">Gier w tym składzie</span><span class="ct-sub">Remisy: ${ties} (nie liczą się jako zwycięstwo)</span></div>
      <span class="ct-val">${total}</span>
    </div>
    <h2 class="field-label" style="margin:16px 0 10px">Ilość zwycięstw</h2>
    <div class="win-list">${cards}</div>`;
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
   10. Historia gier (tylko zakończone, od najnowszej)
   Filtr: wybrani gracze („pigułki”); pokazuje gry, w których grali wszyscy wybrani.
   ========================================================= */
let histChips = [];   // id graczy w filtrze (zapamiętane do zamknięcia aplikacji)

function renderHistory() {
  histChips = histChips.filter((id) => playerById(id));
  app.innerHTML = `<main class="screen">
    ${topbar('Historia gier')}
    <div class="search-box">
      <label for="szukaj" class="field-label">Szukaj gracza</label>
      <div class="search-wrap">
        <div class="search chipbox" id="chipbox">
          <span id="hist-chips" class="chip-list"></span>
          <input id="szukaj" type="text" autocomplete="off" spellcheck="false" enterkeyhint="search"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="hist-sugg">
        </div>
        <div class="menu sugg" id="hist-sugg" role="listbox" hidden></div>
      </div>
      <p class="hint" id="hist-count" aria-live="polite"></p>
      <p class="hint" id="hist-legend" hidden>Żółte tło – gracz z najwyższym wynikiem w grze</p>
    </div>
    <div class="scroll hist-list" id="hist-list"></div></main>`;
  const inp = $('#szukaj');
  inp.addEventListener('input', renderSuggestions);
  inp.addEventListener('focus', renderSuggestions);
  inp.addEventListener('blur', () => setTimeout(() => {
    if (!$('.search-wrap')?.contains(document.activeElement)) hideSuggestions();
  }, 0));
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideSuggestions(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = $('#hist-sugg .menu-item');
      if (first && !$('#hist-sugg').hidden) addHistChip(first.dataset.id);
      return;
    }
    if (e.key === 'Backspace' && !inp.value && histChips.length) {
      histChips.pop(); renderChips(); renderHistoryList();
    }
  });
  $('#chipbox').addEventListener('click', (e) => {
    const x = e.target.closest('.chip-x');
    if (x) {
      histChips = histChips.filter((id) => id !== x.dataset.id);
      renderChips(); renderHistoryList(); inp.focus();
      return;
    }
    if (e.target === e.currentTarget) inp.focus();
  });
  const sugg = $('#hist-sugg');
  sugg.addEventListener('pointerdown', (e) => e.preventDefault());   // nie zabiera fokusu z pola
  sugg.addEventListener('click', (e) => {
    const b = e.target.closest('.menu-item');
    if (b) addHistChip(b.dataset.id);
  });
  renderChips();
  renderHistoryList();
}

function renderChips() {
  $('#hist-chips').innerHTML = histChips.map((id) => {
    const n = esc(playerName(id));
    return `<span class="fchip">${n}<button class="chip-x" data-id="${id}" aria-label="Usuń gracza ${n} z filtra">${ICON.chipX}</button></span>`;
  }).join('');
  $('#szukaj').placeholder = histChips.length ? 'Dodaj kolejnego gracza' : 'Wpisz nazwę gracza';
  $('#szukaj').setAttribute('aria-label', histChips.length ? 'Dodaj kolejnego gracza do filtra' : 'Szukaj gracza');
}

function addHistChip(id) {
  if (!histChips.includes(id)) histChips.push(id);
  const inp = $('#szukaj');
  inp.value = '';
  hideSuggestions();
  renderChips();
  renderHistoryList();
  inp.focus();
}

function hideSuggestions() {
  const s = $('#hist-sugg');
  if (!s) return;
  s.hidden = true;
  $('#szukaj').setAttribute('aria-expanded', 'false');
}

function renderSuggestions() {
  const inp = $('#szukaj');
  const q = nkey(inp.value);
  const s = $('#hist-sugg');
  if (!q) { hideSuggestions(); return; }
  const cands = db.players
    .filter((p) => !histChips.includes(p.id) && nkey(p.name).includes(q))
    .map((p) => ({ p, games: gamesCount(p.id), starts: nkey(p.name).startsWith(q) }))
    .sort((a, b) => (b.starts - a.starts) || (b.games - a.games) || a.p.name.localeCompare(b.p.name, 'pl'))
    .slice(0, 6);
  if (!cands.length) {
    s.innerHTML = '<div class="menu-head">Brak pasujących graczy</div>';
  } else {
    s.innerHTML = '<div class="menu-head">Dodaj do filtra</div>' + cands.map((c) =>
      `<button class="menu-item" role="option" data-id="${c.p.id}"><span>${highlight(c.p.name, q)}</span><span class="games">${gierLabel(c.games)}</span></button>`).join('');
  }
  s.hidden = false;
  inp.setAttribute('aria-expanded', 'true');
}

function renderHistoryList() {
  const all = finishedGames().slice().sort((a, b) => (b.finishedAt || b.date).localeCompare(a.finishedAt || a.date));
  const games = all.filter((g) => histChips.every((id) => g.playerIds.includes(id)));
  const count = $('#hist-count');
  const list = $('#hist-list');

  if (!all.length) {
    count.textContent = '';
    $('#hist-legend').hidden = true;
    list.innerHTML = '<p class="empty-state">Nie ma jeszcze zakończonych gier.<br>Zakończone gry pojawią się tutaj.</p>';
    return;
  }
  count.textContent = histChips.length
    ? `Gry, w których grali: ${histChips.map(playerName).join(', ')} · ${gierLabel(games.length)}`
    : `Wszystkie gry · ${gierLabel(games.length)}`;
  $('#hist-legend').hidden = !games.length;
  if (!games.length) {
    list.innerHTML = '<div class="msg-card">Brak gier, w których grali wszyscy wybrani gracze.</div>';
    return;
  }
  list.innerHTML = winsCard(games) + games.map((g) => {
    const res = g.playerIds.map((pid) => ({ pid, all: score(g.scores[pid]).all })).sort((a, b) => b.all - a.all);
    const best = res[0].all;   // przy remisie na 1. miejscu wyróżniamy wszystkich
    const rows = res.map((r) => {
      const top = r.all === best;
      const picked = histChips.includes(r.pid);
      return `<span class="hist-row${top ? ' top' : ''}"><span class="hist-name"><span class="${picked ? 'mark' : ''}">${esc(playerName(r.pid))}</span>${top ? '<span class="hist-best">najwyższy wynik</span>' : ''}</span><b class="${r.all < 0 ? 'neg' : ''}">${fmt(r.all)}</b></span>`;
    }).join('');
    return `<a class="hist-card" href="#/podglad/${g.id}">
      <span class="hist-top"><span class="hist-date">${esc(fmtDate(g.date))}</span><span class="hist-n">${g.playerIds.length} graczy</span></span>
      <span class="hist-rows">${rows}</span></a>`;
  }).join('');
}

/* Karta „Zwycięstwa w tym składzie” (od 2 graczy w filtrze i co najmniej 1 pasującej gry).
   Remis na 1. miejscu nie jest zwycięstwem nikogo; wygrana kogoś spoza filtra liczona jako „inni gracze”. */
function winsCard(games) {
  if (histChips.length < 2 || !games.length) return '';
  const wins = Object.fromEntries(histChips.map((id) => [id, 0]));
  let ties = 0, others = 0;
  for (const g of games) {
    const totals = g.playerIds.map((pid) => score(g.scores[pid]).all);
    const max = Math.max(...totals);
    const top = g.playerIds.filter((pid, i) => totals[i] === max);
    if (top.length > 1) ties += 1;
    else if (top[0] in wins) wins[top[0]] += 1;
    else others += 1;
  }
  const best = Math.max(...histChips.map((id) => wins[id]));
  const rows = histChips.map((id) => {
    const lead = best > 0 && wins[id] === best;
    const pct = Math.round((wins[id] / games.length) * 100);
    return `<div class="hw-row${lead ? ' lead' : ''}">
      <div class="hw-top"><span class="hw-name">${esc(playerName(id))}</span><span class="hw-num"><b>${wins[id]}</b><span>${zwyciestwLabel(wins[id])}</span></span></div>
      <div class="hw-bar" role="img" aria-label="${pct}% gier"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
  const note = 'Remisy: ' + ties + (others > 0 ? ' · Wygrali inni gracze: ' + others : '');
  return `<section class="hist-wins" aria-label="Zwycięstwa w wybranym składzie">
    <div class="hw-head"><h2>Zwycięstwa w tym składzie</h2><span>${gierLabel(games.length)}</span></div>
    ${rows}
    <span class="hw-note">${note}</span>
  </section>`;
}

/* Podgląd zakończonej gry – tylko do odczytu */
function renderPreview(id) {
  const g = db.games.find((x) => x.id === id && x.status === 'finished');
  if (!g) return go('historia', true);
  const { html } = buildTable(g);
  app.innerHTML = `<main class="screen">
    <header class="topbar">
      <a class="icon-btn" href="#/historia" aria-label="Wróć do historii gier">${ICON.back}</a>
      <div class="title-col"><h1>Gra z ${esc(fmtDate(g.date))}</h1><span>${g.playerIds.length} graczy · zakończona</span></div>
    </header>
    <div class="ro-info">${ICON.lockInfo} Tylko podgląd – wyników nie można zmieniać</div>
    ${html}</main>`;
}

/* =========================================================
   11. Ustawienia i kopia danych
   ========================================================= */
function renderSettings() {
  const last = db.lastBackup ? esc(fmtDateTime(db.lastBackup)) : 'brak';
  app.innerHTML = `<main class="screen">
    ${topbar('Ustawienia')}
    <div class="scroll" style="padding-top:8px;gap:14px">
      <section class="set-card">
        <h2 class="field-label">Miejsce zapisu danych</h2>
        <span class="set-val">Pamięć aplikacji</span>
        <span class="set-desc">Na razie dane są zapisywane tylko w pamięci aplikacji na tym urządzeniu.</span>
      </section>
      <section class="set-card">
        <h2 class="field-label">Ostatnia kopia danych</h2>
        <span class="set-val" id="last-backup">${last}</span>
      </section>
      <section class="set-card">
        <h2 class="field-label">Wersja aplikacji</h2>
        <span class="set-val">${APP_VERSION}</span>
      </section>
      <section class="set-card" style="gap:12px">
        <h2 class="field-label">Kopia danych</h2>
        <button class="btn btn-primary set-btn" id="backup-save">${ICON.download} Zapisz kopię danych do pliku</button>
        <button class="btn btn-outline set-btn" id="backup-load">${ICON.upload} Wczytaj kopię danych z pliku</button>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </section>
    </div></main>`;
  $('#backup-save').addEventListener('click', saveBackup);
  $('#backup-load').addEventListener('click', () => $('#backup-file').click());
  $('#backup-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) loadBackup(file);
  });
}

/* Zapis kopii: gracze + zakończone gry (bez gry w toku), pobranie pliku .json */
function saveBackup() {
  const now = new Date();
  const games = finishedGames();
  const data = { app: BACKUP_APP, format: BACKUP_FORMAT, version: APP_VERSION, createdAt: now.toISOString(), players: db.players, games };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const pad = (n) => String(n).padStart(2, '0');
  const name = `kosci-kopia-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  db.lastBackup = now.toISOString();
  save();
  const lb = $('#last-backup');
  if (lb) lb.textContent = fmtDateTime(db.lastBackup);
  toast(`Zapisano kopię: ${gierLabel(games.length)}`);
}

/* Sprawdzenie, czy plik jest poprawną kopią danych */
function parseBackup(text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.players) || !Array.isArray(d.games)) return null;
  const ids = new Set();
  for (const p of d.players) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !norm(p.name)) return null;
    ids.add(p.id);
  }
  for (const g of d.games) {
    if (!g || typeof g.id !== 'string' || g.status !== 'finished' || typeof g.date !== 'string') return null;
    if (!Array.isArray(g.playerIds) || g.playerIds.length < MIN_PLAYERS || !g.scores) return null;
    for (const pid of g.playerIds) {
      const s = g.scores[pid];
      if (!ids.has(pid) || !Array.isArray(s) || s.length !== 15) return null;
      if (!s.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    }
  }
  return d;
}

async function loadBackup(file) {
  let text;
  try { text = await file.text(); } catch (e) { toast('Nie udało się odczytać pliku'); return; }
  const d = parseBackup(text);
  if (!d) { toast('Ten plik nie jest kopią danych aplikacji Kości'); return; }
  const ok = await confirmDialog({
    title: 'Wczytać kopię danych?',
    text: `Obecne dane – gracze, zakończone gry i gra w toku – zostaną zastąpione danymi z pliku (${gierLabel(d.games.length)}${d.createdAt ? ', kopia z ' + esc(fmtDateTime(d.createdAt)) : ''}).`,
    ok: 'Wczytaj', danger: true
  });
  if (!ok) return;
  db = {
    players: d.players.map((p) => ({ id: p.id, name: norm(p.name) })),
    games: d.games.map((g) => ({ id: g.id, date: g.date, finishedAt: g.finishedAt || g.date, status: 'finished', playerIds: g.playerIds.slice(), scores: g.scores })),
    lastBackup: db.lastBackup                 // data ostatniej kopii zmienia się tylko przy zapisie
  };
  save();
  toast(`Wczytano kopię: ${gierLabel(db.games.length)}`);
}

/* =========================================================
   12. Start
   ========================================================= */
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Poproś przeglądarkę, żeby nie usuwała danych aplikacji przy braku miejsca
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
