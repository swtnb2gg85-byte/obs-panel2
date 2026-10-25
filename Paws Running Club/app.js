(function(){
'use strict';
document.documentElement.classList.add('js');

/* ───────────── утилиты ───────────── */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
};
function fmtTime(sec){
  const t = Math.round(sec * 10) / 10;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  const s = t - h * 3600 - m * 60;
  const w = Math.floor(s + 1e-9), tenth = Math.round((s - w) * 10);
  let out = h > 0 ? h + ':' + pad(m) + ':' + pad(w) : m + ':' + pad(w);
  if (tenth > 0) out += ',' + tenth;
  return out;
}
const fmtPace = p => p ? Math.floor(p / 60) + ':' + pad(p % 60) + ' /км' : '';
const fmtInt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function plural(n, a, b, c){ const m = Math.abs(n) % 100, d = m % 10; return m > 10 && m < 20 ? c : d > 1 && d < 5 ? b : d === 1 ? a : c; }
function ago(ts){
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 864e5);
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 31) return d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
  const mo = Math.floor(d / 30.4);
  if (mo < 12) return mo + ' ' + plural(mo, 'месяц', 'месяца', 'месяцев') + ' назад';
  const y = Math.floor(mo / 12);
  return y + ' ' + plural(y, 'год', 'года', 'лет') + ' назад';
}
const initials = a => ((a.ln || '')[0] || '') + ((a.fn || '')[0] || '');
const nameOf = r => r.ln + ' ' + r.fn;

const ICON = {
  link:'<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  paw:'<svg viewBox="0 0 64 64"><ellipse cx="32" cy="42" rx="14" ry="11"/><ellipse cx="14" cy="28" rx="6" ry="8"/><ellipse cx="26" cy="16" rx="6" ry="8.5"/><ellipse cx="40" cy="16" rx="6" ry="8.5"/><ellipse cx="52" cy="28" rx="6" ry="8"/></svg>',
};

/* ───────────── загрузка данных ───────────── */
function loadData(){
  const api = window.PAWS_API;
  if (!api) return Promise.reject(new Error('не задан адрес данных (PAWS_API в index.html)'));
  return fetch(api + (api.indexOf('?') < 0 ? '?' : '&') + 'format=json')
    .then(r => { if (!r.ok) throw new Error('сервер ответил ' + r.status); return r.json(); });
}
function loadImageFromServer(kind, img){
  const api = window.PAWS_API;
  if (!api) return;
  fetch(api + (api.indexOf('?') < 0 ? '?' : '&') + 'image=' + kind)
    .then(r => r.json()).then(j => { if (j && j.data) img.src = j.data; }).catch(() => {});
}

/* ───────────── состояние ───────────── */
let D, ALL = [], DISTS = [], SEASONS = [];
const S = { scope:'club', recScope:'club', dist:null, gender:'М', season:'all' };
const inScope = (r, sc) => sc === 'all' || r.cat === 'Ученик клуба';

function prepare(){
  ALL = D.results.slice();
  const meters = {};
  D.distances.forEach(d => meters[d.name] = d.m);
  const present = Array.from(new Set(ALL.map(r => r.dist)));
  DISTS = present.map(n => ({ name:n, m:meters[n] || 1e9 }))
    .sort((a, b) => a.m - b.m || a.name.localeCompare(b.name, 'ru'));
  SEASONS = Array.from(new Set(ALL.map(r => r.season).filter(Boolean))).sort((a, b) => b - a);
}
function bestPerAthlete(list){
  const best = {};
  list.forEach(r => { const k = nameOf(r); if (!best[k] || r.sec < best[k].sec) best[k] = r; });
  return Object.values(best).sort((a, b) => a.sec - b.sec);
}
function pickDefaultDist(){
  const cnt = {};
  ALL.filter(r => inScope(r, S.scope)).forEach(r => cnt[r.dist] = (cnt[r.dist] || 0) + 1);
  const top = DISTS.map(d => d.name).sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0];
  return top || (DISTS[0] && DISTS[0].name);
}

