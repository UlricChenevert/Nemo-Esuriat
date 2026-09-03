import { describe, it, expect } from "vitest";
import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { GameClickEvent } from "../../Contracts/Events/GameClickEvent.ts";
import { WorldTileOfScreenTile } from "../../Utilities/CameraUtilities.ts";
import { Position } from "../../Contracts/Components/Position.ts";

const NativeResolution = GameWidth * TileSizePixels;

/**
 * A canvas whose backing store is the game's native resolution, displayed at
 * `displayedSize` CSS pixels at `left`/`top` on the page.
 *
 * Only getBoundingClientRect and the two size fields are read, so a stub is
 * enough -- and it lets a test state the stretch factor directly instead of
 * arranging a real layout.
 */
const CanvasDisplayedAt = (displayedSize : number, left = 0, top = 0) => ({
  width: NativeResolution,
  height: NativeResolution,
  getBoundingClientRect: () => ({ left, top, width: displayedSize, height: displayedSize }),
} as unknown as HTMLCanvasElement);

const ClickOn = (canvas : HTMLCanvasElement, clientX : number, clientY : number) => {
  const event = new GameClickEvent({ clientX, clientY } as MouseEvent, canvas);

  return [event.screenX, event.screenY];
};

describe("pixels to screen tiles", () => {
  it("maps the top-left pixel to the top-left tile", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution), 0, 0)).toEqual([0, 0]));

  it("maps a whole tile's worth of pixels to that tile", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution), 5 * TileSizePixels, 7 * TileSizePixels)).toEqual([5, 7]));

  // A tile is TileSizePixels wide, so every pixel within it belongs to it.
  it("maps anywhere inside a tile to the same tile", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution), 5 * TileSizePixels + TileSizePixels - 1, 7 * TileSizePixels + 1)).toEqual([5, 7]));

  it("maps the last pixel to the last tile", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution), NativeResolution - 1, NativeResolution - 1)).toEqual([GameWidth - 1, GameWidth - 1]));
});

describe("a canvas the page has stretched or moved", () => {
  // CSS scales the canvas to fit the page; clicks arrive in CSS pixels and have
  // to be scaled back into the backing store or every click lands short.
  it("scales a click back into backing-store pixels", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution / 2), 5 * (TileSizePixels / 2), 7 * (TileSizePixels / 2))).toEqual([5, 7]));

  it("subtracts the element's position on the page", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution, 300, 120), 300 + 5 * TileSizePixels, 120 + 7 * TileSizePixels)).toEqual([5, 7]));

  it("handles being stretched and offset at once", () =>
    expect(ClickOn(CanvasDisplayedAt(NativeResolution * 2, 40, 90), 40 + 5 * TileSizePixels * 2, 90 + 7 * TileSizePixels * 2)).toEqual([5, 7]));
});

describe("what the event carries", () => {
  // Screen space, not world space: the camera is an entity now, so a DOM
  // listener has nothing to convert with. HandleInputEvents resolves it on the
  // frame it handles the click, against the origin the renderer is about to use.
  it("is a screen tile, which the camera turns into a world tile", () => {
    const [screenX, screenY] = ClickOn(CanvasDisplayedAt(NativeResolution), 5 * TileSizePixels, 7 * TileSizePixels);

    // The camera position is the viewport CENTRE, so its top-left corner sits
    // half a viewport back from it. Derived rather than written out, or the
    // expectation goes stale the next time GameWidth moves.
    const cornerOffset = 1000 - GameWidth / 2;
    const world = WorldTileOfScreenTile(new Position(1000, 1000), screenX!, screenY!);

    expect([world.x, world.y]).toEqual([cornerOffset + 5, cornerOffset + 7]);
  });

  it("carries no world position of its own", () => {
    const event = new GameClickEvent({ clientX: 0, clientY: 0 } as MouseEvent, CanvasDisplayedAt(NativeResolution));

    expect("position" in event).toBe(false);
  });
});
