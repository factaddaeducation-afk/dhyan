/* Dhyan Surf – app logic
   No backend. Everything is stored in this browser's localStorage. */
(function () {
  'use strict';

  /* =====================================================================
     CONFIG – edit this block to customise the app
     ===================================================================== */
  var CONFIG = {
    // Fact Adda E-Learning base address.
    // Replace each "url" below with the exact page address for that lab.
    FACT_ADDA_URL: 'https://pages.dev',
    SHORTCUTS: [
      { icon: '🎓', title: 'Fact Adda E-Learning', desc: 'Lessons, notes and practice for school students.', url: 'https://pages.dev', featured: true },
      { icon: '📘', title: 'NCERT Solutions', desc: 'Chapter-wise answers and explanations.', url: 'https://pages.dev' },
      { icon: '🔬', title: 'Digital Science Lab', desc: 'Virtual experiments and simulations.', url: 'https://pages.dev' },
      { icon: '📐', title: 'Digital Maths Lab', desc: 'Visual, hands-on maths activities.', url: 'https://pages.dev' },
      { icon: '🚀', title: 'Space Lab', desc: 'Explore planets, stars and space missions.', url: 'https://pages.dev' }
    ],
    UNLOCK_MS: 2 * 60 * 1000,        // history stays open this long after unlocking
    IDLE_LOGOUT_MS: 15 * 60 * 1000,  // auto log-out on shared computers
    MAX_HISTORY: 500,
    MIN_PASSWORD: 4,
    SEARCH_URL: 'https://www.google.com/search'
  };

  var KEY_PROFILES = 'dhyansurf.profiles.v1';
  var KEY_HISTORY = 'dhyansurf.history.v1.';
  var KEY_SESSION = 'dhyansurf.session.v1';

  /* =====================================================================
     Small helpers
     ===================================================================== */
  function $(id) { return document.getElementById(id); }

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function ssGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function ssRemove(key) {
    try { window.sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function readJSON(key, fallback) {
    var raw = lsGet(key);
    if (!raw) return fallback;
    try {
      var data = JSON.parse(raw);
      return Array.isArray(fallback) && !Array.isArray(data) ? fallback : data;
    } catch (e) { return fallback; }
  }

  function normaliseName(name) {
    return String(name || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
  function profileId(name) { return normaliseName(name).toLowerCase(); }

  function randomHex(bytes) {
    var arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return toHex(arr);
  }
  function toHex(buf) {
    var arr = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
    return out;
  }
  function sha256(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(toHex);
  }
  // Salted SHA-256, so identical passwords do not produce identical hashes.
  function hashPassword(salt, password) { return sha256(salt + ':' + password); }
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  var toastTimer = null;
  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // Slows down password guessing (in memory – resets on reload).
  var limiter = { fails: 0, until: 0 };
  function limiterWait() {
    var left = Math.ceil((limiter.until - Date.now()) / 1000);
    return left > 0 ? left : 0;
  }
  function limiterFail() {
    limiter.fails += 1;
    if (limiter.fails >= 5) {
      limiter.until = Date.now() + Math.min(60, 5 * (limiter.fails - 4)) * 1000;
    }
  }
  function limiterReset() { limiter.fails = 0; limiter.until = 0; }

  /* =====================================================================
     Profiles
     ===================================================================== */
  function getProfiles() { return readJSON(KEY_PROFILES, []); }
  function saveProfiles(list) { return lsSet(KEY_PROFILES, JSON.stringify(list)); }
  function findProfile(id) {
    var list = getProfiles();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var currentId = null;

  function validateCredentials(name, password) {
    if (name.length < 2) return 'Enter a name with at least 2 characters.';
    if (name.length > 40) return 'Use a name with 40 characters or fewer.';
    if (!password || password.length < CONFIG.MIN_PASSWORD) {
      return 'Password must have at least ' + CONFIG.MIN_PASSWORD + ' characters.';
    }
    return '';
  }

  function setLoginMsg(text, ok) {
    var el = $('loginMsg');
    el.textContent = text || '';
    el.className = 'msg' + (ok ? ' ok' : '');
  }

  function cryptoReady() {
    if (!window.crypto || !crypto.subtle) {
      setLoginMsg('This page must be opened over https (or localhost) to log in securely.');
      return false;
    }
    return true;
  }

  function doLogin() {
    var name = normaliseName($('loginName').value);
    var password = $('loginPass').value;
    if (!cryptoReady()) return;

    var wait = limiterWait();
    if (wait) { setLoginMsg('Too many tries. Please wait ' + wait + ' seconds.'); return; }

    var err = validateCredentials(name, password);
    if (err) { setLoginMsg(err); return; }

    var profile = findProfile(profileId(name));
    if (!profile) {
      setLoginMsg('No profile with that name on this computer. Choose Create profile.');
      return;
    }
    hashPassword(profile.salt, password).then(function (hash) {
      if (safeEqual(hash, profile.hash)) {
        limiterReset();
        startSession(profile);
      } else {
        limiterFail();
        setLoginMsg('Wrong password. Try again.');
        $('loginPass').select();
      }
    });
  }

  function doCreate() {
    var name = normaliseName($('loginName').value);
    var password = $('loginPass').value;
    if (!cryptoReady()) return;

    var err = validateCredentials(name, password);
    if (err) { setLoginMsg(err); return; }
    if (findProfile(profileId(name))) {
      setLoginMsg('That name is already used on this computer. Log in or pick another name.');
      return;
    }
    var salt = randomHex(16);
    hashPassword(salt, password).then(function (hash) {
      var list = getProfiles();
      var profile = { id: profileId(name), name: name, salt: salt, hash: hash, created: Date.now() };
      list.push(profile);
      if (!saveProfiles(list)) {
        setLoginMsg('Could not save your profile. Check that browser storage is allowed.');
        return;
      }
      startSession(profile);
      toast('Profile created. Welcome, ' + profile.name + '!');
    });
  }

  function renderProfileChips() {
    var list = getProfiles();
    var wrap = $('profileChips');
    wrap.textContent = '';
    $('profilePicker').hidden = list.length === 0;
    list.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = p.name;
      b.addEventListener('click', function () {
        $('loginName').value = p.name;
        $('loginPass').focus();
      });
      wrap.appendChild(b);
    });
  }

  /* =====================================================================
     Session & views
     ===================================================================== */
  function showLogin() {
    $('appView').hidden = true;
    $('loginView').hidden = false;
    $('loginPass').value = '';
    setLoginMsg('');
    renderProfileChips();
    var first = $('loginName');
    if (!first.value) first.focus(); else $('loginPass').focus();
  }

  function startSession(profile) {
    currentId = profile.id;
    ssSet(KEY_SESSION, profile.id);
    $('loginPass').value = '';
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('userChip').textContent = profile.name;
    $('userChip').title = 'Logged in as ' + profile.name;
    lockHistory();
    hideBlock();
    $('searchInput').value = '';
    resetIdleTimer();
    $('searchInput').focus();
  }

  function logout(message) {
    currentId = null;
    ssRemove(KEY_SESSION);
    lockHistory();
    clearTimeout(idleTimer);
    $('loginName').value = '';
    showLogin();
    if (message) setLoginMsg(message, true);
  }

  var idleTimer = null;
  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (!currentId) return;
    idleTimer = setTimeout(function () {
      logout('You were logged out because the computer was idle.');
    }, CONFIG.IDLE_LOGOUT_MS);
  }

  /* =====================================================================
     Safe-search filter
     ===================================================================== */

  // Each list holds whole words or phrases (lowercase). A match needs the
  // complete word or phrase, so "Essex" or "sextant" are not blocked.
  var BLOCKLIST = {
    adult: [
      'porn', 'porno', 'pornos', 'pornography', 'pornographic', 'pornstar', 'pornstars', 'pornhub',
      'xxx', 'xnxx', 'xvideos', 'xhamster', 'redtube', 'youporn', 'brazzers', 'bangbros',
      'chaturbate', 'stripchat', 'onlyfans', 'hentai', 'nsfw', 'erotic', 'erotica',
      'sex', 'sexy', 'sexting', 'sexcam', 'sexvideo', 'sexvideos', 'nude', 'nudes', 'nudity', 'naked',
      'topless', 'boobs', 'boob', 'pussy', 'blowjob', 'handjob', 'orgy', 'fetish', 'milf',
      'hooker', 'stripper', 'striptease', 'camgirl', 'callgirl',
      'cam girl', 'call girl', 'adult video', 'adult videos', 'adult movie', 'adult movies',
      'blue film', 'bf video', 'bf videos', 'bf film', 'bf movie',
      'chudai', 'chut', 'gaand', 'bhosdi', 'bhosda', 'madarchod', 'behenchod',
      'nangi', 'nanga photo'
    ],
    gambling: [
      'gambling', 'gamble', 'gambler', 'casino', 'casinos', 'poker', 'blackjack', 'roulette',
      'bet', 'bets', 'betting', 'bettor', 'bookie', 'bookmaker', 'sportsbook',
      'bet365', 'betway', '1xbet', 'parimatch', 'dream11', 'rummy', 'satta', 'sattamatka',
      'slot machine', 'slot machines', 'online slots', 'online lottery', 'teen patti', 'andar bahar',
      'satta matka', 'online casino', 'online betting'
    ],
    harmful: [
      'cocaine', 'heroin', 'mdma', 'buy drugs', 'drug dealer', 'how to make drugs',
      'make bomb', 'make a bomb', 'build a bomb', 'bomb making', 'how to make explosives',
      'how to make a weapon', 'buy a gun', 'buy guns', 'beheading video', 'snuff film',
      'hack account', 'hack instagram', 'hack facebook', 'hack whatsapp'
    ],
    selfharm: [
      'suicide method', 'suicide methods', 'how to commit suicide', 'kill myself', 'end my life',
      'self harm', 'selfharm', 'cut myself', 'hurt myself'
    ]
  };

  // Long, unmistakable terms that are also caught when typed one letter at a
  // time, e.g. "p o r n" or "p.o.r.n".
  var STRONG_SQUASHED = [
    'porn', 'xvideos', 'xnxx', 'xhamster', 'hentai', 'redtube', 'youporn',
    'chaturbate', 'stripchat', 'brazzers', 'bangbros', 'onlyfans', 'gambling', 'sattamatka'
  ];

  // Normal school topics that contain a blocked word.
  var ALLOWED_PHRASES = [
    'sexual reproduction', 'asexual reproduction', 'sex ratio', 'sex determination',
    'sex chromosome', 'sex chromosomes', 'sex linked', 'sex linked inheritance',
    'naked eye', 'naked seed', 'naked seeds', 'naked singularity', 'naked mole rat'
  ];

  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function stripMarks(text) {
    return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function wordsOnly(text) {
    return ' ' + text.replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }
  function leetDecode(text) {
    return text.replace(/[013457@$!]/g, function (c) { return LEET[c] || c; });
  }
  function containsTerm(padded, term) {
    return padded.indexOf(' ' + term + ' ') !== -1;
  }

  function removeAllowed(padded) {
    ALLOWED_PHRASES.forEach(function (phrase) {
      var needle = ' ' + phrase + ' ';
      while (padded.indexOf(needle) !== -1) padded = padded.replace(needle, ' ');
    });
    return padded;
  }

  // Returns a category name ("adult", "gambling", "harmful", "selfharm") or null.
  function checkQuery(query) {
    var base = stripMarks(query);
    var variants = [
      removeAllowed(wordsOnly(base)),
      removeAllowed(wordsOnly(leetDecode(base)))
    ];
    var cats = Object.keys(BLOCKLIST);
    var i, j, k;
    for (i = 0; i < cats.length; i++) {
      var terms = BLOCKLIST[cats[i]];
      for (j = 0; j < terms.length; j++) {
        for (k = 0; k < variants.length; k++) {
          if (containsTerm(variants[k], terms[j])) return cats[i];
        }
      }
    }
    // Letters spaced out one by one, e.g. "p o r n" or "p.o.r.n".
    var tokens = variants[1].trim().split(' ');
    var runs = [];
    var run = '';
    tokens.forEach(function (t) {
      if (t.length === 1) { run += t; } else { if (run) runs.push(run); run = ''; }
    });
    if (run) runs.push(run);
    for (i = 0; i < runs.length; i++) {
      for (j = 0; j < STRONG_SQUASHED.length; j++) {
        if (runs[i].indexOf(STRONG_SQUASHED[j]) !== -1) {
          return STRONG_SQUASHED[j] === 'gambling' || STRONG_SQUASHED[j] === 'sattamatka' ? 'gambling' : 'adult';
        }
      }
    }
    return null;
  }

  var BLOCK_MESSAGES = {
    adult: ['This search is blocked', 'Dhyan Surf is for learning, so adult content is not allowed. Try searching for a school topic instead.'],
    gambling: ['This search is blocked', 'Gambling and betting are not allowed on Dhyan Surf. Try searching for a school topic instead.'],
    harmful: ['This search is blocked', 'Searches that could lead to harm are not allowed. Try searching for a school topic instead.'],
    selfharm: ['You are not alone', 'If you are feeling low or unsafe, please talk to a parent, teacher or another adult you trust right now. In India you can call Tele-MANAS on 14416 (toll-free) or Childline on 1098.']
  };

  function showBlock(category) {
    var msg = BLOCK_MESSAGES[category] || BLOCK_MESSAGES.harmful;
    $('blockTitle').textContent = msg[0];
    $('blockText').textContent = msg[1];
    $('blockAlert').hidden = false;
  }
  function hideBlock() { $('blockAlert').hidden = true; }

  /* =====================================================================
     Search + history
     ===================================================================== */
  function historyKey() { return KEY_HISTORY + encodeURIComponent(currentId); }
  function getHistory() { return readJSON(historyKey(), []); }
  function saveHistory(list) { return lsSet(historyKey(), JSON.stringify(list.slice(0, CONFIG.MAX_HISTORY))); }

  function addHistory(entry) {
    var list = getHistory();
    entry.id = randomHex(6);
    entry.t = Date.now();
    list.unshift(entry);
    saveHistory(list);
    if (historyUnlocked()) renderHistory();
  }

  function buildSearchUrl(query, type) {
    var url = CONFIG.SEARCH_URL + '?q=' + encodeURIComponent(query) + '&safe=active';
    if (type === 'images') url += '&tbm=isch';
    else if (type === 'videos') url += '&tbm=vid';
    return url;
  }

  function selectedType() {
    var el = document.querySelector('input[name="searchType"]:checked');
    return el ? el.value : 'web';
  }

  function runSearch(rawQuery, type) {
    var query = String(rawQuery || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!query) { $('searchInput').focus(); return; }

    var category = checkQuery(query);
    if (category) {
      addHistory({ q: query, type: type, blocked: true, category: category });
      showBlock(category);
      $('searchInput').value = '';
      return;
    }
    hideBlock();
    addHistory({ q: query, type: type, blocked: false });
    // Opened straight from the click, so pop-up blockers allow it.
    var win = window.open(buildSearchUrl(query, type), '_blank', 'noopener,noreferrer');
    if (!win) toast('Your browser blocked the new tab. Allow pop-ups for this app.');
  }

  /* ---------- History lock ---------- */
  var unlockedUntil = 0;
  var lockTimer = null;

  function historyUnlocked() { return currentId && Date.now() < unlockedUntil; }

  function unlockHistory() {
    unlockedUntil = Date.now() + CONFIG.UNLOCK_MS;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(function () {
      lockHistory();
      toast('History locked again.');
    }, CONFIG.UNLOCK_MS);
    $('historyLocked').hidden = true;
    $('historyOpen').hidden = false;
    $('clearHistoryBtn').hidden = false;
    $('lockHistoryBtn').hidden = false;
    renderHistory();
  }

  function lockHistory() {
    unlockedUntil = 0;
    clearTimeout(lockTimer);
    $('historyLocked').hidden = false;
    $('historyOpen').hidden = true;
    $('clearHistoryBtn').hidden = true;
    $('lockHistoryBtn').hidden = true;
    $('historyList').textContent = '';
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  var TYPE_LABEL = { web: 'Web', images: 'Images', videos: 'Videos' };

  function renderHistory() {
    var list = getHistory();
    var ul = $('historyList');
    ul.textContent = '';
    $('historyEmpty').hidden = list.length > 0;
    $('clearHistoryBtn').disabled = list.length === 0;

    list.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'history-item' + (item.blocked ? ' blocked' : '');

      var tag = document.createElement('span');
      tag.className = 'tag' + (item.blocked ? ' red' : '');
      tag.textContent = item.blocked ? 'Blocked' : (TYPE_LABEL[item.type] || 'Web');
      li.appendChild(tag);

      var main = document.createElement('div');
      main.className = 'history-main';
      var q = document.createElement('div');
      q.className = 'history-q';
      q.textContent = item.q;
      var meta = document.createElement('div');
      meta.className = 'history-meta';
      meta.textContent = formatTime(item.t) + (item.blocked ? ' · Blocked by safe search' : '');
      main.appendChild(q);
      main.appendChild(meta);
      li.appendChild(main);

      if (!item.blocked) {
        var again = document.createElement('button');
        again.type = 'button';
        again.className = 'icon-btn';
        again.textContent = 'Search again';
        again.addEventListener('click', function () { runSearch(item.q, item.type); });
        li.appendChild(again);
      }

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn del';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete this entry: ' + item.q);
      del.addEventListener('click', function () {
        if (!historyUnlocked()) { lockHistory(); return; }
        saveHistory(getHistory().filter(function (h) { return h.id !== item.id; }));
        renderHistory();
      });
      li.appendChild(del);

      ul.appendChild(li);
    });
  }

  function clearAllHistory() {
    if (!historyUnlocked()) { lockHistory(); return; }
    if (!window.confirm('Delete all of your search history? This cannot be undone.')) return;
    saveHistory([]);
    renderHistory();
    toast('History deleted.');
  }

  /* ---------- Password dialog ---------- */
  function openUnlockDialog() {
    var dlg = $('unlockDialog');
    $('unlockPass').value = '';
    $('unlockMsg').textContent = '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('unlockPass').focus();
  }
  function closeUnlockDialog() {
    var dlg = $('unlockDialog');
    $('unlockPass').value = '';
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  function submitUnlock() {
    var profile = currentId && findProfile(currentId);
    if (!profile) { logout(); return; }
    var wait = limiterWait();
    if (wait) { $('unlockMsg').textContent = 'Too many tries. Please wait ' + wait + ' seconds.'; return; }

    var password = $('unlockPass').value;
    if (!password) { $('unlockMsg').textContent = 'Enter your password.'; return; }

    hashPassword(profile.salt, password).then(function (hash) {
      if (safeEqual(hash, profile.hash)) {
        limiterReset();
        closeUnlockDialog();
        unlockHistory();
      } else {
        limiterFail();
        $('unlockMsg').textContent = 'Wrong password. Try again.';
        $('unlockPass').select();
      }
    });
  }

  /* =====================================================================
     Shortcuts
     ===================================================================== */
  function renderShortcuts() {
    var grid = $('shortcutGrid');
    grid.textContent = '';
    CONFIG.SHORTCUTS.forEach(function (s) {
      var a = document.createElement('a');
      a.className = 'shortcut' + (s.featured ? ' featured' : '');
      a.href = s.url || CONFIG.FACT_ADDA_URL;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      var icon = document.createElement('span');
      icon.className = 'shortcut-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = s.icon;

      var text = document.createElement('span');
      text.className = 'shortcut-text';
      var title = document.createElement('span');
      title.className = 'shortcut-title';
      title.textContent = s.title;
      var desc = document.createElement('span');
      desc.className = 'shortcut-desc';
      desc.textContent = s.desc;
      text.appendChild(title);
      text.appendChild(desc);

      a.appendChild(icon);
      a.appendChild(text);
      grid.appendChild(a);
    });
  }

  /* =====================================================================
     PWA: install button, offline bar, service worker
     ===================================================================== */
  var deferredInstall = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    $('installBtn').hidden = false;
  });
  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    $('installBtn').hidden = true;
    toast('Dhyan Surf is installed.');
  });

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  function onInstallClick() {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () {
        deferredInstall = null;
        $('installBtn').hidden = true;
      });
    } else if (isIOS()) {
      toast('Tap Share, then Add to Home Screen.');
    }
  }

  function updateOnline() { $('offlineBar').hidden = navigator.onLine !== false; }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* app still works online */ });
    });
  }

  /* =====================================================================
     Wire everything up
     ===================================================================== */
  function init() {
    renderShortcuts();

    $('loginForm').addEventListener('submit', function (e) { e.preventDefault(); doLogin(); });
    $('createBtn').addEventListener('click', doCreate);
    $('logoutBtn').addEventListener('click', function () { logout('You are logged out.'); });

    $('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      runSearch($('searchInput').value, selectedType());
    });
    $('searchInput').addEventListener('input', hideBlock);

    $('unlockBtn').addEventListener('click', openUnlockDialog);
    $('unlockForm').addEventListener('submit', function (e) { e.preventDefault(); submitUnlock(); });
    $('unlockCancel').addEventListener('click', closeUnlockDialog);
    $('lockHistoryBtn').addEventListener('click', lockHistory);
    $('clearHistoryBtn').addEventListener('click', clearAllHistory);

    $('installBtn').addEventListener('click', onInstallClick);
    if (isIOS() && !isStandalone()) $('installBtn').hidden = false;

    ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, resetIdleTimer, { passive: true });
    });
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    // Restore an open session (cleared when the tab or app closes).
    var saved = ssGet(KEY_SESSION);
    var profile = saved ? findProfile(saved) : null;
    if (profile) startSession(profile); else showLogin();

    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
