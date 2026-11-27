'use strict';
/* ===== Dhyan Shield: blocklist =====
   Entries with a space or 6+ letters match as substrings; shorter single words match whole words only
   (so "essex" or "analysis" are not blocked). Add or remove terms freely. */
const BLOCKLIST = [
  // adult / explicit
  'porn','pornhub','pornography','porno','xxx','xnxx','xvideos','xhamster','redtube','youporn','brazzers','onlyfans','nsfw','hentai','erotic','erotica',
  'sex','sexy','sexcam','sex video','nude','nudes','naked','nudity','fetish','milf','boobs','nipples','camgirl','escort','strip club','adult video','adult content','rule34','r34','blowjob','handjob','orgy','incest','jav',
  // gambling / betting
  'gambling','casino','betting','bet365','1xbet','betway','sportsbook','online poker','poker','slots','slot machine','roulette','blackjack','lottery','satta','matka','dream11','rummy','teen patti','fantasy betting','stake.com',
  // proxy / VPN / bypass
  'vpn','proxy','proxies','unblock','unblocker','bypass filter','bypass firewall','hide ip','tor browser','torrent','piratebay','hotspot shield','nordvpn','expressvpn','proton vpn','hide.me','croxyproxy','kproxy','hidemyass',
  // violence / self-harm / drugs
  'gore','beheading','snuff','how to make a bomb','buy drugs','buy weed','suicide method',
  // dating / chat strangers
  'dating','tinder','bumble','grindr','hookup','hook up','omegle','chatroulette','badoo','okcupid','sugar daddy','sugar baby','girlfriend app','azar','random video chat',
  // more adult / vulgar / gambling
  'xvideo','pornstar','bdsm','lingerie','playboy','stripper','topless','hot girls','adult site','jerkoff','masturbat','cumshot','dildo','sex chat','call girl','teen sex','fuck','fucking','pussy','cunt','slut','whore','bitch','asshole',
  'jackpot','bookie','satta king','aviator game','crash game','ludo money','fantasy cricket','real money game','spin and win','bingo','baccarat'
];
const YT_BLOCK = ['gameplay','gaming','gamer','game','games','minecraft','roblox','fortnite','pubg','bgmi','free fire','gta','among us','prank','roast','vlog','reaction','mukbang','asmr','twerk','dance','trailer','movie','web series','song','songs','remix','meme','memes','tiktok','reels','horror','scary','creepy','killing','murder','fight','fights','wwe','bikini','hot','sexy','item song','cartoon compilation'];
const BLOCKED_DOMAINS = ['pornhub.com','xvideos.com','xnxx.com','xhamster.com','redtube.com','youporn.com','onlyfans.com','bet365.com','1xbet.com','stake.com','betway.com','dream11.com','nordvpn.com','expressvpn.com','croxyproxy.com','kproxy.com','hidemyass.com','thepiratebay.org','rule34.xxx'];
const TLD_BLOCK = ['.xxx','.porn','.sex','.adult','.bet','.casino','.poker'];

const FACT = 'https://factadda.pages.dev';
const FACT_CARDS = [ // adjust paths to match your Fact Adda site structure
  ['Fact Adda Home','Start here',FACT],
  ['NCERT Solutions','Class-wise answers',FACT+'/ncert-solutions'],
  ['Digital Science Lab','Experiments & models',FACT+'/science-lab'],
  ['Digital Maths Lab','Visual maths',FACT+'/maths-lab'],
  ['Space Lab','Explore the cosmos',FACT+'/space-lab']
];
const BOOKMARKS = [['Fact Adda',FACT],['Wikipedia','https://www.wikipedia.org'],['NCERT','https://ncert.nic.in'],['DIKSHA','https://diksha.gov.in'],['Khan Academy','https://www.khanacademy.org'],['NASA Kids','https://www.nasa.gov/learning-resources/for-kids-and-students/']];

