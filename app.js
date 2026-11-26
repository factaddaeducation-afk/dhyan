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
function logout() { closeViewer(); stopTube(); me = null; unlocked = false; localStorage.removeItem('dhyan_active_user'); showLogin(); }

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
  $('#results').hidden = true;
  log('blocked', q);
}

/* ---------- search ---------- */
const looksLikeUrl = s => !/\s/.test(s) && (/^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s));
function openSite(url, label) { openViewer(url, label); }
async function handleQuery(q) {
  q = q.trim(); if (!q) return;
  $('#banner').hidden = true;
  if (isBlocked(q)) return showBlocked(q);
  if (looksLikeUrl(q)) return openSite(/^https?:\/\//i.test(q) ? q : 'https://' + q);
  log('search', q);
  showTab('browse'); $('#home').hidden = true; $('#results').hidden = false;
  $('#rtitle').textContent = 'Results for "' + q + '"';
  const list = $('#rlist'); list.innerHTML = '<p class="muted">Searching…</p>';
  const [wiki, ddg] = await Promise.allSettled([
    fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=10&format=json&origin=*&srsearch=' + encodeURIComponent(q)).then(r => r.json()),
    fetch('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q)).then(r => r.json())
  ]);
  let html = '';
  if (ddg.status === 'fulfilled') {
    const d = ddg.value;
    if (d.AbstractText) html += card(d.Heading || q, d.AbstractURL, d.AbstractText, 'ans', 'Instant answer (DuckDuckGo)');
    (d.RelatedTopics || []).filter(t => t.FirstURL).slice(0, 4).forEach(t => html += card(t.Text.split(' - ')[0], t.FirstURL, t.Text, '', 'Related (DuckDuckGo)'));
  }
  if (wiki.status === 'fulfilled') {
    (wiki.value.query?.search || []).forEach(r => {
      const snip = new DOMParser().parseFromString(r.snippet, 'text/html').body.textContent;
      html += card(r.title, 'https://en.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')), snip + '…', '', 'Wikipedia');
    });
  }
  list.innerHTML = html || '<p class="muted">No results found. Try different words, or use the Google SafeSearch button above.</p>';
  if (wiki.status === 'rejected' && ddg.status === 'rejected') list.innerHTML = '<p class="err">Could not reach search services. Check your internet connection.</p>';
}
function card(title, url, text, cls, src) {
  if (isBlocked(url) || isBlocked(title)) return '';
  return `<article class="res ${cls}"><a class="t" href="${esc(url)}" data-t="${esc(title)}">${esc(title)}</a><div class="u">${esc(src)} · ${esc(url)}</div><p>${esc(text)}</p></article>`;
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
  $('#home').hidden = false; $('#results').hidden = true; $('#banner').hidden = true; $('#q').value = '';
  setLock(true); showTab('browse');
}
function init() {
  $('#factCards').innerHTML = FACT_CARDS.map(c => `<a class="fcard" href="${c[2]}" data-t="${esc(c[0])}">${esc(c[0])}<small>${esc(c[1])}</small></a>`).join('');
  $('#bookmarks').innerHTML = BOOKMARKS.map(b => `<a href="${b[1]}" data-t="${esc(b[0])}">${esc(b[0])}</a>`).join('');
  document.addEventListener('click', e => { const a = e.target.closest('a[data-t]'); if (a) { e.preventDefault(); openViewer(a.href, a.dataset.t); } });
  $('#tabBrowse').onclick = () => showTab('browse'); $('#tabTube').onclick = () => showTab('tube');
  $('#vHome').onclick = closeViewer; $('#vReload').onclick = () => openViewer(vUrl, null, true); $('#vReader').onclick = () => readerMode(vUrl);
  $('#vForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#vUrl').value.trim(); looksLikeUrl(v) ? openViewer(v) : (closeViewer(), handleQuery(v)); });
  $('#tubeForm').addEventListener('submit', e => { e.preventDefault(); tubeGo($('#tubeQ').value); });
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

