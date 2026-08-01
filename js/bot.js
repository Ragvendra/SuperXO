/* Computer opponent. Reads engine state, returns a move — never mutates the
   real game. The search runs on its own compact mirror of the position with
   make/unmake, since cloning the whole state per node would be far too slow. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};
  var LINES = STT.Engine.LINES;

  /* Macro squares are not equal: the centre board sits on four winning lines,
     corners on three, edges on two. Cells inside a board rank the same way. */
  var POS = [3, 2, 3, 2, 4, 2, 3, 2, 3];
  var CELLB = [5, 2, 5, 2, 8, 2, 5, 2, 5];

  var HARD_BUDGET_MS = 400;

  function other(p) { return p === 'P1' ? 'P2' : 'P1'; }

  function winnerOf(cells) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i], a = cells[L[0]];
      if (a && cells[L[1]] === a && cells[L[2]] === a) return a;
    }
    return null;
  }

  function fullOf(cells) {
    for (var i = 0; i < 9; i++) if (cells[i] === null) return false;
    return true;
  }

  /* A drawn board belongs to nobody, so it can never complete a macro line. */
  function macroWinner(status) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i], a = status[L[0]];
      if ((a === 'P1' || a === 'P2') && status[L[1]] === a && status[L[2]] === a) return a;
    }
    return null;
  }

  function allDecided(status) {
    for (var i = 0; i < status.length; i++) if (status[i] === null) return false;
    return true;
  }

  /* What settles the game: on a single-board variant it is that board, on nine
     it is a macro line — then inverted if the rules are misère, since there
     the player who completed the line is the one who lost. */
  function terminalWinner(s) {
    var maker = s.status.length === 1
      ? (s.status[0] === 'P1' || s.status[0] === 'P2' ? s.status[0] : null)
      : macroWinner(s.status);
    if (!maker) return null;
    return s.misere ? other(maker) : maker;
  }

  /* Would playing cell `c` complete a line for `p` in this mini-board? */
  function completesLine(cells, c, p) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (L[0] !== c && L[1] !== c && L[2] !== c) continue;
      var ok = true;
      for (var k = 0; k < 3; k++) {
        if (L[k] === c) continue;
        if (cells[L[k]] !== p) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  /* ---- search position ---- */

  function toSearch(state) {
    var boards = [];
    for (var b = 0; b < state.boards.length; b++) boards.push(state.boards[b].slice());
    return {
      boards: boards,
      status: state.boardStatus.slice(),
      current: state.current,
      active: state.activeBoard,
      sendRule: state.sendRule,
      maxMarks: state.maxMarks,
      misere: state.misere,
      order: { P1: state.marks.P1.slice(), P2: state.marks.P2.slice() }
    };
  }

  /* Moves are packed as board * 9 + cell so ordering can sort plain numbers. */
  function movesOf(s) {
    var out = [], b, c;
    if (s.active !== null && s.status[s.active] === null) {
      b = s.active;
      for (c = 0; c < 9; c++) if (s.boards[b][c] === null) out.push(b * 9 + c);
      return out;
    }
    for (b = 0; b < s.boards.length; b++) {
      if (s.status[b] !== null) continue;
      for (c = 0; c < 9; c++) if (s.boards[b][c] === null) out.push(b * 9 + c);
    }
    return out;
  }

  function make(s, mv) {
    var b = (mv / 9) | 0, c = mv % 9;
    var undo = {
      b: b, c: c, status: s.status[b], active: s.active,
      current: s.current, evicted: -1
    };
    var who = s.current;

    s.boards[b][c] = who;
    s.order[who].push(mv);

    /* Cyclic: retire the oldest mark before judging the position, exactly as
       the engine does. */
    if (s.maxMarks && s.order[who].length > s.maxMarks) {
      var gone = s.order[who].shift();
      undo.evicted = gone;
      s.boards[(gone / 9) | 0][gone % 9] = null;
    }

    if (s.status[b] === null) {
      var w = winnerOf(s.boards[b]);
      if (w) s.status[b] = w;
      else if (fullOf(s.boards[b])) s.status[b] = 'draw';
    }
    s.current = other(s.current);
    s.active = s.sendRule
      ? (s.status[c] === null ? c : null)
      : (s.boards.length === 1 ? 0 : null);
    return undo;
  }

  function unmake(s, u) {
    /* Undo in reverse: put back anything that vanished, then take the move
       itself off the end of the order. */
    if (u.evicted >= 0) {
      s.boards[(u.evicted / 9) | 0][u.evicted % 9] = u.current;
      s.order[u.current].unshift(u.evicted);
    }
    s.order[u.current].pop();

    s.boards[u.b][u.c] = null;
    s.status[u.b] = u.status;
    s.active = u.active;
    s.current = u.current;
  }

  function decode(mv) {
    return { board: (mv / 9) | 0, cell: mv % 9 };
  }

  /* Could `p` claim this board the next time they get to play in it? */
  function canClaimNext(cells, p) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i], mine = 0, empty = 0;
      for (var k = 0; k < 3; k++) {
        var v = cells[L[k]];
        if (v === p) mine++;
        else if (v === null) empty++;
      }
      if (mine === 2 && empty === 1) return true;
    }
    return false;
  }

  /* Would claiming board `b` hand `p` the game? */
  function claimWinsMacro(status, b, p) {
    if (status.length === 1) return true;   // the only board is the whole game
    var saved = status[b];
    status[b] = p;
    var wins = macroWinner(status) === p;
    status[b] = saved;
    return wins;
  }

  /* ---- evaluation ---- */

  function evaluate(s, me) {
    var opp = other(me);
    var mw = terminalWinner(s);
    if (mw === me) return 1000000;
    if (mw === opp) return -1000000;

    var score = 0, i, k, b, L, mine, theirs, blocked, v;
    var single = s.status.length === 1;

    /* A single-board game has no macro grid to reason about — only the threats
       inside the one board below. */
    if (!single) {
      /* Boards already claimed, weighted by how useful that square is. */
      for (b = 0; b < 9; b++) {
        if (s.status[b] === me) score += 110 * POS[b];
        else if (s.status[b] === opp) score -= 110 * POS[b];
      }

      /* Macro lines still open to one side only. */
      for (i = 0; i < LINES.length; i++) {
        L = LINES[i]; mine = 0; theirs = 0; blocked = false;
        for (k = 0; k < 3; k++) {
          v = s.status[L[k]];
          if (v === me) mine++;
          else if (v === opp) theirs++;
          else if (v === 'draw') blocked = true;
        }
        if (blocked) continue;
        if (theirs === 0 && mine > 0) score += mine === 2 ? 350 : 70;
        else if (mine === 0 && theirs > 0) score -= theirs === 2 ? 350 : 70;
      }
    }

    /* Threats building inside boards that are still in play. */
    for (b = 0; b < s.boards.length; b++) {
      if (s.status[b] !== null) continue;
      var cells = s.boards[b];
      var w = POS[b] / 3;
      for (i = 0; i < LINES.length; i++) {
        L = LINES[i]; mine = 0; theirs = 0;
        for (k = 0; k < 3; k++) {
          v = cells[L[k]];
          if (v === me) mine++;
          else if (v === opp) theirs++;
        }
        if (theirs === 0 && mine > 0) score += (mine === 2 ? 14 : 4) * w;
        else if (mine === 0 && theirs > 0) score -= (theirs === 2 ? 14 : 4) * w;
      }
      if (cells[4] === me) score += 4 * w;
      else if (cells[4] === opp) score -= 4 * w;

      /* A board sitting one square from being claimed, where that claim would
         complete a macro line, is all but decisive. Without this the one-ply
         scorer misses it whenever the threatening square isn't reachable on
         the very next move. */
      if (canClaimNext(cells, opp) && claimWinsMacro(s.status, b, opp)) score -= 5000;
      if (canClaimNext(cells, me) && claimWinsMacro(s.status, b, me)) score += 5000;
    }

    /* Being the one holding a free move is worth a little. */
    if (s.active === null) score += s.current === me ? 18 : -18;

    /* Under misère every one of those judgements runs backwards — threats are
       liabilities and owning squares is a burden — so flip the whole thing.
       The terminal scores above are already correct via terminalWinner. */
    return s.misere ? -score : score;
  }

  /* Cheap ordering score — deliberately avoids make/unmake so it stays fast
     enough to run at every search node. */
  function orderScore(s, mv) {
    var b = (mv / 9) | 0, c = mv % 9;
    var cells = s.boards[b];
    var me = s.current;
    var score = POS[b] * 8 + CELLB[c];

    /* Ordering only affects how fast the search prunes, but getting it
       backwards under misère would waste most of the cutoffs. */
    var lineBias = 0;
    if (completesLine(cells, c, me)) lineBias = 1200;
    else if (completesLine(cells, c, other(me))) lineBias = 600;
    score += s.misere ? -lineBias : lineBias;

    if (s.status[c] !== null) score -= 250;   // hands the opponent a free move
    return score;
  }

  function orderMoves(s, moves) {
    var keyed = moves.map(function (mv) {
      return { mv: mv, k: orderScore(s, mv) };
    });
    keyed.sort(function (a, b) { return b.k - a.k; });
    return keyed.map(function (o) { return o.mv; });
  }

  /* ---- difficulty levels ---- */

  /* Easy: takes a mini-board that is there for the taking, otherwise random.
     It never blocks and never thinks about the macro grid, so a child can win. */
  function easyMove(state) {
    var moves = STT.Engine.legalMoves(state);
    var me = state.current;
    var completing = moves.filter(function (m) {
      return completesLine(state.boards[m.board], m.cell, me);
    });

    /* Under misère a completed line is the thing to avoid, not to grab. */
    var pool;
    if (state.misere) {
      pool = moves.filter(function (m) { return completing.indexOf(m) < 0; });
      if (!pool.length) pool = moves;
    } else {
      pool = completing.length ? completing : moves;
    }
    return pool[(Math.random() * pool.length) | 0];
  }

  /* Medium: scores every move one ply deep, and refuses any move that lets the
     opponent win the whole game on the reply. */
  function mediumMove(state) {
    var me = state.current, opp = other(me);
    var s = toSearch(state);
    var moves = movesOf(s);
    var best = -Infinity, bestMove = moves[0];

    for (var i = 0; i < moves.length; i++) {
      var u = make(s, moves[i]);
      var score;
      if (terminalWinner(s) === me) {
        score = 1000000;
      } else {
        var loses = false;
        var replies = movesOf(s);
        for (var j = 0; j < replies.length; j++) {
          var u2 = make(s, replies[j]);
          var mw = terminalWinner(s);
          unmake(s, u2);
          if (mw === opp) { loses = true; break; }
        }
        score = loses ? -1000000 : evaluate(s, me);
      }
      unmake(s, u);
      score += Math.random() * 6;   // gentle jitter, so rematches differ
      if (score > best) { best = score; bestMove = moves[i]; }
    }
    return decode(bestMove);
  }

  function search(s, depth, alpha, beta, me, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 511) === 0 && Date.now() > ctx.deadline) {
      ctx.aborted = true;
      return 0;
    }

    var mw = terminalWinner(s);
    if (mw) return mw === me ? 900000 + depth : -900000 - depth;
    if (allDecided(s.status)) return 0;
    if (depth === 0) return evaluate(s, me);

    var moves = orderMoves(s, movesOf(s));
    if (!moves.length) return evaluate(s, me);

    var maximizing = s.current === me;
    var best = maximizing ? -Infinity : Infinity;

    for (var i = 0; i < moves.length; i++) {
      var u = make(s, moves[i]);
      var v = search(s, depth - 1, alpha, beta, me, ctx);
      unmake(s, u);
      if (ctx.aborted) return 0;
      if (maximizing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  /* Hard: iterative deepening alpha-beta. Each completed depth replaces the
     best move; an aborted depth is discarded, so we always return the result
     of a fully searched iteration. */
  function hardMove(state) {
    var me = state.current;
    var s = toSearch(state);
    var moves = movesOf(s);
    if (moves.length === 1) return decode(moves[0]);
    /* Opening book. 81 legal moves can only mean an untouched nine-board game
       — safer than trusting a move counter that a caller may not have kept. */
    if (s.boards.length === 9 && moves.length === 81 && !s.misere) {
      return { board: 4, cell: 4 };
    }

    moves = orderMoves(s, moves);
    var ctx = { nodes: 0, deadline: Date.now() + HARD_BUDGET_MS, aborted: false };
    var bestMove = moves[0];

    /* A single board is only nine plies deep, so let the search solve it
       outright rather than stopping short and playing an inferior move. */
    var maxDepth = s.boards.length === 1 ? 10 : 8;

    for (var depth = 2; depth <= maxDepth; depth++) {
      var localBest = -Infinity, localMove = null;
      var alpha = -Infinity;

      for (var i = 0; i < moves.length; i++) {
        var u = make(s, moves[i]);
        var v = search(s, depth - 1, alpha, Infinity, me, ctx);
        unmake(s, u);
        if (ctx.aborted) break;
        if (v > localBest) { localBest = v; localMove = moves[i]; }
        if (v > alpha) alpha = v;
      }

      if (ctx.aborted) break;
      if (localMove !== null) {
        bestMove = localMove;
        /* Search the current best first next time — it sharpens the cutoffs. */
        moves.splice(moves.indexOf(bestMove), 1);
        moves.unshift(bestMove);
      }
      if (localBest > 800000) break;              // forced win, stop looking
      if (Date.now() > ctx.deadline) break;
    }
    return decode(bestMove);
  }

  function chooseMove(state, difficulty) {
    if (state.winner) return null;
    var moves = STT.Engine.legalMoves(state);
    if (!moves.length) return null;
    if (difficulty === 'easy') return easyMove(state);
    if (difficulty === 'hard') return hardMove(state);
    return mediumMove(state);
  }

  STT.Bot = {
    chooseMove: chooseMove,
    LEVELS: [
      { id: 'easy', name: 'Easy', blurb: 'Plays for fun. Grabs an easy square.' },
      { id: 'medium', name: 'Medium', blurb: 'Blocks you and builds its own lines.' },
      { id: 'hard', name: 'Hard', blurb: 'Thinks several moves ahead.' }
    ]
  };
})(window);