const $ = s => document.querySelector(s);
const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const jset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = n => n.trim().toLowerCase();
let me = null, unlocked = false, pwResolve = null;

/* ---------- crypto / accounts ---------- */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
const users = () => jget('ds_users', {});
async function verify(k, pass) { const u = users()[k]; return !!u && (await sha256(u.salt + ':' + pass)) === u.hash; }

async function login(name, pass) {
  const k = key(name), all = users();
  if (all[k]) {
    if (!(await verify(k, pass))) throw new Error('Wrong password for this profile.');
  } else {
    const salt = randSalt();
    all[k] = { name: name.trim(), salt, hash: await sha256(salt + ':' + pass), created: Date.now() };
    jset('ds_users', all);
  }
  me = k; localStorage.setItem('dhyan_active_user', k);
  showApp();
}
function logout() { destroyTabs(); me = null; unlocked = false; localStorage.removeItem('dhyan_active_user'); showLogin(); }

/* ---------- history ---------- */
const hkey = () => 'ds_hist_' + me;
function log(type, q) {
  const h = jget(hkey(), []);
  h.unshift({ t: Date.now(), type, q, flag: type === 'blocked' });
  jset(hkey(), h.slice(0, 500));
  if (unlocked) renderHistory();
}
function renderHistory() {
  const ul = $('#histList'), h = jget(hkey(), []);
  ul.innerHTML = h.length ? h.map(e =>
    `<li><time>${new Date(e.t).toLocaleString()}</time><span class="${e.flag ? 'bad' : ''}">${e.flag ? '🚩 BLOCKED: ' : e.type === 'visit' ? '🔗 ' : '🔎 '}${esc(e.q)}</span></li>`).join('')
    : '<li class="muted">No history yet.</li>';
}
function setLock(on) {
  unlocked = !on;
  $('#histList').hidden = on; $('#histLocked').hidden = !on;
  $('#unlockBtn').hidden = !on; $('#lockBtn').hidden = on; $('#clearBtn').hidden = on;
  if (!on) renderHistory();
}
function askPassword(title) {
  $('#pwTitle').textContent = title; $('#pwInput').value = ''; $('#pwErr').textContent = '';
  $('#pwDlg').showModal(); $('#pwInput').focus();
  return new Promise(r => pwResolve = r);
}

/* ---------- safety check ---------- */
function isBlocked(raw) {
  const s = String(raw || '');
  const leet = s.toLowerCase().replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[$5]/g, 's');
  return [s, leet, s.replace(/[.\-_*]+/g, '')].some(_isBlocked0);
}
function _isBlocked0(raw) {
  const q = raw.toLowerCase().trim();
  const words = q.split(/[^a-z0-9]+/).filter(Boolean), flat = words.join(' ');
  let host = '';
  try { host = new URL(/^[a-z]+:\/\//.test(q) ? q : 'https://' + q).hostname.replace(/^www\./, ''); } catch {}
  if (host && (BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d)) || TLD_BLOCK.some(t => host.endsWith(t)))) return true;
  const compact = flat.replace(/ /g, '');
  return BLOCKLIST.some(t => {
    if (t.includes(' ') || t.length >= 6) return flat.includes(t) || compact.includes(t.replace(/[^a-z0-9]/g, ''));
    return words.includes(t);
  });
}
function showBlocked(q) {
  const b = $('#banner'); b.hidden = false;
  b.textContent = '🚫 Dhyan Shield: Restricted Content. This search or site is blocked for student safety.';
  log('blocked', q);
}

