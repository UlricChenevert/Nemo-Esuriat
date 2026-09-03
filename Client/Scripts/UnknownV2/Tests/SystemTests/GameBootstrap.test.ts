// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { CharacterRepresentation, TileSizePixels } from "../../Configuration/DisplayConstants.ts";

const NativeResolution = GameWidth * TileSizePixels;

const drawnGlyphs : Array<{ model : string, canvasX : number, canvasY : number }> = [];

/**
 * happy-dom does not implement a 2D context, so this stands in for one and
 * records what the renderer drew. Installed before Game.ts is imported, because
 * RenderingResources throws if getContext returns null.
 */
function InstallCanvasContextStub() {
  Object.defineProperty(globalThis.HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: function () {
      return {
        font: "", textBaseline: "", textAlign: "", fillStyle: "",
        fillRect: () => {},
        fillText: (model : string, canvasX : number, canvasY : number) => { drawnGlyphs.push({ model, canvasX, canvasY }); },
      };
    },
  });
}

let canvas : HTMLCanvasElement;

/** What the very first frame drew, which is the start menu rather than the world. */
const startMenuGlyphs : Array<{ model : string, canvasX : number, canvasY : number }> = [];

beforeAll(async () => {
  InstallCanvasContextStub();

  // Game.ts is side-effect free: the two callers that boot it -- game.html for
  // the standalone harness and WebPlugins/UnknownV2/UnknownV2Model.ts for the
  // site -- each build the canvas at the game's native resolution and hand it to
  // StartGame. This mirrors what they do.
  //
  // The regression that shape exists for: sizing from the container element gave
  // a clientHeight of 0, so the backing store had no pixels and every frame was
  // blank no matter what the renderer did.
  canvas = document.createElement("canvas");
  canvas.width = NativeResolution;
  canvas.height = NativeResolution;
  document.body.appendChild(canvas);

  const { GameLoop, Initialization, StartGame } = await import("../../Game.ts");
  const { Resources, RenderingResources } = await import("../../Contracts/SystemResources.ts");
  const { CreateWorldStreamingResources } = await import("../../Utilities/CreateWorldStreamingResources.ts");
  const { GameKeyboardEvent } = await import("../../Contracts/Events/KeyBoardEvent.ts");

  // Boot through the real entry point, then stop it again -- this is what a
  // caller gets, and leaving the loop running would leak into later tests.
  StartGame(canvas)();

  // requestAnimationFrame is async in happy-dom, so drive the loop directly
  // rather than waiting on it.
  const resources = new Resources(new RenderingResources(canvas), CreateWorldStreamingResources());
  const context = Initialization(resources);

  // Frame one is the start menu: the game boots with a menu layer on top of the
  // gameplay layer, so the world exists but nothing simulates it yet.
  drawnGlyphs.length = 0;
  GameLoop(context.registry, context.eventQueue, context.resources);
  startMenuGlyphs.push(...drawnGlyphs);

  // Close it the way a player does -- Interact on "Start Game", which is the row
  // the cursor starts on. Going through the keyboard rather than reaching for
  // CloseMenu keeps this a test of the boot sequence a player actually gets.
  context.eventQueue.EnqueueEvent(new GameKeyboardEvent({ code: "Space", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, true));
  GameLoop(context.registry, context.eventQueue, context.resources);

  // Frame three is the first frame of actual play.
  drawnGlyphs.length = 0;
  GameLoop(context.registry, context.eventQueue, context.resources);
});

describe("canvas sizing", () => {
  it("has a non-zero backing store", () => expect(canvas.width * canvas.height).toBeGreaterThan(0));
  it("is the game's native width", () => expect(canvas.width).toBe(NativeResolution));
  it("is the game's native height", () => expect(canvas.height).toBe(NativeResolution));
  it("is square", () => expect(canvas.width).toBe(canvas.height));
});

describe("StartGame", () => {
  // The canvas has to be focusable or its keydown listeners never fire, which is
  // what leaves camera panning dead on the embedded page.
  it("makes the canvas focusable", () => expect(canvas.tabIndex).toBeGreaterThanOrEqual(0));
});

// Embedded in the site the game sits on a scrollable page, and both the wheel
// and the arrow keys scroll it by default -- so panning, or any scroll over the
// board, used to slide the game off the screen mid-play.
describe("page scrolling over the canvas", () => {
  let embeddedCanvas : HTMLCanvasElement;
  let stopGame : () => void;

  beforeAll(async () => {
    const { StartGame } = await import("../../Game.ts");

    embeddedCanvas = document.createElement("canvas");
    embeddedCanvas.width = NativeResolution;
    embeddedCanvas.height = NativeResolution;
    document.body.appendChild(embeddedCanvas);

    stopGame = StartGame(embeddedCanvas);
  });

  afterAll(() => { stopGame(); embeddedCanvas.remove(); });

  const dispatchKeyDown = (code : string, init : KeyboardEventInit = {}) => {
    const keyEvent = new KeyboardEvent("keydown", { code, cancelable: true, ...init });
    embeddedCanvas.dispatchEvent(keyEvent);
    return keyEvent;
  };

  it("swallows the wheel", () => {
    const wheelEvent = new WheelEvent("wheel", { cancelable: true, deltaY: 120 });
    embeddedCanvas.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it("swallows the arrow pan keys", () =>
    expect(dispatchKeyDown("ArrowDown").defaultPrevented).toBe(true));

  it("swallows the WASD pan keys", () =>
    expect(dispatchKeyDown("KeyS").defaultPrevented).toBe(true));

  // Anything the game does not pan with belongs to the browser and the page.
  it("leaves other keys alone", () =>
    expect(dispatchKeyDown("KeyQ").defaultPrevented).toBe(false));

  // Ctrl+arrow and friends are browser shortcuts; PanCamera ignores them too.
  it("leaves modified pan keys alone", () =>
    expect(dispatchKeyDown("ArrowDown", { ctrlKey: true }).defaultPrevented).toBe(false));
});

// The game opens on a menu, and the menu's loop layer is the only one that runs
// while it is up -- so the very first frame draws a screen and simulates nothing.
describe("the start menu", () => {
  it("draws something", () => expect(startMenuGlyphs.length).toBeGreaterThan(0));

  it("draws its title", () => {
    const drawn = startMenuGlyphs.map((glyph) => glyph.model).join("");
    expect(drawn).toContain("UNKNOWN");
  });

  // No StreamChunks in the menu layer, so nothing generated terrain to draw.
  it("does not draw the world behind it", () => {
    const terrain = new Set([CharacterRepresentation.Water, CharacterRepresentation.Grass, CharacterRepresentation.Hill, CharacterRepresentation.Mountain]);
    expect(startMenuGlyphs.filter((glyph) => terrain.has(glyph.model))).toHaveLength(0);
  });

  // Far short of the whole viewport: a panel and its text, not a world.
  it("covers only part of the screen", () => expect(startMenuGlyphs.length).toBeLessThan(GameWidth * GameWidth));
});

describe("the first frame", () => {
  it("draws something", () => expect(drawnGlyphs.length).toBeGreaterThan(0));
  it("fills the whole viewport", () => expect(drawnGlyphs).toHaveLength(GameWidth * GameWidth));

  it("draws inside the backing store", () => {
    const outside = drawnGlyphs.filter((glyph) => glyph.canvasX < 0 || glyph.canvasX > canvas.width || glyph.canvasY < 0 || glyph.canvasY > canvas.height);
    expect(outside).toHaveLength(0);
  });

  it("reaches the far corner of the canvas", () => {
    // Proves the drawing area is actually used end to end, rather than
    // everything piling into the top-left.
    const furthest = Math.max(...drawnGlyphs.map((glyph) => Math.max(glyph.canvasX, glyph.canvasY)));
    expect(furthest).toBeGreaterThan(canvas.width - TileSizePixels * 2);
  });

  it("draws the player over the terrain", () =>
    expect(drawnGlyphs.some((glyph) => glyph.model === CharacterRepresentation.Character)).toBe(true));
});
