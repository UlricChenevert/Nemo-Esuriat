// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
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

beforeAll(async () => {
  InstallCanvasContextStub();

  document.body.innerHTML = `<div id="GameContainer"></div>`;

  // Importing Game.ts registers its DOMContentLoaded handler; dispatching the
  // event is what actually boots the game, exactly as the browser does.
  await import("../../Game.ts");
  document.dispatchEvent(new Event("DOMContentLoaded"));

  canvas = document.getElementById("game") as HTMLCanvasElement;

  // One frame. requestAnimationFrame is async in happy-dom, so drive the loop
  // directly rather than waiting on it.
  const { GameLoop, Initialization } = await import("../../Game.ts");
  const { Resources, RenderingResources } = await import("../../Contracts/SystemResources.ts");
  const { CreateWorldStreamingResources } = await import("../../Systems.World/CreateWorldStreamingResources.ts");

  const resources = new Resources(new RenderingResources(canvas), CreateWorldStreamingResources());
  const context = Initialization(resources);

  drawnGlyphs.length = 0;
  GameLoop(context.registry, context.eventQueue, context.resources);
});

describe("canvas sizing", () => {
  it("creates the canvas", () => expect(canvas).not.toBe(null));

  // The regression this file exists for: sizing from #GameContainer gave a
  // clientHeight of 0, so the backing store had no pixels and every frame was
  // blank no matter what the renderer did.
  it("has a non-zero backing store", () => expect(canvas.width * canvas.height).toBeGreaterThan(0));
  it("is the game's native width", () => expect(canvas.width).toBe(NativeResolution));
  it("is the game's native height", () => expect(canvas.height).toBe(NativeResolution));
  it("is square", () => expect(canvas.width).toBe(canvas.height));
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
