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
  'gore','beheading','snuff','how to make a bomb','buy drugs','buy weed','suicide method'
];
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
  me = k; sessionStorage.setItem('ds_cur', k);
  showApp();
}
function logout() { me = null; unlocked = false; sessionStorage.removeItem('ds_cur'); showLogin(); }

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
function openSite(url, label) {
  if (isBlocked(url)) return showBlocked(url);
  log('visit', label || url);
  window.open(url, '_blank', 'noopener,noreferrer');
}
async function handleQuery(q) {
  q = q.trim(); if (!q) return;
  $('#banner').hidden = true;
  if (isBlocked(q)) return showBlocked(q);
  if (looksLikeUrl(q)) return openSite(/^https?:\/\//i.test(q) ? q : 'https://' + q);
  log('search', q);
  $('#home').hidden = true; $('#results').hidden = false;
  $('#rtitle').textContent = 'Results for "' + q + '"';
  $('#gsafe').href = 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&safe=active';
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
  return `<article class="res ${cls}"><a class="t" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-t="${esc(title)}">${esc(title)}</a><div class="u">${esc(src)} · ${esc(url)}</div><p>${esc(text)}</p></article>`;
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
  setLock(true);
}
function init() {
  $('#factCards').innerHTML = FACT_CARDS.map(c => `<a class="fcard" href="${c[2]}" target="_blank" rel="noopener noreferrer" data-t="${esc(c[0])}">${esc(c[0])}<small>${esc(c[1])}</small></a>`).join('');
  $('#bookmarks').innerHTML = BOOKMARKS.map(b => `<a href="${b[1]}" target="_blank" rel="noopener noreferrer" data-t="${esc(b[0])}">${esc(b[0])}</a>`).join('');
  document.addEventListener('click', e => { const a = e.target.closest('a[data-t]'); if (a) log('visit', a.dataset.t + ' (' + a.href + ')'); });
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
  const cur = sessionStorage.getItem('ds_cur');
  if (cur && users()[cur]) { me = cur; showApp(); } else showLogin();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