/* ───────────── каркас страницы ───────────── */
function shell(){
  const sc = ALL.length ? '' : '<div class="empty">Пока нет результатов</div>';
  $('#app').className = '';
  $('#app').innerHTML = `
<header class="top" id="top"><div class="wrap">
  <a class="brand" href="#" data-go="hero" aria-label="Paws Running Club">
    <span class="logo" id="logoBox">${ICON.paw}<img id="logoImg" alt=""></span>
    <b>Paws<br>Running Club</b>
  </a>
  <nav class="nav" id="nav" aria-label="Разделы">
    <button data-go="records">Рекорды</button>
    <button data-go="rating">Рейтинг</button>
    <button data-go="feed">Результаты</button>
    <button data-go="stats">Цифры</button>
    <button data-go="athletes">Спортсмены</button>
  </nav>
  <button class="tgl" id="theme" aria-label="Сменить тему">
    <svg class="moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>
</div></header>

<main>
<div class="hero" id="hero">
  <div class="hero-bg" id="heroBg"><img id="heroImg" alt=""></div>
  <div class="wrap hero-in">
    <div class="stamp"><i></i><span id="stamp"></span></div>
    <h1><span>Paws</span><span class="o">Running</span><span class="a">Club</span></h1>
    <div class="hero-row">
      <p>Рекорды, рейтинги и все результаты клуба — в одном месте. Обновляется автоматически из таблицы.</p>
      <div class="cta">
        <button class="btn pri" data-go="records">Рекорды клуба ${ICON.down}</button>
        <button class="btn" data-go="rating">ТОП-10 ${ICON.arrow}</button>
      </div>
    </div>
  </div>
</div>

<div class="tick" aria-hidden="true"><div class="tick-t" id="tick"></div></div>

<div class="wrap"><div class="kpi rv" id="kpi"></div></div>

<section id="records"><div class="wrap">
  <div class="sh rv">
    <div><div class="eyebrow">01 — Рекорды</div><h2>Рекорды <s>клуба</s></h2></div>
    <div class="seg" id="recScope" role="group" aria-label="Категория">
      <button data-v="club" aria-pressed="true">Ученики клуба</button>
      <button data-v="all" aria-pressed="false">Абсолют</button>
    </div>
  </div>
  <div class="rec" id="recGrid"></div>
</div></section>

<section id="rating"><div class="wrap">
  <div class="sh rv">
    <div><div class="eyebrow">02 — Рейтинг</div><h2>ТОП-10 <s>по дистанциям</s></h2></div>
    <div class="ctl">
      <div class="seg" id="scope" role="group" aria-label="Категория">
        <button data-v="club" aria-pressed="true">Ученики клуба</button>
        <button data-v="all" aria-pressed="false">Абсолют</button>
      </div>
      <div class="seg g" id="gender" role="group" aria-label="Пол">
        <button data-v="М" aria-pressed="true">Мужчины</button>
        <button data-v="Ж" aria-pressed="false">Женщины</button>
      </div>
      <select class="sel" id="season" aria-label="Сезон"></select>
    </div>
  </div>
  <div class="chips" id="chips" role="group" aria-label="Дистанция"></div>
  <div class="board rv" id="board"></div>
</div></section>

<section id="feed"><div class="wrap">
  <div class="sh rv"><div><div class="eyebrow">03 — Свежее</div><h2>Последние <s>результаты</s></h2></div></div>
  <div class="feed" id="feedGrid"></div>
</div></section>

<section id="stats"><div class="wrap">
  <div class="sh rv"><div><div class="eyebrow">04 — Клуб в цифрах</div><h2>Цифры <s>клуба</s></h2></div></div>
  <div class="grid3 rv" id="statsGrid"></div>
</div></section>

<section id="athletes"><div class="wrap">
  <div class="sh rv">
    <div><div class="eyebrow">05 — Лапки</div><h2>Спортсмены</h2></div>
    <label class="srch">${ICON.search}<input id="q" type="search" placeholder="Найти по фамилии или имени" autocomplete="off"></label>
  </div>
  <div class="ath" id="athGrid"></div>
</div></section>
</main>

<footer><div class="wrap">
  <a class="brand" href="#" data-go="hero"><span class="logo" id="logoBox2">${ICON.paw}<img id="logoImg2" alt=""></span><b>Paws<br>Running Club</b></a>
  <p>Данные — из таблицы клуба · обновлено <span id="upd"></span></p>
  <div class="big-t" aria-hidden="true">Paws Running Club</div>
</div></footer>

<dialog id="dlg" aria-label="Спортсмен"></dialog>`;
}

