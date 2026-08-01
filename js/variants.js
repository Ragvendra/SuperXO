/* The board shapes the game can be played on.
   Keeping these as data rather than branches means a new board is a new entry
   here plus whatever genuinely differs, instead of `if (classic)` scattered
   through the engine. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};

  var LIST = [
    {
      id: 'super',
      name: 'Super Tic Tac Toe',
      icon: '🎯',
      blurb: 'Nine boards in one. The square you play sends your opponent.',
      tagline: 'Nine boards inside one. Win three in a row to take the game.',
      boards: 9,
      /* Does the square you play decide which board your opponent must use? */
      sendRule: true,
      /* Shown on the win overlay. */
      winLabel: 'Three mini-boards in a row.'
    },
    {
      id: 'classic',
      name: 'Classic 3×3',
      icon: '⭕',
      blurb: 'The original. First to three in a row wins.',
      tagline: 'The original game. Three in a row and it is yours.',
      boards: 1,
      sendRule: false,
      winLabel: 'Three in a row.'
    }
  ];

  var byId = {};
  LIST.forEach(function (v) { byId[v.id] = v; });

  STT.Variants = {
    LIST: LIST,
    get: function (id) { return byId[id] || byId.super; },
    /* A single-board game is decided by that board alone — no macro grid. */
    isSingle: function (id) { return byId[id] ? byId[id].boards === 1 : false; }
  };
})(window);
