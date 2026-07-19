# Chess

A small chess/tile game built on a minimal, hand-rolled ECS (Entity-Component-System)
engine and rendered to an HTML `<canvas>`.

## Structure

- **Contracts/** — components (plain data attached to entities) and event types.
- **Interfaces/** — the engine's contracts (`IRegistry`, `IComponentRegistry`, `IEventQueue`, …).
- **Systems/** — behaviour: input handling, movement, collision, rendering, the registry,
  the component store, the entity builder, and scene setup.
- **Configuration/** — tunable constants (board size, colors, tile size, fonts).
- **Utilities/** — small helpers (grid position math).
- **libraries/FastList/** — a self-contained doubly-linked list with an Array-style API,
  used as the event queue backing store. Covered by `Tests/LibraryTests/FastList.test.ts`.

## Running

`Game.ts` exposes `StartGame(canvas)`, which builds the scene and drives the game with
`requestAnimationFrame`. `game.html` loads the compiled ESM entry (`Game.js`) and calls it.
Compile the TypeScript (e.g. `tsc`) so `Game.js` sits next to `game.html`, then serve the
folder over HTTP and open `game.html`.

## Tests

`npm test` (vitest, from the repo root) runs the suites, including the FastList library tests.