/* ───────────── картинки ───────────── */
function loadImage(img, ref, w, onOk, kind){
  if (!img) return;
  if (!ref) return;
  const c = [];
  if (ref.url) c.push(ref.url);
  if (ref.id){
    c.push('https://lh3.googleusercontent.com/d/' + ref.id + '=w' + w);
    c.push('https://drive.google.com/thumbnail?id=' + ref.id + '&sz=w' + w);
  }
  let i = 0, serverTried = false;
  img.referrerPolicy = 'no-referrer';
  const next = () => {
    if (i < c.length){ img.src = c[i++]; return; }
    if (ref.id && kind && !serverTried){
      serverTried = true;
      loadImageFromServer(kind, img);
    }
  };
  img.onerror = next;
  img.onload = () => { if (img.naturalWidth > 1){ img.classList.add('ok'); if (onOk) onOk(); } };
  next();
}
function loadMedia(){
  const m = D.media || {};
  loadImage($('#heroImg'), m.photo, 2000, null, 'photo');
  [['logoImg','logoBox'],['logoImg2','logoBox2']].forEach(p => {
    loadImage($('#' + p[0]), m.logo, 256, () => { const s = $('svg', $('#' + p[1])); if (s) s.style.display = 'none'; }, 'logo');
  });
}

/* ───────────── разделы ───────────── */
function renderStamp(){
  const d = D.updated ? new Date(D.updated) : new Date();
  const fmt = d.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  const seasonLbl = SEASONS[0] ? 'Сезон ' + SEASONS[0] + ' · ' : '';
  $('#stamp').textContent = seasonLbl + 'обновлено ' + fmt;
  $('#upd').textContent = fmt;
}

function records(sc){
  const out = [];
  DISTS.forEach(d => {
    const list = ALL.filter(r => r.dist === d.name && inScope(r, sc));
    const pick = g => list.filter(r => r.g === g).sort((a, b) => a.sec - b.sec)[0] || null;
    const m = pick('М'), f = pick('Ж');
    if (m || f) out.push({ dist:d.name, m, f });
  });
  return out;
}

function renderTicker(){
  const rs = records('club');
  const items = [];
  rs.forEach(r => [r.m, r.f].forEach(x => {
    if (x) items.push(`<span class="tick-i"><em>${esc(x.dist)}</em><b>${fmtTime(x.sec)}</b>${esc(nameOf(x))}</span>`);
  }));
  const html = items.join('');
  $('#tick').innerHTML = html + html;
  // длинная лента → скорость постоянна
  $('#tick').style.animationDuration = Math.max(30, items.length * 5) + 's';
}

function renderKpi(){
  const athletes = new Set(ALL.map(nameOf)).size;
  const km = ALL.reduce((s, r) => { const d = DISTS.find(x => x.name === r.dist); return s + (d && d.m < 1e9 ? d.m / 1000 : 0); }, 0);
  const pbs = ALL.filter(r => r.pb).length;
  const cells = [
    [athletes, 'Спортсменов'],
    [ALL.length, 'Результатов'],
    [pbs, 'Личных рекордов'],
    [km, 'Километров в зачёте'],
  ];
  $('#kpi').innerHTML = cells.map(c => `<div><span class="num" data-n="${Math.round(c[0])}">0</span><small>${c[1]}</small></div>`).join('');
}

function renderRecords(){
  const rs = records(S.recScope);
  const row = (x, g) => x
    ? `<div class="rr ${g === 'М' ? 'm' : 'f'}"><div class="tag">${g === 'М' ? 'Мужчины' : 'Женщины'}</div>
         <div class="who">${esc(nameOf(x))}${x.pb ? '<span class="pb">PB</span>' : ''}<small>${x.season || ''}${x.season ? ' · ' : ''}${esc(x.cat)}</small></div>
         <div style="text-align:right"><div class="num">${fmtTime(x.sec)}</div><div class="pace">${fmtPace(x.pace)}</div></div></div>`
    : `<div class="rr none ${g === 'М' ? 'm' : 'f'}"><div class="tag">${g === 'М' ? 'Мужчины' : 'Женщины'}</div><div class="who muted">Рекорда пока нет</div><div class="num">—</div></div>`;
  $('#recGrid').innerHTML = rs.length ? rs.map(r => `
    <button class="rc rv" data-dist="${esc(r.dist)}" aria-label="ТОП-10 · ${esc(r.dist)}">
      <div class="rc-h"><b>${esc(r.dist)}</b><span>ТОП-10 →</span></div>
      ${row(r.m, 'М')}${row(r.f, 'Ж')}
    </button>`).join('') : '<div class="empty">Пока нет результатов</div>';
  observe($$('#recGrid .rv'));
}

