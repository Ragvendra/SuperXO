/* Super Tic Tac Toe — rules engine.
   Pure logic: this file never touches the DOM, so tests/engine.test.html can
   exercise it directly and js/bot.js can search over it. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};

  /* The eight three-in-a-row lines, used for both a mini-board and the macro grid. */
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function other(player) {
    return player === 'P1' ? 'P2' : 'P1';
  }

  /* Returns {player, line} for a filled line in a 9-cell array, else null. */
  function lineWinner(cells) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      var a = cells[L[0]];
      if (a && cells[L[1]] === a && cells[L[2]] === a) {
        return { player: a, line: L };
      }
    }
    return null;
  }

  function isFull(cells) {
    for (var i = 0; i < 9; i++) {
      if (cells[i] === null) return false;
    }
    return true;
  }

  /* Macro grid as a 9-cell array. A drawn mini-board counts for nobody. */
  function macroCells(state) {
    var out = [];
    for (var b = 0; b < state.boards.length; b++) {
      var s = state.boardStatus[b];
      out.push(s === 'P1' || s === 'P2' ? s : null);
    }
    return out;
  }

  /* A one-board game is decided by that board alone; nine needs a macro line. */
  function isSingle(state) {
    return state.boards.length === 1;
  }

  /* `first` lets the bot open a game without swapping the seats around, which
     would otherwise scramble the scoreboard between rounds. `variantId` picks
     the board shape — see js/variants.js. */
  function create(first, variantId) {
    var v = STT.Variants.get(variantId);
    var boards = [];
    var status = [];
    var lines = [];
    for (var b = 0; b < v.boards; b++) {
      boards.push([null, null, null, null, null, null, null, null, null]);
      status.push(null);
      lines.push(null);
    }
    return {
      variant: v.id,
      sendRule: v.sendRule,
      boards: boards,          // boards[b][c] -> null | 'P1' | 'P2'
      boardStatus: status,     // null (open) | 'P1' | 'P2' | 'draw'
      boardLines: lines,       // winning triple inside each claimed board
      current: first === 'P2' ? 'P2' : 'P1',
      /* With one board there is nowhere else to go, so it starts live rather
         than as a "play anywhere" free move. */
      activeBoard: v.boards === 1 ? 0 : null,
      winner: null,            // null | 'P1' | 'P2' | 'draw'
      winningLine: null,
      lastMove: null,
      moveCount: 0,
      history: []
    };
  }

  function isLegal(state, b, c) {
    if (state.winner) return false;
    if (!(b >= 0 && b < state.boards.length) || !(c >= 0 && c <= 8)) return false;
    if (state.boardStatus[b] !== null) return false;      // board is claimed or dead
    if (state.boards[b][c] !== null) return false;        // cell taken
    if (state.activeBoard !== null && state.activeBoard !== b) return false;
    return true;
  }

  /* Which mini-boards may be played in right now. */
  function playableBoards(state) {
    var out = [];
    if (state.winner) return out;
    if (state.activeBoard !== null && state.boardStatus[state.activeBoard] === null) {
      return [state.activeBoard];
    }
    for (var b = 0; b < state.boards.length; b++) {
      if (state.boardStatus[b] === null) out.push(b);
    }
    return out;
  }

  function legalMoves(state) {
    var boards = playableBoards(state);
    var out = [];
    for (var i = 0; i < boards.length; i++) {
      var b = boards[i];
      for (var c = 0; c < 9; c++) {
        if (state.boards[b][c] === null) out.push({ board: b, cell: c });
      }
    }
    return out;
  }

  function snapshot(state) {
    var boards = [];
    for (var b = 0; b < state.boards.length; b++) boards.push(state.boards[b].slice());
    return {
      boards: boards,
      boardStatus: state.boardStatus.slice(),
      boardLines: state.boardLines.slice(),
      current: state.current,
      activeBoard: state.activeBoard,
      winner: state.winner,
      winningLine: state.winningLine ? state.winningLine.slice() : null,
      lastMove: state.lastMove ? {
        board: state.lastMove.board,
        cell: state.lastMove.cell,
        player: state.lastMove.player
      } : null,
      moveCount: state.moveCount
    };
  }

  function restore(state, snap) {
    state.boards = snap.boards;
    state.boardStatus = snap.boardStatus;
    state.boardLines = snap.boardLines;
    state.current = snap.current;
    state.activeBoard = snap.activeBoard;
    state.winner = snap.winner;
    state.winningLine = snap.winningLine;
    state.lastMove = snap.lastMove;
    state.moveCount = snap.moveCount;
  }

  /* Plays a move and returns an ordered event list for the UI to animate,
     or null if the move was illegal. */
  function play(state, b, c) {
    if (!isLegal(state, b, c)) return null;

    state.history.push(snapshot(state));

    var player = state.current;
    state.boards[b][c] = player;
    state.moveCount += 1;
    state.lastMove = { board: b, cell: c, player: player };

    var events = [{ type: 'placed', board: b, cell: c, player: player }];

    /* Did that claim the mini-board, or kill it? */
    var won = lineWinner(state.boards[b]);
    if (won) {
      state.boardStatus[b] = won.player;
      state.boardLines[b] = won.line;
      events.push({ type: 'boardWon', board: b, player: won.player, line: won.line });
    } else if (isFull(state.boards[b])) {
      state.boardStatus[b] = 'draw';
      events.push({ type: 'boardDrawn', board: b });
    }

    /* On a single board, settling that board settles the game. `winningLine`
       stays null because it names macro squares, and there are none — the
       three winning cells are already recorded in boardLines[0]. */
    if (isSingle(state)) {
      var only = state.boardStatus[0];
      if (only === 'P1' || only === 'P2') {
        state.winner = only;
        state.winningLine = null;
        state.activeBoard = null;
        events.push({ type: 'gameOver', winner: only, line: null });
        return events;
      }
      if (only === 'draw') {
        state.winner = 'draw';
        state.winningLine = null;
        state.activeBoard = null;
        events.push({ type: 'gameOver', winner: 'draw', line: null });
        return events;
      }
    } else {
      /* Three claimed boards in a line wins the whole game. */
      var macro = lineWinner(macroCells(state));
      if (macro) {
        state.winner = macro.player;
        state.winningLine = macro.line;
        state.activeBoard = null;
        events.push({ type: 'gameOver', winner: macro.player, line: macro.line });
        return events;
      }

      var allDecided = true;
      for (var i = 0; i < state.boards.length; i++) {
        if (state.boardStatus[i] === null) { allDecided = false; break; }
      }
      if (allDecided) {
        state.winner = 'draw';
        state.winningLine = null;
        state.activeBoard = null;
        events.push({ type: 'gameOver', winner: 'draw', line: null });
        return events;
      }
    }

    state.current = other(player);

    if (!state.sendRule) {
      /* Nothing to choose: play carries on wherever there is room. */
      state.activeBoard = isSingle(state) ? 0 : null;
      events.push({ type: 'turnChanged', player: state.current });
      return events;
    }

    /* The cell just played sends the opponent to the matching mini-board —
       unless that board is already decided, in which case they play anywhere. */
    if (state.boardStatus[c] === null) {
      state.activeBoard = c;
      events.push({ type: 'sentTo', board: c, player: state.current });
    } else {
      state.activeBoard = null;
      events.push({ type: 'freeMove', player: state.current });
    }
    events.push({ type: 'turnChanged', player: state.current });
    return events;
  }

  function canUndo(state) {
    return state.history.length > 0;
  }

  function undo(state) {
    if (!state.history.length) return false;
    restore(state, state.history.pop());
    return true;
  }

  /* How many mini-boards each player has claimed. */
  function claimedCount(state, player) {
    var n = 0;
    for (var b = 0; b < state.boards.length; b++) {
      if (state.boardStatus[b] === player) n++;
    }
    return n;
  }

  STT.Engine = {
    LINES: LINES,
    create: create,
    isLegal: isLegal,
    playableBoards: playableBoards,
    legalMoves: legalMoves,
    play: play,
    undo: undo,
    canUndo: canUndo,
    claimedCount: claimedCount,
    macroCells: macroCells,
    isSingle: isSingle,
    lineWinner: lineWinner,
    isFull: isFull,
    other: other
  };
})(window);