/* ---------- In-app viewer (iframe + Reader Mode) ---------- */
let vUrl = '', vTimer = null;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
function openViewer(url, label, noLog) {
  url = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  if (isBlocked(url) || isBlocked(label || '')) { closeViewer(); return showBlocked(url); }
  const yt = ytParse(url);
  if (yt) { closeViewer(); showTab('tube'); return tubePlay(yt); }
  if (!noLog) log('visit', label ? label + ' (' + url + ')' : url);
  vUrl = url; $('#viewer').hidden = false; document.body.style.overflow = 'hidden'; $('#vUrl').value = url;
  if (/(^|\.)wikipedia\.org$/.test(hostOf(url))) return readerMode(url); // Wikipedia refuses iframes
  loadFrame(url);
}
function loadFrame(url) {
  clearTimeout(vTimer); $('#vReaderBox').hidden = true;
  const f = $('#vFrame'); f.hidden = false; let ok = false;
  f.onload = () => { ok = true; clearTimeout(vTimer); };
  f.src = 'about:blank'; setTimeout(() => f.src = url, 30);
  vTimer = setTimeout(() => { if (!ok) readerMode(url); }, 9000); // never loaded: fall back to Reader Mode
}
function closeViewer() { clearTimeout(vTimer); $('#vFrame').src = 'about:blank'; $('#viewer').hidden = true; document.body.style.overflow = ''; }
async function readerMode(url) {
  clearTimeout(vTimer); $('#vFrame').hidden = true;
  const box = $('#vReaderBox'); box.hidden = false; box.textContent = 'Loading reader view…';
  try {
    let title, text; const u = new URL(url);
    if (/(^|\.)wikipedia\.org$/.test(u.hostname)) {
      const t = decodeURIComponent(u.pathname.split('/wiki/')[1] || u.searchParams.get('title') || '');
      const r = await (await fetch(`https://${u.hostname}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(t)}`)).json();
      const p = Object.values(r.query.pages)[0]; title = p.title; text = p.extract || '';
    } else {
      const raw = await (await fetch('https://r.jina.ai/' + url, { headers: { Accept: 'text/plain' } })).text();
      title = (raw.match(/^Title:\s*(.*)$/m) || [])[1] || hostOf(url);
      text = raw.replace(/^(Title|URL Source|Published Time|Warning):.*$/gm, '').replace(/^Markdown Content:/m, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
    }
    if (isBlocked(title) || isBlocked(text.slice(0, 400))) { closeViewer(); return showBlocked(url); }
    box.textContent = '';
    const h1 = document.createElement('h1'); h1.textContent = title; box.append(h1);
    text.slice(0, 30000).split(/\n{2,}/).forEach(t => { if (t.trim()) { const p = document.createElement('p'); p.textContent = t.trim(); box.append(p); } });
  } catch { box.textContent = 'Reader view could not load this page. Try another source.'; }
}

/* ---------- Study Tube ---------- */
function showTab(t) {
  const tube = t === 'tube';
  $('#tube').hidden = !tube; $('#home').hidden = tube; $('#results').hidden = true;
  $('#tabBrowse').setAttribute('aria-selected', !tube); $('#tabTube').setAttribute('aria-selected', tube);
}
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
function tubePlay(p) {
  $('#banner').hidden = true;
  const src = p.video
    ? `https://www.youtube-nocookie.com/embed/${p.video}?rel=0&modestbranding=1&playsinline=1` + (p.list ? '&list=' + p.list : '')
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${p.list}&rel=0`;
  $('#tubeFrame').src = src; $('#tubePlayer').hidden = false;
  log('visit', '▶ YouTube ' + (p.video || 'playlist ' + p.list));
}
function stopTube() { const f = $('#tubeFrame'); if (f) f.src = 'about:blank'; }
const PIPED = ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee', 'https://pipedapi.adminforge.de'];
async function tubeGo(q) {
  q = q.trim(); if (!q) return;
  const p = ytParse(q);
  if (p) return tubePlay(p);
  if (looksLikeUrl(q)) return openViewer(q);
  if (ytBlocked(q)) return showBlocked(q);
  $('#banner').hidden = true; log('search', '▶ ' + q);
  const list = $('#tubeList'); list.innerHTML = '<p class="muted">Searching educational videos…</p>';
  for (const base of PIPED) {
    try {
      const d = await (await fetch(`${base}/search?filter=videos&q=${encodeURIComponent(q + ' educational lecture explained')}`)).json();
      const items = (d.items || []).map(v => ({ id: ((v.url || '').match(/v=([\w-]{11})/) || [])[1], t: v.title || '', by: v.uploaderName || '' }))
        .filter(v => v.id && !ytBlocked(v.t) && !ytBlocked(v.by)).slice(0, 10);
      list.innerHTML = items.map(v => `<button class="vres" data-v="${v.id}"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg"><span>${esc(v.t)}<small>${esc(v.by)}</small></span></button>`).join('')
        || '<p class="muted">No safe educational videos found. Try different words.</p>';
      list.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { tubePlay({ video: b.dataset.v, list: '' }); scrollTo({ top: 0, behavior: 'smooth' }); } };
      return;
    } catch {}
  }
  list.innerHTML = '<p class="err">Video search is unavailable right now. Paste a YouTube link above to play it.</p>';
}

init();