function renderChips(){
  $('#chips').innerHTML = DISTS.map(d => `<button class="chip" data-d="${esc(d.name)}" aria-pressed="${d.name === S.dist}">${esc(d.name)}</button>`).join('');
  const on = $('.chip[aria-pressed="true"]', $('#chips'));
  if (on){ const c = $('#chips'); c.scrollLeft = Math.max(0, on.offsetLeft - c.clientWidth / 2 + on.clientWidth / 2); }
}
function renderSeason(){
  $('#season').innerHTML = '<option value="all">Все сезоны</option>' + SEASONS.map(s => `<option value="${s}">Сезон ${s}</option>`).join('');
  $('#season').value = S.season;
}
function renderBoard(){
  const list = ALL.filter(r => r.dist === S.dist && r.g === S.gender && inScope(r, S.scope) && (S.season === 'all' || String(r.season) === String(S.season)));
  const top = bestPerAthlete(list).slice(0, 10);
  const best = top[0];
  const gl = S.gender === 'М' ? 'Мужчины' : 'Женщины';
  const sl = S.season === 'all' ? 'все сезоны' : 'сезон ' + S.season;
  let html = `<div class="bh"><b>${esc(S.dist)} · ${gl}</b><span>${S.scope === 'club' ? 'Ученики клуба' : 'Абсолют'} · ${sl}</span></div>`;
  if (!top.length) html += '<div class="empty">В этой категории результатов пока нет.<br>Попробуйте другой сезон или пол.</div>';
  top.forEach((r, i) => {
    const w = (best.sec / r.sec).toFixed(3);
    html += `<button class="row" data-a="${esc(nameOf(r))}">
      <span class="rk num">${i + 1}</span>
      <span class="nm">${esc(nameOf(r))}${r.pb ? '<span class="pb">PB</span>' : ''}${r.track ? `<a href="${esc(r.track)}" target="_blank" rel="noopener" data-stop aria-label="Трек">${ICON.link}</a>` : ''}
        <small>${r.season || ''}${r.season ? ' · ' : ''}${esc(r.cat)}<span class="pcm"> · ${fmtPace(r.pace)}</span></small></span>
      <span class="bar" style="--w:${w}"><i></i></span>
      <span class="tm num">${fmtTime(r.sec)}</span>
      <span class="pc">${fmtPace(r.pace)}</span></button>`;
  });
  const b = $('#board');
  b.innerHTML = html;
  b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
}

function renderFeed(){
  const list = ALL.filter(r => r.ts).sort((a, b) => b.ts - a.ts).slice(0, 8);
  $('#feedGrid').innerHTML = list.map(r => `
    <button class="fc rv" data-a="${esc(nameOf(r))}">
      <div class="fc-h"><span class="av ${r.g === 'М' ? 'm' : 'f'}">${esc(initials(r))}</span>
        <div><b>${esc(nameOf(r))}${r.pb ? '<span class="pb">PB</span>' : ''}</b><small>${ago(r.ts)}${r.season ? ' · сезон ' + r.season : ''}</small></div></div>
      <div class="num">${fmtTime(r.sec)}</div>
      <div class="fc-f"><span class="dp">${esc(r.dist)}</span><span>${fmtPace(r.pace)}</span></div>
    </button>`).join('') || '<div class="empty">Пока нет результатов</div>';
  observe($$('#feedGrid .rv'));
}

