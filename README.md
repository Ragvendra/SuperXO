# Super Tic Tac Toe

Nine games of noughts and crosses inside one big one — or the plain 3×3 original if you'd
rather. For two players at the same screen or one against a bot, on a neon board over a dark
page, with a small party every time somebody wins something.

## Running it

Double-click **`index.html`**. That's it — no npm, no build step, no server.

Everything is plain HTML, CSS and JavaScript loaded with ordinary `<script>` tags. There are no
ES modules, no `fetch`, and no web workers anywhere in the code, all of which browsers block over
`file://`, so opening the file directly works exactly like serving it.

## On your phone

The game is also a **progressive web app**, so once it's hosted at an HTTPS address you can send
the link to anyone and they can install it to their home screen — no App Store, no Play Store,
no accounts.

**Android** — open the link in Chrome and tap the **Install** button on the setup screen (it
appears automatically when the browser offers it), or use ⋮ → *Install app*.

**iPhone** — open the link in Safari, tap **Share**, then **Add to Home Screen**. The game shows
a one-time hint pointing at this, because iOS gives web pages no way to trigger it themselves.

Either way it gets its own icon, launches fullscreen with no browser bars, and **works completely
offline** — a service worker caches every file on first visit, so it plays on a plane or with no
signal. New versions are picked up the next time the app is fully closed and reopened.

The **Share** button on the setup screen passes the link on via the phone's normal share sheet,
or copies it to the clipboard on desktop.

Opening `index.html` as a local file still works exactly as before. Service workers don't exist
on `file://`, so the offline cache simply doesn't register there — you'll see one harmless console
notice about the manifest being blocked, which affects nothing.

## Boards

Pick one on the setup screen; everything else — modes, symbols, bot, undo, scoreboard — works
the same on both.

| Board | What it is |
| --- | --- |
| **Super Tic Tac Toe** | Nine mini-boards in a 3×3 grid. The square you play sends your opponent to the matching board. Claim three boards in a line to win. |
| **Classic 3×3** | The original. Nine squares, three in a row, done. |

Classic is there for a quick game and for teaching someone the symbols before throwing them at
the big board. Be warned that two players who both know what they're doing will draw it every
time — which is exactly the problem Super Tic Tac Toe was invented to solve.

## Rules

Pick one alongside the board. These change how a game is *won*, not what it's played on.

| Rules | What changes |
| --- | --- |
| **Normal** | Three in a row wins. The standard game. |
| **Cyclic** | You only ever have three marks. Place a fourth and your oldest vanishes — so the board never fills and **a draw is impossible**. |
| **Misère** | Backwards: making three in a row **loses**. You're trying to force the other player into a line. |

**Cyclic pins the board to Classic 3×3**, and the Super card greys out with a note saying so.
Marks vanishing on the big board would un-claim already-won mini-boards, which isn't a coherent
game. The mark about to disappear is shown ringed and pulsing, so you always know what you're
giving up — and because a line broken by that retirement doesn't count, you can't win by
accident. If neither player forces it within 60 moves, the game is called a draw.

**Misère works on both boards**, inverting whatever ends the game. On Classic, three in a row
loses. On Super it's the same idea one level up — claiming three mini-boards in a line loses,
while mini-boards themselves are still won normally.

Cyclic is the cure for Classic always ending level; Misère is the one that breaks people's
brains, because every instinct they have is suddenly wrong.

## Game modes

**Play with a Friend** — two people take turns on one screen.

**Play with Bot** — three levels, and you choose who opens (you, the bot, or random):

| Level | How it plays |
| --- | --- |
| Easy | Random moves, but takes a mini-board that's there for the taking. Never blocks — a child can beat it. |
| Medium | Scores every move one ply deep: claims boards, blocks yours, prefers centre and corners, avoids handing you a free move, and refuses anything that lets you win on the reply. |
| Hard | Alpha-beta minimax with iterative deepening, capped at a 400 ms search budget. |

The bot pauses for about 700 ms before moving, which is deliberate — an instant reply feels
robotic. The Hard search runs inside that pause.

## The rules (Super Tic Tac Toe)

Classic 3×3 needs no explanation and the in-game panel covers it anyway.

1. The big board holds nine mini-boards, each a 3×3 grid — 81 squares in all.
2. The first player may play **anywhere**.
3. **The square you play sends your opponent to the matching mini-board.** Play the top-right
   square of any mini-board and your opponent must play somewhere in the top-right mini-board.
4. If that mini-board is already won or full, your opponent gets a **free move** — any empty
   square in any board still in play.
5. Three in a row inside a mini-board **claims** it. That board then locks.
6. A mini-board that fills up with nobody winning is **dead** — it counts for neither side and
   can never complete a winning line.
7. Claim **three mini-boards in a line** to win the game.
8. If every mini-board is decided and no line was made, the game is a draw.
9. You can never play a taken square, a locked board, or any board other than the live one.

The in-game **Rules** panel carries all of this plus a diagram of rule 3, which is the one that
trips up first-time players.