/* ---------- Pomodoro ---------- */
let pomo = { mode: 'focus', left: 1500, timer: null };
function drawPomo() {
  const m = String(Math.floor(pomo.left / 60)).padStart(2, '0'), s = String(pomo.left % 60).padStart(2, '0');
  $('#pomoTime').textContent = m + ':' + s;
  $('#pomoMode').textContent = pomo.mode === 'focus' ? 'Focus' : 'Break';
  $('.pomo').classList.toggle('break', pomo.mode !== 'focus');
  $('#pomoGo').textContent = pomo.timer ? '⏸' : '▶';
}
function setMode(m) { clearInterval(pomo.timer); pomo.timer = null; pomo.mode = m; pomo.left = m === 'focus' ? 1500 : 300; drawPomo(); }
function togglePomo() {
  if (pomo.timer) { clearInterval(pomo.timer); pomo.timer = null; }
  else pomo.timer = setInterval(() => {
    if (--pomo.left <= 0) { try { navigator.vibrate?.(300); } catch {} const next = pomo.mode === 'focus' ? 'break' : 'focus'; alert(next === 'break' ? 'Focus session done! Take a 5 minute break.' : 'Break over. Back to focus!'); setMode(next); }
    drawPomo();
  }, 1000);
  drawPomo();
}

/* ---------- views ---------- */
function showLogin() {
  $('#appView').hidden = true; $('#loginView').hidden = false;
  $('#uPass').value = ''; $('#loginErr').textContent = '';
  const all = users();
  $('#profiles').innerHTML = Object.keys(all).map(k => `<button type="button" class="chip" data-k="${esc(k)}">${esc(all[k].name)}</button>`).join('');
}
function showApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
  $('#whoami').textContent = users()[me].name;
  $('#banner').hidden = true; $('#q').value = '';
  setLock(true); resetTabs();
}
function init() {
  $('#factCards').innerHTML = FACT_CARDS.map(c => `<a class="fcard" href="${c[2]}" data-t="${esc(c[0])}">${esc(c[0])}<small>${esc(c[1])}</small></a>`).join('');
  $('#bookmarks').innerHTML = BOOKMARKS.map(b => `<a href="${b[1]}" data-t="${esc(b[0])}">${esc(b[0])}</a>`).join('');
  document.addEventListener('click', e => { const a = e.target.closest('a[data-t]'); if (a) { e.preventDefault(); openViewer(a.href, a.dataset.t); } });
  $('#tabstrip').addEventListener('click', e => {
    if (e.target.closest('.tabadd')) return newTab('home');
    const el = e.target.closest('.tab'); if (!el) return;
    e.target.closest('.x') ? closeTab(+el.dataset.id) : activate(+el.dataset.id);
  });
  $('#reloadBtn').onclick = reloadTab; $('#homeBtn').onclick = goHome; $('#readerBtn').onclick = toggleReader;
  $('#tubeBtn').onclick = () => { if (active && active.type === 'home') { setType(active, 'tube'); activate(active); } else newTab('tube'); };
  $('#histBtn').onclick = () => { const h = tabs.find(t => t.type === 'history'); h ? activate(h) : newTab('history'); };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    try { await login($('#uName').value, $('#uPass').value); } catch (x) { $('#loginErr').textContent = x.message; }
  });
  $('#profiles').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { $('#uName').value = users()[c.dataset.k].name; $('#uPass').focus(); } });
  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); handleQuery($('#q').value); });
  $('#logoutBtn').onclick = logout; $('#switchBtn').onclick = logout;
  $('#unlockBtn').onclick = async () => { if (await askPassword('Enter password to unlock history')) setLock(false); };
  $('#lockBtn').onclick = () => setLock(true);
  $('#clearBtn').onclick = async () => { if (await askPassword('Enter password to clear history')) { jset(hkey(), []); renderHistory(); } };
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (await verify(me, $('#pwInput').value)) { $('#pwDlg').close(); pwResolve?.(true); pwResolve = null; }
    else $('#pwErr').textContent = 'Wrong password.';
  });
  $('#pwCancel').onclick = () => { $('#pwDlg').close(); pwResolve?.(false); pwResolve = null; };
  $('#pwDlg').addEventListener('cancel', () => { pwResolve?.(false); pwResolve = null; });
  $('#pomoGo').onclick = togglePomo; $('#pomoReset').onclick = () => setMode(pomo.mode);
  $('#pomoSwap').onclick = () => setMode(pomo.mode === 'focus' ? 'break' : 'focus');
  drawPomo();
  const cur = localStorage.getItem('dhyan_active_user');
  if (cur && users()[cur]) { me = cur; showApp(); } else showLogin();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- Study Tube ---------- */