function renderStats(){
  const bySeason = {};
  ALL.forEach(r => { if (r.season) bySeason[r.season] = (bySeason[r.season] || 0) + 1; });
  const sKeys = Object.keys(bySeason).map(Number).sort((a, b) => a - b);
  const maxS = Math.max.apply(null, sKeys.map(k => bySeason[k]).concat([1]));
  const cur = SEASONS[0];
  const cols = sKeys.map(k => `<div class="col ${k === cur ? 'cur' : ''}"><span class="num">${bySeason[k]}</span><i data-h="${Math.max(4, Math.round(bySeason[k] / maxS * 100))}"></i><small>’${String(k).slice(-2)}</small></div>`).join('');

  const byDist = {};
  ALL.forEach(r => byDist[r.dist] = (byDist[r.dist] || 0) + 1);
  const dTop = Object.keys(byDist).sort((a, b) => byDist[b] - byDist[a]).slice(0, 7);
  const maxD = byDist[dTop[0]] || 1;
  const hb = dTop.map(n => `<div class="hb"><span>${esc(n)}</span><span>${byDist[n]}</span><div class="bar" style="--w:${(byDist[n] / maxD).toFixed(3)}"><i></i></div></div>`).join('');

  const ath = {};
  ALL.forEach(r => ath[nameOf(r)] = r);
  const A = Object.values(ath);
  const m = A.filter(a => a.g === 'М').length, f = A.length - m;
  const stu = A.filter(a => a.cat === 'Ученик клуба').length, tr = A.length - stu;
  const pbShare = ALL.length ? Math.round(ALL.filter(r => r.pb).length / ALL.length * 100) : 0;
  const pct = (a, b) => (a + b) ? (a / (a + b) * 100).toFixed(1) : 0;

  $('#statsGrid').innerHTML = `
    <div class="pn"><h3>Результатов по сезонам</h3><div class="cols">${cols}</div></div>
    <div class="pn"><h3>Популярные дистанции</h3>${hb}</div>
    <div class="pn"><h3>Состав клуба</h3>
      <div class="split"><div class="sp-t"><span style="color:var(--m)">Мужчины · ${m}</span><span style="color:var(--f)">Женщины · ${f}</span></div>
        <div class="sp-b"><i style="flex:${m||0.001};background:var(--m)"></i><i style="flex:${f||0.001};background:var(--f)"></i></div></div>
      <div class="split"><div class="sp-t"><span>Ученики · ${stu}</span><span class="muted">Тренеры · ${tr}</span></div>
        <div class="sp-b"><i style="flex:${stu||0.001};background:var(--acc)"></i><i style="flex:${tr||0.001};background:var(--tx3)"></i></div></div>
      <div class="split"><div class="num big" style="color:var(--acc)">${pbShare}%</div><div class="muted" style="margin-top:8px;font-size:14px">результатов — личные рекорды</div></div>
    </div>`;
  observe([$('#statsGrid')]);
  // высоты колонок анимируем после появления
  const g = $('#statsGrid');
  const grow = () => $$('.col i', g).forEach(i => i.style.height = i.dataset.h + '%');
  if (g.classList.contains('in')) grow(); else g._grow = grow;
}

function renderAthletes(filter){
  const map = {};
  ALL.forEach(r => { const k = nameOf(r); (map[k] = map[k] || { ln:r.ln, fn:r.fn, g:r.g, cat:r.cat, n:0 }).n++; });
  const q = (filter || '').trim().toLowerCase();
  const list = Object.values(map).filter(a => !q || (a.ln + ' ' + a.fn).toLowerCase().includes(q))
    .sort((a, b) => (a.ln + a.fn).localeCompare(b.ln + b.fn, 'ru'));
  $('#athGrid').innerHTML = list.map(a => `
    <button class="ac" data-a="${esc(a.ln + ' ' + a.fn)}"><span class="av ${a.g === 'М' ? 'm' : 'f'}">${esc(initials(a))}</span>
      <span style="min-width:0"><b>${esc(a.ln + ' ' + a.fn)}</b><small>${a.n} ${plural(a.n, 'результат', 'результата', 'результатов')}</small></span></button>`).join('')
    || '<div class="empty" style="grid-column:1/-1">Никого не нашли</div>';
}