## Finding your way around the board

Three things tell you whose turn it is — the glowing pill above the board, the raised and lit
player card, and the colour of the board's own glow. All three switch together.

The mini-board you must play in is scaled up, ringed in the current colour, cornered with
brackets and outlined with marching ants. Every other board dims and its squares are genuinely
`disabled`. When you have a free move, the **Play anywhere** badge appears and every open board
gets a softer pulsing outline. Clicking a board you're not allowed to use shakes it and shakes
the one you should be using instead.

## Symbols

Each player picks their own symbol and colour on the setup screen, and the two can't take the
same of either.

- **Neon icons** — ten stroked SVG glyphs (cross, circle, star, moon, heart, lightning, flower,
  rocket, diamond, cat) that take your colour, glow in it, and draw themselves on when placed.
- **Emoji** — twelve options (⭐ 🌙 ❤️ ⚡ 🚀 🐱 🌸 🍩 👾 🐸 🍕 🦄). Worth knowing: emoji are
  full-colour images, so they get a halo in your colour but won't tint to it the way the
  line-art does.

Defaults are cross/cyan and circle/magenta, so pressing Start straight away gives you classic
X and O. Names, symbols, colours, mute state and the match score persist between sessions.

## Controls

**Undo** takes back a move, correctly un-claiming a mini-board if that move won it — and putting
back a mark that Cyclic retired. Against the bot it rewinds two plies, its reply and yours, so
you land back on your own turn. **Restart** starts a fresh game keeping the score, **Reset
score** clears the tally, **End game** returns to the main menu (asking once to confirm if a
game is actually in progress), **Rules** opens the how-to-play panel, and **Sound** mutes the
synthesised effects.

## Accessibility

Every square is a real `<button>` with a label like "centre board, top left square, empty", so
Tab and Enter play the whole game and screen readers narrate it. The board scales to the
viewport and the player cards stack above it on phones. `prefers-reduced-motion` collapses every
animation to a plain fade while keeping the live-board and turn indicators fully legible.

On touch, move previews and hover glows are switched off entirely (they latch on after a tap and
stay lit), taps skip the browser's ~300ms double-tap-zoom delay, long-pressing a square doesn't
raise iOS's selection menu, the page doesn't rubber-band while you play, and layout keeps clear
of notches and the home indicator. Landscape phones get their own layout with the player cards
back beside the board.

One honest limitation: on a 360px-wide phone a Super Tic Tac Toe square is about 33px, under the
44px comfortable-tap guideline. It's workable because the live board is highlighted and every
other square is genuinely disabled, but it is fiddly on small screens — Classic 3×3 has no such
problem at roughly 110px squares.

## Code layout

```
index.html              shell: setup screen, HUD, board, rules panel, confetti canvas
manifest.webmanifest    web app metadata — name, icons, standalone display
sw.js                   service worker: caches everything for offline play
icons/                  icon.svg source plus the rasterised PNGs iOS and Android need
css/theme.css           palette, dark page, neon primitives
css/layout.css          board grid, HUD, setup screen, responsive rules
css/animations.css      every keyframe, plus reduced-motion fallbacks
js/glyphs.js            STT.Glyphs — SVG paths, emoji set, colour swatches
js/variants.js          STT.Variants — the board shapes, as data
js/rules.js             STT.Rules — how a game is won, as data
js/engine.js            STT.Engine — the rules, with zero DOM code
js/bot.js               STT.Bot — the three difficulty levels
js/effects.js           STT.Effects — canvas particles and WebAudio sound
js/ui.js                STT.UI — rendering, input, animation sequencing
js/main.js              setup screen, persistence, chrome wiring
tests/engine.test.html  28 in-page assertions over the engine and bot
```

Each file hangs one object off a single `window.STT` namespace, so the load order in
`index.html` is the only coupling between them.

The engine is deliberately free of DOM code: `play()` returns an ordered list of events
(`placed`, `boardWon`, `boardDrawn`, `sentTo`, `freeMove`, `gameOver`) and `ui.js` walks that
list, awaiting each animation in turn. That separation is what keeps the celebrations from
overlapping, lets the bot search over the same rules the players use, and makes the whole
rulebook testable on its own.

## Tests

Open **`tests/engine.test.html`** in a browser. It runs 47 assertions covering every rule above,
undo, 300 random playouts checked for invariants, both board shapes, both alternate rule sets,
and the bot — that each level only ever returns legal moves in every board/rules combination,
takes an immediate win, blocks one, refuses to complete a line under Misère, answers within a
second on Hard, and that Hard plays Classic perfectly (always a draw against itself, either side
opening). Cyclic gets its own termination test, since a board that never fills could otherwise
loop forever. All 47 currently pass.

Results appear one at a time with a live counter, rather than all at the end. The Hard bot
searches for up to 400 ms per move, which is several seconds of blocking work across a test;
rendering as it goes means the page shows progress instead of sitting on "Running…" until the
whole suite finishes. Expect the last few results to arrive more slowly than the rest.
