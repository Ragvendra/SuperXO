/* How a game is won, as data — separate from the board it is played on
   (js/variants.js). A board and a rule set combine to make a game. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};

  var LIST = [
    {
      id: 'normal',
      name: 'Normal',
      icon: '⭕',
      blurb: 'The standard game. Three in a row wins.',
      /* 0 means marks stay put forever. */
      maxMarks: 0,
      misere: false,
      singleBoardOnly: false
    },
    {
      id: 'cyclic',
      name: 'Cyclic',
      icon: '♻️',
      blurb: 'Only three marks each — placing a fourth vanishes your oldest.',
      maxMarks: 3,
      misere: false,
      /* Marks vanishing would un-claim already-won mini-boards, so this only
         makes sense on a single board. */
      singleBoardOnly: true
    },
    {
      id: 'misere',
      name: 'Misère',
      icon: '🙃',
      blurb: 'Backwards! Making three in a row makes you lose.',
      maxMarks: 0,
      misere: true,
      singleBoardOnly: false
    }
  ];

  var byId = {};
  LIST.forEach(function (r) { byId[r.id] = r; });

  STT.Rules = {
    LIST: LIST,
    get: function (id) { return byId[id] || byId.normal; }
  };
})(window);
