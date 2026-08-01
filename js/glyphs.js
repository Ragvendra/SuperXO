/* Symbol sets players can pick from.
   Icons are stroked SVG paths so they take the player's colour and can glow;
   emoji are full-colour glyphs that get a halo instead. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};

  /* Circles are common enough in these glyphs to be worth a helper. */
  function circle(cx, cy, r) {
    return 'M' + (cx - r) + ' ' + cy +
           ' a' + r + ' ' + r + ' 0 1 0 ' + (r * 2) + ' 0' +
           ' a' + r + ' ' + r + ' 0 1 0 ' + (-r * 2) + ' 0';
  }

  var ICONS = [
    {
      id: 'cross', name: 'Cross',
      paths: ['M26 26 L74 74', 'M74 26 L26 74']
    },
    {
      id: 'circle', name: 'Circle',
      paths: [circle(50, 50, 27)]
    },
    {
      id: 'star', name: 'Star',
      paths: ['M50 18 L57.9 39.1 L80.4 40.1 L62.8 54.2 L68.8 75.9 L50 63.5 ' +
              'L31.2 75.9 L37.2 54.2 L19.6 40.1 L42.1 39.1 Z']
    },
    {
      id: 'moon', name: 'Moon',
      paths: ['M64 18 A34 34 0 1 0 64 82 A27 27 0 1 1 64 18 Z']
    },
    {
      id: 'heart', name: 'Heart',
      paths: ['M50 82 C22 62 18 44 26 34 C34 24 46 26 50 36 ' +
              'C54 26 66 24 74 34 C82 44 78 62 50 82 Z']
    },
    {
      id: 'bolt', name: 'Lightning',
      paths: ['M58 12 L30 54 L47 54 L42 88 L70 44 L53 44 Z']
    },
    {
      id: 'flower', name: 'Flower',
      paths: [
        circle(50, 30, 13), circle(69, 43.8, 13), circle(61.8, 66.2, 13),
        circle(38.2, 66.2, 13), circle(31, 43.8, 13), circle(50, 50, 7)
      ]
    },
    {
      id: 'rocket', name: 'Rocket',
      paths: [
        'M50 12 C62 24 68 40 68 56 L32 56 C32 40 38 24 50 12 Z',
        'M32 56 L20 76 L34 68', 'M68 56 L80 76 L66 68',
        'M42 74 L50 92 L58 74', circle(50, 38, 8)
      ]
    },
    {
      id: 'diamond', name: 'Diamond',
      paths: [
        'M32 18 L68 18 L86 42 L50 86 L14 42 Z',
        'M14 42 L86 42', 'M32 18 L42 42 L50 86', 'M68 18 L58 42 L50 86'
      ]
    },
    {
      id: 'cat', name: 'Cat',
      paths: [
        'M22 50 C22 33 34 25 50 25 C66 25 78 33 78 50 C78 67 66 78 50 78 ' +
        'C34 78 22 67 22 50 Z',
        'M27 33 L23 14 L41 25', 'M73 33 L77 14 L59 25',
        'M40 45 L40 52', 'M60 45 L60 52',
        'M50 57 L45 62', 'M50 57 L55 62',
        'M18 55 L33 58', 'M82 55 L67 58'
      ]
    }
  ];

  var EMOJI = [
    { id: 'e-star', name: 'Star', char: '⭐' },
    { id: 'e-moon', name: 'Moon', char: '🌙' },
    { id: 'e-heart', name: 'Heart', char: '❤️' },
    { id: 'e-bolt', name: 'Lightning', char: '⚡' },
    { id: 'e-rocket', name: 'Rocket', char: '🚀' },
    { id: 'e-cat', name: 'Cat', char: '🐱' },
    { id: 'e-flower', name: 'Blossom', char: '🌸' },
    { id: 'e-donut', name: 'Donut', char: '🍩' },
    { id: 'e-alien', name: 'Alien', char: '👾' },
    { id: 'e-frog', name: 'Frog', char: '🐸' },
    { id: 'e-pizza', name: 'Pizza', char: '🍕' },
    { id: 'e-unicorn', name: 'Unicorn', char: '🦄' }
  ];

  var byId = {};
  ICONS.forEach(function (g) { g.kind = 'icon'; byId[g.id] = g; });
  EMOJI.forEach(function (g) { g.kind = 'emoji'; byId[g.id] = g; });

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Builds a fresh element for a glyph. `extraClass` lets callers size it. */
  function node(id, extraClass) {
    var glyph = byId[id] || byId.cross;
    var el;
    if (glyph.kind === 'emoji') {
      el = document.createElement('span');
      el.className = 'glyph glyph-emoji';
      el.textContent = glyph.char;
    } else {
      el = document.createElementNS(SVG_NS, 'svg');
      el.setAttribute('viewBox', '0 0 100 100');
      el.setAttribute('class', 'glyph glyph-icon');
      glyph.paths.forEach(function (d) {
        var p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        /* Normalising every path to length 100 lets one stroke-dash keyframe
           animate any glyph drawing itself on. */
        p.setAttribute('pathLength', '100');
        el.appendChild(p);
      });
    }
    if (extraClass) el.classList.add(extraClass);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function get(id) {
    return byId[id] || byId.cross;
  }

  /* Six neon colours that all stay legible against the dark board. */
  var COLORS = [
    { id: 'cyan', hex: '#22E8FF' },
    { id: 'magenta', hex: '#FF4FD8' },
    { id: 'lime', hex: '#7CFF4F' },
    { id: 'amber', hex: '#FFC53D' },
    { id: 'violet', hex: '#A77BFF' },
    { id: 'coral', hex: '#FF7A45' }
  ];

  STT.Glyphs = {
    ICONS: ICONS,
    EMOJI: EMOJI,
    COLORS: COLORS,
    node: node,
    get: get
  };
})(window);
