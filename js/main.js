/* Bootstrap: the setup screen, preference persistence, and the bits of chrome
   that live outside the board (rules panel, mute, score reset). */
(function (global) {
  'use strict';

  var STT = global.STT;
  var Glyphs = STT.Glyphs;
  var FX = STT.Effects;
  var UI = STT.UI;

  var KEY = 'superTicTacToe.prefs.v1';

  var DEFAULTS = {
    variant: 'super',
    mode: 'friend',
    difficulty: 'medium',
    first: 'you',
    muted: false,
    iosHintSeen: false,
    score: { P1: 0, P2: 0, draws: 0 },
    p1: { name: 'Player 1', symbol: 'cross', color: '#22E8FF', tab: 'icon' },
    p2: { name: 'Player 2', symbol: 'circle', color: '#FF4FD8', tab: 'icon' }
  };

  var prefs;

  function $(id) { return document.getElementById(id); }

  function load() {
    prefs = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        ['variant', 'mode', 'difficulty', 'first', 'muted', 'iosHintSeen'].forEach(function (k) {
          if (saved[k] !== undefined) prefs[k] = saved[k];
        });
        if (saved.score) prefs.score = saved.score;
        ['p1', 'p2'].forEach(function (k) {
          if (saved[k]) {
            Object.keys(prefs[k]).forEach(function (f) {
              if (saved[k][f] !== undefined) prefs[k][f] = saved[k][f];
            });
          }
        });
      }
    } catch (e) { /* private mode, corrupt JSON — defaults are fine */ }

    /* Never let a bad restore leave both players looking identical. */
    if (prefs.p1.symbol === prefs.p2.symbol) prefs.p2.symbol = DEFAULTS.p2.symbol;
    if (prefs.p1.symbol === prefs.p2.symbol) prefs.p1.symbol = DEFAULTS.p1.symbol;
    if (prefs.p1.color === prefs.p2.color) prefs.p2.color = DEFAULTS.p2.color;
    if (prefs.p1.color === prefs.p2.color) prefs.p1.color = DEFAULTS.p1.color;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  /* ---- setup screen ---- */

  function renderPanel(key) {
    var p = prefs[key];
    var rival = prefs[key === 'p1' ? 'p2' : 'p1'];
    var panel = $('panel' + key);
    panel.style.setProperty('--seat', p.color);

    $(key + 'Name').value = p.name;
    $(key + 'Seat').textContent = prefs.mode === 'bot'
      ? (key === 'p1' ? 'You' : 'The bot')
      : (key === 'p1' ? 'Player one' : 'Player two');

    var preview = $(key + 'Preview');
    preview.innerHTML = '';
    preview.style.setProperty('--c', p.color);
    preview.appendChild(Glyphs.node(p.symbol));

    panel.querySelectorAll('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.tab === p.tab));
    });

    var grid = $(key + 'Symbols');
    grid.innerHTML = '';
    (p.tab === 'emoji' ? Glyphs.EMOJI : Glyphs.ICONS).forEach(function (g) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'symbol-btn';
      btn.title = g.name;
      btn.setAttribute('aria-label', g.name);
      btn.setAttribute('aria-pressed', String(p.symbol === g.id));
      btn.style.setProperty('--c', p.color);
      if (rival.symbol === g.id) {
        btn.disabled = true;
        btn.classList.add('taken');
      }
      btn.appendChild(Glyphs.node(g.id));
      btn.addEventListener('click', function () {
        p.symbol = g.id;
        FX.sound.click();
        renderAll();
        save();
      });
      grid.appendChild(btn);
    });

    var row = $(key + 'Colors');
    row.innerHTML = '';
    Glyphs.COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-btn';
      btn.style.setProperty('--sw', c.hex);
      btn.title = c.id;
      btn.setAttribute('aria-label', c.id + ' colour');
      btn.setAttribute('aria-pressed', String(p.color === c.hex));
      if (rival.color === c.hex) btn.disabled = true;
      btn.addEventListener('click', function () {
        p.color = c.hex;
        FX.sound.click();
        renderAll();
        save();
      });
      row.appendChild(btn);
    });
  }

  function renderDifficulty() {
    var row = $('difficultyRow');
    row.innerHTML = '';
    STT.Bot.LEVELS.forEach(function (level) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt-btn';
      btn.setAttribute('aria-pressed', String(prefs.difficulty === level.id));
      var name = document.createElement('span');
      name.textContent = level.name;
      var blurb = document.createElement('small');
      blurb.textContent = level.blurb;
      btn.appendChild(name);
      btn.appendChild(blurb);
      btn.addEventListener('click', function () {
        prefs.difficulty = level.id;
        FX.sound.click();
        renderAll();
        save();
      });
      row.appendChild(btn);
    });
  }

  function renderVariants() {
    var row = $('variantRow');
    row.innerHTML = '';
    STT.Variants.LIST.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-card';
      btn.dataset.variant = v.id;
      btn.setAttribute('aria-pressed', String(prefs.variant === v.id));

      [['mode-icon', v.icon], ['mode-name', v.name], ['mode-blurb', v.blurb]]
        .forEach(function (pair) {
          var el = document.createElement('div');
          el.className = pair[0];
          el.textContent = pair[1];
          btn.appendChild(el);
        });

      btn.addEventListener('click', function () {
        prefs.variant = v.id;
        FX.sound.click();
        renderAll();
        save();
      });
      row.appendChild(btn);
    });
  }

  function renderAll() {
    renderVariants();

    var variant = STT.Variants.get(prefs.variant);
    $('subtitle').textContent = variant.tagline;
    /* The rules panel carries a section per board shape. */
    $('rulesSuper').classList.toggle('hidden', variant.boards === 1);
    $('rulesClassic').classList.toggle('hidden', variant.boards !== 1);

    document.querySelectorAll('#modeRow .mode-card').forEach(function (card) {
      card.setAttribute('aria-pressed', String(card.dataset.mode === prefs.mode));
    });
    $('botOptions').classList.toggle('hidden', prefs.mode !== 'bot');

    document.querySelectorAll('#firstRow .opt-btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.first === prefs.first));
    });

    renderPanel('p1');
    renderPanel('p2');
    renderDifficulty();
  }

  /* Swap the placeholder names when the mode changes, but never overwrite a
     name the player actually typed. */
  function setMode(mode) {
    prefs.mode = mode;
    if (mode === 'bot') {
      if (prefs.p1.name === 'Player 1') prefs.p1.name = 'You';
      if (prefs.p2.name === 'Player 2') prefs.p2.name = 'Robo';
    } else {
      if (prefs.p1.name === 'You') prefs.p1.name = 'Player 1';
      if (prefs.p2.name === 'Robo') prefs.p2.name = 'Player 2';
    }
    FX.sound.click();
    renderAll();
    save();
  }

  function showSetup() {
    $('game').classList.add('hidden');
    $('setup').classList.remove('hidden');
    renderAll();
  }

  function startGame() {
    prefs.p1.name = ($('p1Name').value || '').trim() || 'Player 1';
    prefs.p2.name = ($('p2Name').value || '').trim() ||
      (prefs.mode === 'bot' ? 'Robo' : 'Player 2');
    save();

    var cfg = {
      variant: prefs.variant,
      mode: prefs.mode,
      difficulty: prefs.difficulty,
      firstMode: prefs.first,
      botSeat: prefs.mode === 'bot' ? 'P2' : null,
      P1: { name: prefs.p1.name, symbol: prefs.p1.symbol, color: prefs.p1.color },
      P2: { name: prefs.p2.name, symbol: prefs.p2.symbol, color: prefs.p2.color }
    };

    $('setup').classList.add('hidden');
    $('game').classList.remove('hidden');
    UI.setScore(prefs.score);
    UI.start(cfg);
  }

  /* ---- chrome ---- */

  function openRules() {
    var panel = $('rulesPanel');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    $('rulesClose').focus();
  }

  function closeRules() {
    var panel = $('rulesPanel');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function applyMute() {
    FX.setMuted(prefs.muted);
    var btn = $('muteBtn');
    btn.textContent = prefs.muted ? '🔇 Muted' : '🔊 Sound';
    btn.setAttribute('aria-pressed', String(prefs.muted));
  }

  /* ---- installing and sharing ---- */

  var deferredPrompt = null;

  function isStandalone() {
    return window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
  }

  function setupInstall() {
    var installBtn = $('installBtn');

    /* Android/Chrome fires this instead of showing its own banner, so we stash
       it and offer the install from our own button. */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        installBtn.classList.add('hidden');
      });
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      installBtn.classList.add('hidden');
    });

    /* iOS offers no install API at all, so the only option is pointing at the
       Share menu. Show it once, and never again once dismissed. */
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iOS && !isStandalone() && !prefs.iosHintSeen) {
      $('iosHint').classList.remove('hidden');
    }

    $('iosHintClose').addEventListener('click', function () {
      $('iosHint').classList.add('hidden');
      prefs.iosHintSeen = true;
      save();
    });
  }

  function setupShare() {
    var btn = $('shareBtn');
    btn.addEventListener('click', function () {
      FX.sound.click();
      var url = location.href;

      if (navigator.share) {
        navigator.share({
          title: 'Super Tic Tac Toe',
          text: 'Come and play Super Tic Tac Toe',
          url: url
        }).catch(function () { /* the user just cancelled the sheet */ });
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          var was = btn.textContent;
          btn.textContent = '✓ Link copied';
          setTimeout(function () { btn.textContent = was; }, 1600);
        }).catch(function () { /* clipboard blocked; nothing useful to do */ });
      }
    });
  }

  /* Service workers need a secure context and are unavailable over file://,
     where registering throws — and double-clicking index.html has to keep
     working, so this quietly does nothing there. */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        if (window.console) console.warn('offline cache unavailable:', err);
      });
    });
  }

  /* ---- wiring ---- */

  function wire() {
    document.querySelectorAll('#modeRow .mode-card').forEach(function (card) {
      card.addEventListener('click', function () { setMode(card.dataset.mode); });
    });

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        prefs[tab.dataset.panel].tab = tab.dataset.tab;
        FX.sound.click();
        renderAll();
        save();
      });
    });

    document.querySelectorAll('#firstRow .opt-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        prefs.first = btn.dataset.first;
        FX.sound.click();
        renderAll();
        save();
      });
    });

    ['p1', 'p2'].forEach(function (key) {
      $(key + 'Name').addEventListener('input', function (e) {
        prefs[key].name = e.target.value;
        save();
      });
    });

    $('startBtn').addEventListener('click', startGame);
    $('setupRulesBtn').addEventListener('click', openRules);
    $('rulesBtn').addEventListener('click', openRules);
    $('rulesClose').addEventListener('click', closeRules);

    $('muteBtn').addEventListener('click', function () {
      prefs.muted = !prefs.muted;
      applyMute();
      save();
      FX.sound.click();
    });

    $('resetScoreBtn').addEventListener('click', function () {
      UI.resetScore();
      FX.sound.click();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeRules();
    });
  }

  function boot() {
    load();
    FX.init($('fx'));
    applyMute();

    UI.init({
      onExit: showSetup,
      onScore: function (s) {
        prefs.score = { P1: s.P1, P2: s.P2, draws: s.draws };
        save();
      }
    });

    wire();
    setupInstall();
    setupShare();
    registerServiceWorker();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