/* ───────────── профиль спортсмена ───────────── */
function openAthlete(name){
  const rs = ALL.filter(r => nameOf(r) === name);
  if (!rs.length) return;
  const a = rs[0];
  const byD = {};
  rs.forEach(r => (byD[r.dist] = byD[r.dist] || []).push(r));
  const ds = DISTS.filter(d => byD[d.name]);
  const km = rs.reduce((s, r) => { const d = DISTS.find(x => x.name === r.dist); return s + (d && d.m < 1e9 ? d.m / 1000 : 0); }, 0);
  const blocks = ds.map(d => {
    const l = byD[d.name].sort((x, y) => x.sec - y.sec);
    return `<div class="dd"><div class="dd-h"><b>${esc(d.name)}</b><span class="num">${fmtTime(l[0].sec)}</span></div>
      <div class="ln">${l.map((r, i) => `<span class="${i === 0 ? 'b' : ''}">${fmtTime(r.sec)}${r.season ? ' · ' + r.season : ''}${r.track ? ` · <a href="${esc(r.track)}" target="_blank" rel="noopener">трек</a>` : ''}</span>`).join('')}</div></div>`;
  }).join('');
  const dlg = $('#dlg');
  dlg.innerHTML = `
    <div class="dh"><span class="av ${a.g === 'М' ? 'm' : 'f'}">${esc(initials(a))}</span>
      <div><h3>${esc(name)}</h3><small>${esc(a.cat)}</small></div>
      <button class="x" aria-label="Закрыть" data-close>${ICON.x}</button></div>
    <div class="db"><div class="ds">
      <div><span class="num">${rs.length}</span><small>результатов</small></div>
      <div><span class="num">${rs.filter(r => r.pb).length}</span><small>личных рекордов</small></div>
      <div><span class="num">${ds.length}</span><small>дистанций</small></div>
      <div><span class="num">${fmtInt(km)}</span><small>км в зачёте</small></div></div>${blocks}</div>`;
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

/* ───────────── анимации ───────────── */
let io;
function observe(els){
  els.filter(Boolean).forEach(el => {
    if (!io){
      io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target; el.classList.add('in'); io.unobserve(el);
        if (el._grow) el._grow();
        $$('[data-n]', el).forEach(countUp);
      }), { threshold:.12, rootMargin:'0px 0px -6% 0px' });
    }
    io.observe(el);
  });
}
function countUp(el){
  const to = +el.dataset.n || 0;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches || to < 2){ el.textContent = fmtInt(to); return; }
  const t0 = performance.now(), dur = 1400;
  (function f(t){
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
    el.textContent = fmtInt(to * e);
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}

/* ───────────── навигация / тема ───────────── */
function go(id){
  const el = document.getElementById(id);
  if (!el) return;
  const y = id === 'hero' ? 0 : el.getBoundingClientRect().top + window.scrollY - 56;
  window.scrollTo({ top:y, behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
}
function setTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const mt = document.querySelector('meta[name="theme-color"]');
  if (mt) mt.content = t === 'light' ? '#f3f0e9' : '#0a0a0b';
}
function initTheme(){
  let t = store.get('paws-theme');
  if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(t);
}
function spy(){
  const ids = ['records','rating','feed','stats','athletes'];
  const top = $('#top');
  const onScroll = () => {
    top.classList.toggle('stuck', window.scrollY > 40);
    let cur = '';
    ids.forEach(id => { const r = document.getElementById(id).getBoundingClientRect(); if (r.top < window.innerHeight * .4) cur = id; });
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === cur));
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

/* ───────────── события ───────────── */
function bind(){
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-stop]')) return;           // внешняя ссылка на трек
    const g = t.closest('[data-go]');
    if (g){ e.preventDefault(); go(g.dataset.go); return; }
    if (t.closest('#theme')){
      const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(n); store.set('paws-theme', n); return;
    }
    const sg = t.closest('.seg button');
    if (sg){
      const box = sg.parentElement;
      $$('button', box).forEach(b => b.setAttribute('aria-pressed', b === sg));
      if (box.id === 'recScope'){ S.recScope = sg.dataset.v; renderRecords(); }
      if (box.id === 'scope'){ S.scope = sg.dataset.v; renderBoard(); }
      if (box.id === 'gender'){ S.gender = sg.dataset.v; renderBoard(); }
      return;
    }
    const ch = t.closest('.chip');
    if (ch){ S.dist = ch.dataset.d; renderChips(); renderBoard(); return; }
    const rc = t.closest('.rc');
    if (rc){
      S.dist = rc.dataset.dist; S.scope = S.recScope;
      $$('#scope button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === S.scope));
      renderChips(); renderBoard(); go('rating'); return;
    }
    const a = t.closest('[data-a]');
    if (a){ openAthlete(a.dataset.a); return; }
    if (t.closest('[data-close]')){ $('#dlg').close(); return; }
    if (t === $('#dlg')) $('#dlg').close();          // клик по подложке
  });
  $('#season').addEventListener('change', e => { S.season = e.target.value; renderBoard(); });
  $('#q').addEventListener('input', e => renderAthletes(e.target.value));
}

/* ───────────── старт ───────────── */
initTheme();
loadData().then(d => {
  D = d; prepare();
  S.dist = pickDefaultDist();
  shell(); initTheme();
  renderStamp(); renderTicker(); renderKpi();
  renderRecords(); renderChips(); renderSeason(); renderBoard();
  renderFeed(); renderStats(); renderAthletes();
  loadMedia(); bind(); spy();
  observe($$('.rv').filter(el => !el.closest('#recGrid') && !el.closest('#feedGrid')));
  window.__ready = true;
}).catch(err => {
  $('#app').innerHTML = '<div style="text-align:center;padding:24px"><b>Не удалось загрузить данные</b><br><span style="opacity:.7">' + esc(err && err.message ? err.message : err) + '</span><br><br><button class="btn" onclick="location.reload()">Повторить</button></div>';
  try { console.error(err); } catch(e){}
});
})();