function ytBlocked(q) {
  if (isBlocked(q)) return true;
  const flat = ' ' + q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ') + ' ';
  return YT_BLOCK.some(t => flat.includes(' ' + t + ' '));
}
function ytParse(s) {
  let u; try { u = new URL(/^https?:/i.test(s) ? s : 'https://' + s); } catch { return null; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(h)) return null;
  let id = h === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/) || [])[1] || '';
  const list = u.searchParams.get('list') || '';
  const r = { video: /^[\w-]{11}$/.test(id) ? id : '', list: /^[\w-]+$/.test(list) ? list : '' };
  return r.video || r.list ? r : null;
}
const PIPED = ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de'];


/* ---------- Multi-tab browser (max 7) ---------- */
const MAX_TABS = 7;
const EMBED_OK = ['factadda.pages.dev']; // sites that allow iframes; everything else opens in Reader view
const JINA_KEY = ''; // optional free key from jina.ai: enables live web-wide search (s.jina.ai)
const ICON = { home: '🏠', web: '🌐', tube: '▶', history: '🔒' };
let tabs = [], active = null, tabSeq = 0;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const looksLikeUrl = s => !/\s/.test(s) && (/^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s));
const handleQuery = q => omnibox(q);
const openViewer = (url, label) => navigate(url, label);

function addTab(type) { const t = { id: ++tabSeq, type: 'home', title: '', url: '', q: '', pane: null, timer: null }; tabs.push(t); setType(t, type); return t; }
function dropPane(t) { clearTimeout(t.timer); if (t.pane) { const f = t.pane.querySelector('iframe'); if (f) f.src = 'about:blank'; t.pane.remove(); t.pane = null; } }
function setType(t, type) {
  dropPane(t); t.type = type; t.url = ''; t.q = ''; t.mode = '';
  t.title = { home: 'New Tab', history: 'History', tube: 'Study Tube', web: 'Loading…' }[type];
  if (type === 'web') {
    const p = document.createElement('div'); p.className = 'tpane web'; p.hidden = true;
    p.innerHTML = '<iframe class="wf" title="Web page" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" referrerpolicy="no-referrer" allow="fullscreen"></iframe><article class="rd" hidden></article>';
    $('#panes').append(p); t.pane = p;
  } else if (type === 'tube') {
    const p = $('#tubeTpl').content.firstElementChild.cloneNode(true); p.hidden = true;
    p.querySelector('.tf').onsubmit = e => { e.preventDefault(); tubeGo(t, p.querySelector('.tq').value); };
    p.querySelector('.tl').onclick = e => { const b = e.target.closest('[data-v]'); if (b) tubePlay(t, { video: b.dataset.v, list: '' }); };
    $('#panes').append(p); t.pane = p;
  }
}
function newTab(type = 'home') {
  if (tabs.length >= MAX_TABS) { alert('Maximum 7 tabs allowed for focused study'); return null; }
  const t = addTab(type); activate(t); return t;
}
function activate(x) {
  const t = typeof x === 'number' ? tabs.find(a => a.id === x) : x; if (!t) return;
  active = t; $('#banner').hidden = true;
  $('#home').hidden = t.type !== 'home'; $('#histBox').hidden = t.type !== 'history';
  tabs.forEach(a => { if (a.pane) a.pane.hidden = a !== t; });
  $('#q').value = t.q || t.url || ''; setPressed(t); renderStrip(); saveTabs();
}
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return; const t = tabs[i];
  dropPane(t); tabs.splice(i, 1);
  if (!tabs.length) return newTab();
  if (active === t) activate(tabs[Math.min(i, tabs.length - 1)]); else { renderStrip(); saveTabs(); }
}
function renderStrip() {
  $('#tabstrip').innerHTML = tabs.map(t => `<div class="tab" role="tab" tabindex="0" data-id="${t.id}" aria-selected="${t === active}"><span class="ttl">${ICON[t.type]} ${esc(t.title)}</span><button class="x" aria-label="Close tab">×</button></div>`).join('')
    + '<button class="tabadd" aria-label="New tab" title="New tab">+</button>';
}
function saveTabs() { if (me) jset('ds_tabs_' + me, { a: tabs.indexOf(active), t: tabs.map(t => ({ type: t.type, url: t.url, q: t.q, title: t.title, m: t.mode })) }); }
function destroyTabs() { tabs.forEach(dropPane); tabs = []; active = null; $('#tabstrip').innerHTML = ''; }
function resetTabs() {
  destroyTabs(); const s = jget('ds_tabs_' + me, null);
  if (s && s.t && s.t.length) {
    s.t.slice(0, MAX_TABS).forEach(x => { const t = addTab(x.type); if (x.type === 'web') { if (x.m === 'results' && x.q) runSearch(t, x.q); else if (x.url && !isBlocked(x.url)) loadTab(t, x.url, x.title, x.q || ''); } });
    activate(tabs[Math.min(Math.max(s.a, 0), tabs.length - 1)]);
  } else newTab();
}
function goHome() { if (!active) return; setType(active, 'home'); activate(active); }
function reloadTab() { const t = active; if (!t || t.type !== 'web') return; if (t.mode === 'results') runSearch(t, t.q); else if (t.url) loadTab(t, t.url, t.title, t.q); }

