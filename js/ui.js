/* Board rendering, input, and animation sequencing.
   The engine hands back an ordered event list for each move; runEvents walks it
   and awaits each animation, which is what keeps the celebrations from
   overlapping each other. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};
  var Engine = STT.Engine;
  var Glyphs = STT.Glyphs;
  var FX = STT.Effects;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var PLACE_NAMES = [
    'top left', 'top centre', 'top right',
    'middle left', 'centre', 'middle right',
    'bottom left', 'bottom centre', 'bottom right'
  ];

  var state = null;
  var cfg = null;
  var score = { P1: 0, P2: 0, draws: 0 };
  var busy = false;
  var hooks = {};
  var els = {};
  var cellEls = [];
  var miniEls = [];

  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function reduced() { return FX.reducedMotion(); }
  function isBot(seat) { return cfg && cfg.botSeat === seat; }

  /* Confetti looks livelier with a couple of friends alongside the player's colour. */
  function confettiColors(main) {
    return [main, main, '#ffffff', '#ffe14f', '#7cff4f', '#a77bff'];
  }

  /* The bot-mode default name is "You", which does not take a possessive or a
     third-person verb like an ordinary name does. */
  function turnLabel(name) {
    if (name === 'You') return 'Your turn';
    return name + (/s$/i.test(name) ? "'" : "'s") + ' turn';
  }

  function winsLabel(name) {
    return name === 'You' ? 'You win!' : name + ' wins!';
  }

  function init(options) {
    hooks = options || {};
    els = {
      game: $('game'),
      board: $('board'),
      turnPill: $('turnPill'),
      turnSymbol: $('turnSymbol'),
      turnText: $('turnText'),
      freeBadge: $('freeBadge'),
      cardP1: $('cardP1'),
      cardP2: $('cardP2'),
      undoBtn: $('undoBtn'),
      restartBtn: $('restartBtn'),
      endBtn: $('endBtn'),
      winOverlay: $('winOverlay'),
      winCard: $('winCard')
    };

    els.board.addEventListener('click', onBoardClick);

    /* Touch browsers fire synthetic mouse events on tap, which would leave the
       ghost preview stuck on the square after the move. Only preview where the
       pointer genuinely hovers; keyboard focus previews on every device. */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      els.board.addEventListener('mouseover', onHoverIn);
      els.board.addEventListener('mouseout', onHoverOut);
    }
    els.board.addEventListener('focusin', onHoverIn);
    els.board.addEventListener('focusout', onHoverOut);

    els.undoBtn.addEventListener('click', undo);
    els.restartBtn.addEventListener('click', restart);
    /* Guarded: if a stale cached page ever pairs old markup with new code,
       a missing control should cost that one button, not the whole game. */
    if (els.endBtn) els.endBtn.addEventListener('click', onEndGame);
  }

  /* ---- leaving a game ---- */

  var endArmed = false;
  var endTimer = null;

  function exitToMenu() {
    disarmEnd();
    FX.clear();
    hideWin();
    if (hooks.onExit) hooks.onExit();
  }

  function disarmEnd() {
    endArmed = false;
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    if (els.endBtn) {
      els.endBtn.textContent = '⏹ End game';
      els.endBtn.classList.remove('confirming');
    }
  }

  /* Confirm inline rather than with a dialog, and only bother asking when
     there is actually a game in progress to throw away. */
  function onEndGame() {
    var inProgress = state && state.moveCount > 0 && !state.winner;
    if (!inProgress || endArmed) {
      exitToMenu();
      return;
    }
    endArmed = true;
    els.endBtn.textContent = 'Sure? End game';
    els.endBtn.classList.add('confirming');
    FX.sound.click();
    endTimer = setTimeout(disarmEnd, 3000);
  }

  /* ---- board construction (once per game) ---- */

  function buildBoard() {
    els.board.innerHTML = '';
    cellEls = [];
    miniEls = [];

    var count = state.boards.length;
    els.board.classList.toggle('variant-single', count === 1);

    for (var b = 0; b < count; b++) {
      var mini = document.createElement('div');
      mini.className = 'mini';
      mini.dataset.b = String(b);

      var cells = document.createElement('div');
      cells.className = 'mini-cells';
      var row = [];
      for (var c = 0; c < 9; c++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.dataset.b = String(b);
        btn.dataset.c = String(c);
        cells.appendChild(btn);
        row.push(btn);
      }
      cellEls.push(row);

      var brackets = document.createElement('i');
      brackets.className = 'mini-brackets';

      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'mini-line');
      svg.setAttribute('viewBox', '0 0 3 3');
      svg.setAttribute('aria-hidden', 'true');

      var claim = document.createElement('div');
      claim.className = 'mini-claim';

      mini.appendChild(cells);
      mini.appendChild(brackets);
      mini.appendChild(svg);
      mini.appendChild(claim);
      els.board.appendChild(mini);

      miniEls.push({ root: mini, cells: cells, svg: svg, claim: claim });
    }
  }

  /* ---- input ---- */

  function onBoardClick(e) {
    if (busy || !state || state.winner) return;
    var btn = e.target.closest('.cell');
    if (btn && !btn.disabled) {
      move(Number(btn.dataset.b), Number(btn.dataset.c));
      return;
    }
    /* Disabled cells let the click through to the board, so we can say
       "not that one" instead of swallowing it silently. */
    var mini = e.target.closest('.mini');
    if (mini) reject(Number(mini.dataset.b));
  }

  function onHoverIn(e) {
    if (busy || !state || state.winner) return;
    var btn = e.target.closest ? e.target.closest('.cell') : null;
    if (!btn || btn.disabled || btn.querySelector('.glyph')) return;
    var g = Glyphs.node(cfg[state.current].symbol, 'ghost');
    btn.classList.add(state.current === 'P1' ? 'p1' : 'p2');
    btn.appendChild(g);
  }

  function onHoverOut(e) {
    var btn = e.target.closest ? e.target.closest('.cell') : null;
    if (!btn) return;
    clearGhost(btn);
  }

  function clearGhost(btn) {
    var g = btn.querySelector('.glyph.ghost');
    if (!g) return;
    g.remove();
    if (!btn.querySelector('.glyph')) btn.classList.remove('p1', 'p2');
  }

  function move(b, c) {
    var events = Engine.play(state, b, c);
    if (!events) { reject(b); return; }
    runEvents(events);
  }

  /* Shakes the board that was clicked and flashes the one they should be using. */
  function reject(b) {
    var m = miniEls[b];
    if (!m) return;
    FX.sound.illegal();
    m.root.classList.add('shaking');
    setTimeout(function () { m.root.classList.remove('shaking'); }, 440);

    els.turnPill.classList.add('pop');
    setTimeout(function () { els.turnPill.classList.remove('pop'); }, 420);

    Engine.playableBoards(state).forEach(function (pb) {
      var t = miniEls[pb].root;
      t.classList.add('shaking');
      setTimeout(function () { t.classList.remove('shaking'); }, 440);
    });
  }

  /* ---- animation sequencing ---- */

  function runEvents(events) {
    busy = true;
    syncActive();
    syncHud();

    var i = 0;
    function next() {
      if (i >= events.length) {
        busy = false;
        syncAll();
        scheduleBot();
        return;
      }
      var ev = events[i++];
      var done;
      if (ev.type === 'placed') done = animatePlace(ev);
      else if (ev.type === 'vanished') done = vanishMark(ev);
      else if (ev.type === 'boardWon') done = celebrateBoard(ev);
      else if (ev.type === 'boardDrawn') done = killBoard(ev);
      else if (ev.type === 'gameOver') done = finish(ev);
      else done = Promise.resolve();

      /* If an animation step ever throws, the chain would stop and leave busy
         stuck true — board locked, no overlay, no way back. Recover instead. */
      done.then(next, function (err) {
        if (window.console) console.error('animation step failed', ev, err);
        busy = false;
        syncAll();
      });
    }
    next();
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function animatePlace(ev) {
    var btn = cellEls[ev.board][ev.cell];
    clearGhost(btn);
    btn.innerHTML = '';
    btn.classList.remove('p1', 'p2');
    btn.classList.add(ev.player === 'P1' ? 'p1' : 'p2');

    var g = Glyphs.node(cfg[ev.player].symbol);
    g.classList.add('drop');
    btn.appendChild(g);

    var shock = document.createElement('i');
    shock.className = 'shock';
    btn.appendChild(shock);
    setTimeout(function () { shock.remove(); }, 560);

    var p = centerOf(btn);
    FX.sparkle(p.x, p.y, cfg[ev.player].color, 9);
    FX.sound.place(ev.player);
    return sleep(reduced() ? 30 : 210);
  }

  /* Cyclic: a retiring mark puffs out rather than blinking away. */
  function vanishMark(ev) {
    var btn = cellEls[ev.board][ev.cell];
    var glyph = btn.querySelector('.glyph:not(.ghost)');
    var p = centerOf(btn);

    FX.smoke(p.x, p.y, 10);
    FX.sound.boardDead();
    if (glyph) glyph.classList.add('vanishing');

    return sleep(reduced() ? 30 : 360).then(function () {
      btn.innerHTML = '';
      btn.classList.remove('p1', 'p2', 'doomed');
    });
  }

  function drawMiniLine(svg, line, color) {
    svg.innerHTML = '';
    var a = line[0], z = line[2];
    var ln = document.createElementNS(SVG_NS, 'line');
    ln.setAttribute('x1', String((a % 3) + 0.5));
    ln.setAttribute('y1', String(Math.floor(a / 3) + 0.5));
    ln.setAttribute('x2', String((z % 3) + 0.5));
    ln.setAttribute('y2', String(Math.floor(z / 3) + 0.5));
    svg.style.setProperty('--c', color);
    svg.appendChild(ln);
  }

  /* Flash the three, draw the line through them, pop the little symbols out,
     stamp the big one down, then confetti. */
  function celebrateBoard(ev) {
    var m = miniEls[ev.board];
    var color = cfg[ev.player].color;
    var quick = reduced();

    ev.line.forEach(function (c) { cellEls[ev.board][c].classList.add('flash'); });
    FX.sound.boardWin();

    return sleep(quick ? 40 : 330).then(function () {
      drawMiniLine(m.svg, ev.line, color);
      return sleep(quick ? 40 : 400);
    }).then(function () {
      ev.line.forEach(function (c) { cellEls[ev.board][c].classList.remove('flash'); });
      return Engine.isSingle(state)
        ? crownSingleBoard(m, color, quick)
        : stampClaimedBoard(m, ev, color, quick);
    });
  }

  /* On one board the winning line *is* the result, so it stays on screen
     rather than being buried under a stamped giant symbol. */
  function crownSingleBoard(m, color, quick) {
    m.root.style.setProperty('--c', color);
    m.root.classList.add('winline');
    var p = centerOf(m.root);
    FX.burst(p.x, p.y, confettiColors(color), 40);
    return sleep(quick ? 40 : 320);
  }

  function stampClaimedBoard(m, ev, color, quick) {
    m.root.classList.add('bursting');
    return sleep(quick ? 30 : 300).then(function () {
      m.root.classList.remove('bursting');
      m.svg.innerHTML = '';

      m.claim.innerHTML = '';
      m.claim.appendChild(Glyphs.node(cfg[ev.player].symbol));
      m.root.classList.add('claimed', ev.player === 'P1' ? 'claimed-p1' : 'claimed-p2');

      els.board.classList.add('quake');
      setTimeout(function () { els.board.classList.remove('quake'); }, 400);

      var p = centerOf(m.root);
      FX.burst(p.x, p.y, confettiColors(color), 34);
      return sleep(quick ? 40 : 500);
    });
  }

  function killBoard(ev) {
    var m = miniEls[ev.board];
    m.root.classList.add('dead', 'squish');
    FX.sound.boardDead();
    var p = centerOf(m.root);
    FX.smoke(p.x, p.y, 12);
    return sleep(reduced() ? 30 : 430).then(function () {
      m.root.classList.remove('squish');
    });
  }

  function finish(ev) {
    if (ev.winner === 'draw') {
      score.draws++;
      FX.sound.gameDraw();
      if (hooks.onScore) hooks.onScore(score);
      showWin(null);
      return Promise.resolve();
    }

    score[ev.winner]++;
    if (hooks.onScore) hooks.onScore(score);

    /* `line` names macro squares to pulse. A single-board game has none — its
       winning cells were already lit by crownSingleBoard. */
    if (ev.line) {
      ev.line.forEach(function (b) { miniEls[b].root.classList.add('winline'); });
    }
    FX.sound.gameWin();
    FX.rain(confettiColors(cfg[ev.winner].color), 190);

    return sleep(reduced() ? 60 : 750).then(function () {
      showWin(ev.winner);
    });
  }

  /* ---- win overlay ---- */

  function showWin(winner) {
    var card = els.winCard;
    card.innerHTML = '';

    var trophy = document.createElement('div');
    trophy.className = 'win-trophy';
    trophy.textContent = winner ? '🏆' : '🤝';
    card.appendChild(trophy);

    if (winner) {
      var sym = document.createElement('div');
      sym.className = 'win-symbol';
      sym.style.setProperty('--c', cfg[winner].color);
      sym.appendChild(Glyphs.node(cfg[winner].symbol));
      card.appendChild(sym);
    }

    var banner = document.createElement('div');
    banner.className = 'win-banner';
    var text = winner ? winsLabel(cfg[winner].name).toUpperCase() : "IT'S A DRAW!";
    /* One span per letter so they can bounce in one after another. */
    text.split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.textContent = ch;
      s.style.animationDelay = (i * 0.045) + 's, ' + (0.5 + i * 0.045) + 's';
      banner.appendChild(s);
    });
    card.appendChild(banner);

    var variant = STT.Variants.get(cfg.variant);
    var rules = STT.Rules.get(cfg.rules);

    var why;
    if (winner) {
      why = rules.misere
        ? 'The other player made three in a row.'
        : variant.winLabel;
      why += ' ' + score.P1 + ' – ' + score.P2 + ' this session.';
    } else if (rules.maxMarks) {
      why = 'Neither of you could force it before the marks ran out of patience.';
    } else if (variant.boards === 1) {
      why = 'The board is full and nobody got three in a row.';
    } else {
      why = 'Every board is decided and nobody got three in a row.';
    }

    var sub = document.createElement('div');
    sub.className = 'win-sub';
    sub.textContent = why;
    card.appendChild(sub);

    var actions = document.createElement('div');
    actions.className = 'win-actions';

    var again = document.createElement('button');
    again.className = 'btn btn-primary';
    again.textContent = 'Play again';
    again.addEventListener('click', restart);

    var change = document.createElement('button');
    change.className = 'btn';
    change.textContent = 'Main menu';
    change.addEventListener('click', exitToMenu);

    actions.appendChild(again);
    actions.appendChild(change);
    card.appendChild(actions);

    els.winOverlay.classList.remove('hidden');
    again.focus();
  }

  function hideWin() {
    els.winOverlay.classList.add('hidden');
  }

  /* ---- syncing DOM to state ---- */

  function syncCells() {
    for (var b = 0; b < state.boards.length; b++) {
      for (var c = 0; c < 9; c++) {
        var owner = state.boards[b][c];
        var btn = cellEls[b][c];
        var has = btn.querySelector('.glyph:not(.ghost)');
        if (owner && !has) {
          btn.innerHTML = '';
          btn.classList.add(owner === 'P1' ? 'p1' : 'p2');
          btn.appendChild(Glyphs.node(cfg[owner].symbol));
        } else if (!owner && has) {
          btn.innerHTML = '';
          btn.classList.remove('p1', 'p2');
        }
      }
    }
  }

  function syncBoardStatus() {
    var single = Engine.isSingle(state);

    for (var b = 0; b < state.boards.length; b++) {
      var m = miniEls[b];
      var st = state.boardStatus[b];
      m.root.classList.remove('dead', 'winline', 'bursting');
      m.svg.innerHTML = '';

      if (st === 'P1' || st === 'P2') {
        if (single) {
          /* Redraw the winning line rather than claiming the board, and keep
             it idempotent so undo clears it. */
          m.root.style.setProperty('--c', cfg[st].color);
          m.root.classList.add('winline');
          if (state.boardLines[b]) drawMiniLine(m.svg, state.boardLines[b], cfg[st].color);
        } else {
          m.root.classList.add('claimed', st === 'P1' ? 'claimed-p1' : 'claimed-p2');
          /* Leave a symbol that was just stamped alone, so its animation survives. */
          if (!m.claim.firstChild) m.claim.appendChild(Glyphs.node(cfg[st].symbol));
        }
      } else {
        m.root.classList.remove('claimed', 'claimed-p1', 'claimed-p2');
        m.claim.innerHTML = '';
        if (st === 'draw') m.root.classList.add('dead');
      }
    }

    if (state.winner && state.winner !== 'draw' && state.winningLine) {
      state.winningLine.forEach(function (b) {
        miniEls[b].root.classList.add('winline');
      });
    }
  }

  function syncActive() {
    var playable = Engine.playableBoards(state);
    var open = {};
    playable.forEach(function (b) { open[b] = true; });
    var free = !state.winner && state.activeBoard === null;
    var locked = busy || !!state.winner ||
      (cfg.mode === 'bot' && state.current === cfg.botSeat);

    for (var b = 0; b < state.boards.length; b++) {
      var root = miniEls[b].root;
      root.classList.toggle('active', !state.winner && state.activeBoard === b);
      root.classList.toggle('offered', free && !!open[b]);
      root.classList.toggle('dim', !state.winner && !open[b]);

      for (var c = 0; c < 9; c++) {
        var btn = cellEls[b][c];
        btn.disabled = locked || !Engine.isLegal(state, b, c);
        var owner = state.boards[b][c];
        btn.setAttribute('aria-label',
          (Engine.isSingle(state) ? '' : PLACE_NAMES[b] + ' board, ') +
          PLACE_NAMES[c] + ' square, ' +
          (owner ? cfg[owner].name : 'empty'));
      }
    }
  }

  function syncHud() {
    var over = !!state.winner;
    var cur = over ? null : state.current;
    var color = cur ? cfg[cur].color : cfg.P1.color;

    document.documentElement.style.setProperty('--turn', color);

    els.turnSymbol.innerHTML = '';
    if (cur) {
      els.turnSymbol.style.setProperty('--c', color);
      els.turnSymbol.appendChild(Glyphs.node(cfg[cur].symbol));
      var thinking = busy && isBot(cur);
      els.turnText.textContent = thinking
        ? cfg[cur].name + ' is thinking…'
        : turnLabel(cfg[cur].name);
    } else {
      els.turnText.textContent = state.winner === 'draw'
        ? 'Game drawn'
        : winsLabel(cfg[state.winner].name);
    }

    els.freeBadge.classList.toggle('hidden', !(cur && state.activeBoard === null));

    ['P1', 'P2'].forEach(function (seat) {
      var card = els['card' + seat];
      var wasTurn = card.classList.contains('is-turn');
      var isTurn = cur === seat;
      card.classList.toggle('is-turn', isTurn);
      card.classList.toggle('thinking', busy && isTurn && isBot(seat));
      if (isTurn && !wasTurn && !reduced()) {
        card.classList.add('bob');
        setTimeout(function () { card.classList.remove('bob'); }, 600);
      }
      card.querySelector('.pc-boards').textContent = String(Engine.claimedCount(state, seat));
      card.querySelector('.pc-score').textContent = String(score[seat]);
    });

    els.undoBtn.disabled = busy || !Engine.canUndo(state);
  }

  /* Cyclic: flag the mark that goes next, so the rule feels fair rather than
     like the board is eating pieces at random. */
  function syncDoomed() {
    for (var b = 0; b < state.boards.length; b++) {
      for (var c = 0; c < 9; c++) cellEls[b][c].classList.remove('doomed');
    }
    if (!state.maxMarks || state.winner || busy) return;

    var d = Engine.doomedMark(state, state.current);
    if (d) cellEls[d.board][d.cell].classList.add('doomed');
  }

  function syncAll() {
    syncCells();
    syncBoardStatus();
    syncActive();
    syncDoomed();
    syncHud();
  }

  /* ---- bot ---- */

  function scheduleBot() {
    if (!cfg || cfg.mode !== 'bot' || !state || state.winner) return;
    if (state.current !== cfg.botSeat) return;

    busy = true;
    syncActive();
    syncHud();

    setTimeout(function () {
      var mv = STT.Bot.chooseMove(state, cfg.difficulty);
      if (!mv) { busy = false; syncAll(); return; }
      var events = Engine.play(state, mv.board, mv.cell);
      if (!events) { busy = false; syncAll(); return; }
      runEvents(events);
    }, reduced() ? 150 : 700);
  }

  /* ---- lifecycle ---- */

  function applyTheme() {
    var root = document.documentElement.style;
    root.setProperty('--p1', cfg.P1.color);
    root.setProperty('--p2', cfg.P2.color);

    /* "Boards won" means nothing when there is only one board. */
    var single = STT.Variants.get(cfg.variant).boards === 1;

    ['P1', 'P2'].forEach(function (seat) {
      var card = els['card' + seat];
      var boardsWrap = card.querySelector('.pc-boards-wrap');
      if (boardsWrap) boardsWrap.classList.toggle('hidden', single);
      card.style.setProperty('--seat', cfg[seat].color);
      card.style.setProperty('--c', cfg[seat].color);
      card.querySelector('.pc-name').textContent = cfg[seat].name;
      card.querySelector('.pc-role').textContent = isBot(seat)
        ? 'Bot · ' + cfg.difficulty.charAt(0).toUpperCase() + cfg.difficulty.slice(1)
        : 'Player';
      var avatar = card.querySelector('.pc-avatar');
      avatar.innerHTML = '';
      avatar.appendChild(Glyphs.node(cfg[seat].symbol));
    });
  }

  /* Seats stay fixed (P1 is always the left card) so the scoreboard keeps
     meaning across rounds; "bot first" just changes who opens. */
  function resolveFirst() {
    if (cfg.mode !== 'bot') return 'P1';
    if (cfg.firstMode === 'bot') return 'P2';
    if (cfg.firstMode === 'random') return Math.random() < 0.5 ? 'P1' : 'P2';
    return 'P1';
  }

  function start(config) {
    cfg = config;
    state = Engine.create(resolveFirst(), cfg.variant, cfg.rules);
    busy = false;
    disarmEnd();
    applyTheme();
    buildBoard();
    hideWin();
    FX.clear();
    syncAll();
    scheduleBot();
  }

  function restart() {
    if (!cfg) return;
    state = Engine.create(resolveFirst(), cfg.variant, cfg.rules);
    busy = false;
    disarmEnd();
    hideWin();
    FX.clear();
    buildBoard();
    syncAll();
    scheduleBot();
  }

  function undo() {
    if (busy || !state || !Engine.canUndo(state)) return;
    hideWin();
    FX.clear();

    Engine.undo(state);
    if (cfg.mode === 'bot') {
      /* Step back past the bot's reply so the human lands on their own turn. */
      while (Engine.canUndo(state) && state.current === cfg.botSeat) Engine.undo(state);
    }
    syncAll();
    scheduleBot();
  }

  STT.UI = {
    init: init,
    start: start,
    restart: restart,
    undo: undo,
    setScore: function (s) {
      score = { P1: s.P1 || 0, P2: s.P2 || 0, draws: s.draws || 0 };
      if (state) syncHud();
    },
    getScore: function () { return score; },
    resetScore: function () {
      score = { P1: 0, P2: 0, draws: 0 };
      if (hooks.onScore) hooks.onScore(score);
      if (state) syncHud();
    }
  };
})(window);
