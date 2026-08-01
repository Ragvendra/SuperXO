/* Particles and sound.
   Everything visual here rides on one full-screen canvas above the UI; the
   render loop parks itself whenever no particles are alive. Sound is
   synthesised with WebAudio so the game ships without any audio files. */
(function (global) {
  'use strict';

  var STT = global.STT = global.STT || {};

  var canvas = null, ctx = null, raf = null;
  var parts = [];
  var muted = false;
  var reduced = false;

  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* older browsers just get the full show */ }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function kick() {
    if (!raf && parts.length) raf = requestAnimationFrame(loop);
  }

  function loop() {
    raf = null;
    var w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    var alive = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life--;

      if (p.kind === 'confetti') {
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.x += p.vx + Math.sin((p.life + p.seed) * 0.12) * p.flutter;
        p.y += p.vy;
        p.rot += p.vr;
        var fade = Math.min(1, p.life / 24);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        /* Squashing the height as it spins reads as a tumbling paper flake. */
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.7)));
        ctx.restore();
      } else if (p.kind === 'spark') {
        p.vy += 0.06;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;
        var a = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'smoke') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.98;
        p.r += p.growth;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.35;
        ctx.fillStyle = '#9aa3c7';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (p.life > 0 && p.y < h + 80) alive.push(p);
    }
    parts = alive;
    if (parts.length) raf = requestAnimationFrame(loop);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* A quick burst of sparks — used when a symbol lands. */
  function sparkle(x, y, color, count) {
    if (reduced || !ctx) return;
    count = count || 8;
    for (var i = 0; i < count; i++) {
      var ang = rand(0, Math.PI * 2), sp = rand(1.4, 4.6);
      var life = Math.round(rand(22, 40));
      parts.push({
        kind: 'spark', x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: rand(2, 4.5), color: color, life: life, maxLife: life
      });
    }
    kick();
  }

  /* Confetti thrown outward from a point — a mini-board celebration. */
  function burst(x, y, colors, count) {
    if (reduced || !ctx) return;
    count = count || 30;
    for (var i = 0; i < count; i++) {
      var ang = rand(-Math.PI, 0) + rand(-0.5, 0.5), sp = rand(3, 8);
      parts.push({
        kind: 'confetti', x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
        w: rand(6, 12), h: rand(8, 15),
        rot: rand(0, Math.PI * 2), vr: rand(-0.3, 0.3),
        /* Heavy drag keeps the burst over the board it is celebrating; at 0.99
           it sails several hundred pixels off to the side. */
        drag: 0.93,
        gravity: rand(0.16, 0.26), flutter: rand(0.2, 0.9),
        seed: rand(0, 100),
        color: colors[(Math.random() * colors.length) | 0],
        life: Math.round(rand(90, 150))
      });
    }
    kick();
  }

  /* Full-screen confetti for winning the game. */
  function rain(colors, count) {
    if (reduced || !ctx) return;
    count = count || 180;
    var w = window.innerWidth;
    for (var i = 0; i < count; i++) {
      parts.push({
        kind: 'confetti',
        x: rand(0, w), y: rand(-window.innerHeight, -20),
        vx: rand(-1.4, 1.4), vy: rand(1, 4),
        w: rand(7, 14), h: rand(9, 18),
        rot: rand(0, Math.PI * 2), vr: rand(-0.25, 0.25),
        drag: 0.99,
        gravity: rand(0.05, 0.12), flutter: rand(0.4, 1.4),
        seed: rand(0, 100),
        color: colors[(Math.random() * colors.length) | 0],
        life: Math.round(rand(200, 340))
      });
    }
    kick();
  }

  function smoke(x, y, count) {
    if (reduced || !ctx) return;
    count = count || 10;
    for (var i = 0; i < count; i++) {
      var life = Math.round(rand(30, 55));
      parts.push({
        kind: 'smoke', x: x + rand(-14, 14), y: y + rand(-14, 14),
        vx: rand(-0.5, 0.5), vy: rand(-1.4, -0.4),
        r: rand(5, 11), growth: rand(0.3, 0.7),
        life: life, maxLife: life
      });
    }
    kick();
  }

  function clear() {
    parts = [];
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /* ---- sound ---- */

  var audio = null;

  function context() {
    if (muted) return null;
    if (!audio) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { audio = new Ctor(); } catch (e) { return null; }
    }
    /* Browsers start the context suspended until a user gesture. */
    if (audio.state === 'suspended' && audio.resume) audio.resume();
    return audio;
  }

  function tone(opts) {
    var a = context();
    if (!a) return;
    var t0 = a.currentTime + (opts.delay || 0);
    var dur = opts.dur || 0.1;
    var osc = a.createOscillator();
    var gain = a.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(opts.vol || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  var Sound = {
    place: function (player) {
      tone({
        freq: player === 'P1' ? 680 : 520,
        to: player === 'P1' ? 520 : 400,
        dur: 0.12, type: 'square', vol: 0.1
      });
    },
    boardWin: function () {
      [523, 659, 784].forEach(function (f, i) {
        tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.13, delay: i * 0.085 });
      });
    },
    gameWin: function () {
      var notes = [523, 659, 784, 1047, 880, 1319];
      notes.forEach(function (f, i) {
        tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.14, delay: i * 0.13 });
      });
    },
    gameDraw: function () {
      tone({ freq: 420, to: 300, dur: 0.3, type: 'triangle', vol: 0.12 });
      tone({ freq: 330, to: 220, dur: 0.4, type: 'triangle', vol: 0.12, delay: 0.22 });
    },
    illegal: function () {
      tone({ freq: 150, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.09 });
    },
    click: function () {
      tone({ freq: 900, dur: 0.05, type: 'sine', vol: 0.06 });
    },
    boardDead: function () {
      tone({ freq: 260, to: 170, dur: 0.22, type: 'sine', vol: 0.09 });
    }
  };

  STT.Effects = {
    init: init,
    sparkle: sparkle,
    burst: burst,
    rain: rain,
    smoke: smoke,
    clear: clear,
    sound: Sound,
    setMuted: function (v) { muted = !!v; },
    isMuted: function () { return muted; },
    reducedMotion: function () { return reduced; }
  };
})(window);