function loadTab(t, url, title, q) {
  t.url = url; t.title = title; t.q = q; activate(t);
  const host = hostOf(url);
  if (EMBED_OK.some(d => host === d || host.endsWith('.' + d))) showFrame(t); else readerMode(t);
}
function navigate(url, label) {
  url = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  if (isBlocked(url) || isBlocked(label || '')) return showBlocked(url);
  const yt = ytParse(url); let t = active;
  if (yt && t && t.type === 'tube') return tubePlay(t, yt);
  if (!t || t.type === 'tube' || t.type === 'history') { t = newTab(); if (!t) return; }
  if (yt) { setType(t, 'tube'); activate(t); return tubePlay(t, yt); }
  log('visit', label ? label + ' (' + url + ')' : url);
  if (t.type !== 'web') setType(t, 'web');
  loadTab(t, url, label || hostOf(url), '');
}
function omnibox(raw) {
  raw = raw.trim(); if (!raw) return; $('#banner').hidden = true;
  if (active && active.type === 'tube') return tubeGo(active, raw);
  if (isBlocked(raw)) return showBlocked(raw);
  if (ytParse(raw) || looksLikeUrl(raw)) return navigate(raw);
  let t = active; if (!t || t.type === 'history') { t = newTab(); if (!t) return; }
  log('search', raw);
  runSearch(t, raw);
}
function setPressed(t) { $('#readerBtn').setAttribute('aria-pressed', String(!!t && t.mode === 'reader')); }
function showFrame(t) {
  const f = t.pane.querySelector('iframe'); t.pane.querySelector('.rd').hidden = true; f.hidden = false; f.src = t.url;
  t.mode = 'frame'; if (t === active) setPressed(t); saveTabs();
}
function toggleReader() {
  const t = active; if (!t || t.type !== 'web' || !t.url) return;
  t.mode === 'reader' ? showFrame(t) : readerMode(t);
}
const safeUrl = (u, base) => { try { const x = new URL(u, base); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
function renderMd(box, md, base) {
  let ul = null;
  const inline = (el, txt) => {
    const re = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g; let i = 0, m;
    while ((m = re.exec(txt))) {
      el.append(txt.slice(i, m.index)); i = re.lastIndex;
      const isImg = m[2] !== undefined, url = safeUrl(isImg ? m[2] : m[4], base), label = isImg ? m[1] : m[3];
      if (isImg) { if (url && !isBlocked(url)) { const im = document.createElement('img'); im.src = url; im.alt = label.replace(/^Image \d+:\s*/, ''); im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; el.append(im); } }
      else if (url && !isBlocked(url) && !isBlocked(label)) { const l = document.createElement('a'); l.href = url; l.dataset.t = label.slice(0, 80); l.textContent = label; el.append(l); }
      else el.append(label);
    }
    el.append(txt.slice(i));
  };
  md.split('\n').forEach(line => {
    line = line.trim(); let el;
    if (!line) { ul = null; return; }
    const hd = line.match(/^(#{1,6})\s+(.*)/);
    if (hd) { ul = null; el = document.createElement('h' + Math.min(hd[1].length + 1, 6)); inline(el, hd[2]); }
    else if (/^[-*]\s+/.test(line)) { if (!ul) { ul = document.createElement('ul'); box.append(ul); } el = document.createElement('li'); inline(el, line.replace(/^[-*]\s+/, '')); ul.append(el); return; }
    else if (/^[-=_*]{3,}$/.test(line)) return;
    else { ul = null; el = document.createElement('p'); inline(el, line.replace(/^>\s?/, '')); }
    box.append(el);
  });
}
async function readerMode(t) {
  if (!t || t.type !== 'web' || !t.pane || !t.url) return;
  const url = t.url, f = t.pane.querySelector('iframe'), box = t.pane.querySelector('.rd');
  t.mode = 'reader'; if (t === active) setPressed(t);
  f.hidden = true; f.src = 'about:blank'; box.hidden = false; box.textContent = 'Loading reader view…';
  try {
    let title = '', md = '';
    try {
      const r = await fetch('https://r.jina.ai/' + url, { headers: JINA_KEY ? { Authorization: 'Bearer ' + JINA_KEY } : {} });
      if (!r.ok) throw 0;
      const raw = await r.text(), i = raw.indexOf('Markdown Content:');
      title = (raw.match(/^Title:\s*(.*)$/m) || [])[1] || hostOf(url);
      md = i >= 0 ? raw.slice(i + 17) : raw;
    } catch {
      const u = new URL(url); if (!/(^|\.)wikipedia\.org$/.test(u.hostname)) throw 0; // Wikipedia API fallback
      const n = decodeURIComponent(u.pathname.split('/wiki/')[1] || '');
      const r = await (await fetch(`https://${u.hostname}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(n)}`)).json();
      const p = Object.values(r.query.pages)[0]; title = p.title; md = (p.extract || '').replace(/\n/g, '\n\n');
    }
    if (isBlocked(title) || isBlocked(md.slice(0, 400))) { setType(t, 'home'); activate(t); return showBlocked(url); }
    if (t.mode !== 'reader' || t.url !== url) return; // user moved on
    t.title = title.slice(0, 40); renderStrip(); saveTabs(); box.textContent = '';
    const h1 = document.createElement('h1'); h1.textContent = title; box.append(h1);
    renderMd(box, md.slice(0, 60000), url); box.scrollTop = 0;
  } catch { box.textContent = 'Reader view could not load this page. The site may be unavailable. Try another source.'; }
}
async function runSearch(t, q) {
  if (t.type !== 'web') setType(t, 'web');
  t.mode = 'results'; t.url = ''; t.q = q; t.title = q; activate(t);
  const f = t.pane.querySelector('iframe'), box = t.pane.querySelector('.rd'); f.hidden = true; f.src = 'about:blank'; box.hidden = false; box.textContent = 'Searching…';
  const get = u => fetch(u).then(r => r.json()), enc = encodeURIComponent(q);
  const [jn, dd, wk] = await Promise.allSettled([
    JINA_KEY ? fetch('https://s.jina.ai/' + enc, { headers: { Accept: 'application/json', Authorization: 'Bearer ' + JINA_KEY } }).then(r => r.json()) : Promise.reject(),
    get('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + enc),
    get('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=10&format=json&origin=*&srsearch=' + enc)]);
  const R = [];
  if (jn.status === 'fulfilled') (jn.value.data || []).forEach(r => R.push({ t: r.title, u: r.url, s: r.description || '', src: 'Web' }));
  if (dd.status === 'fulfilled') { const d = dd.value;
    if (d.AbstractText && d.AbstractURL) R.push({ t: d.Heading || q, u: d.AbstractURL, s: d.AbstractText, src: 'DuckDuckGo', ans: 1 });
    (d.RelatedTopics || []).filter(x => x.FirstURL).slice(0, 4).forEach(x => R.push({ t: x.Text.split(' - ')[0], u: x.FirstURL, s: x.Text, src: 'DuckDuckGo' })); }
  if (wk.status === 'fulfilled') (wk.value.query?.search || []).forEach(r => R.push({ t: r.title, u: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')), s: new DOMParser().parseFromString(r.snippet, 'text/html').body.textContent + '…', src: 'Wikipedia' }));
  const ok = R.filter(r => r.u && !/(^|\.)duckduckgo\.com$/.test(hostOf(r.u)) && !isBlocked(r.u) && !isBlocked(r.t) && !isBlocked(r.s));
  if (t.mode !== 'results' || t.q !== q || !t.pane) return;
  box.innerHTML = `<h1>Results for “${esc(q)}”</h1>` + (ok.map(r => `<article class="res ${r.ans ? 'ans' : ''}"><a class="t" href="${esc(r.u)}" data-t="${esc(r.t)}">${esc(r.t)}</a><div class="u">${esc(r.src)} · ${esc(r.u)}</div><p>${esc(r.s)}</p></article>`).join('')
    || '<p class="muted">No results found. Try different words.</p>');
}

/* ---------- Study Tube (per tab) ---------- */
function tubePlay(t, p) {
  if (!t.pane) return; $('#banner').hidden = true;
  const src = p.video
    ? `https://www.youtube-nocookie.com/embed/${p.video}?rel=0&modestbranding=1&playsinline=1` + (p.list ? '&list=' + p.list : '')
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${p.list}&rel=0`;
  t.pane.querySelector('iframe').src = src; t.pane.querySelector('.tp').hidden = false;
  log('visit', '▶ YouTube ' + (p.video || 'playlist ' + p.list)); renderStrip();
}
async function tubeGo(t, q) {
  q = q.trim(); if (!q) return;
  const p = ytParse(q); if (p) return tubePlay(t, p);
  if (looksLikeUrl(q)) { if (isBlocked(q)) return showBlocked(q); const n = newTab(); return n && navigate(q); }
  if (ytBlocked(q)) return showBlocked(q);
  $('#banner').hidden = true; log('search', '▶ ' + q);
  const list = t.pane.querySelector('.tl'); list.innerHTML = '<p class="muted">Searching educational videos…</p>';
  for (const base of PIPED) {
    try {
      const d = await (await fetch(`${base}/search?filter=videos&q=${encodeURIComponent(q + ' educational lecture explained')}`)).json();
      const items = (d.items || []).map(v => ({ id: ((v.url || '').match(/v=([\w-]{11})/) || [])[1], t: v.title || '', by: v.uploaderName || '' }))
        .filter(v => v.id && !ytBlocked(v.t) && !ytBlocked(v.by)).slice(0, 10);
      list.innerHTML = items.map(v => `<button class="vres" data-v="${v.id}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"><span>${esc(v.t)}<small>${esc(v.by)}</small></span></button>`).join('')
        || '<p class="muted">No safe educational videos found. Try different words.</p>';
      return;
    } catch {}
  }
  list.innerHTML = '<p class="err">Video search is unavailable right now. Paste a YouTube link above to play it.</p>';
}

init();
