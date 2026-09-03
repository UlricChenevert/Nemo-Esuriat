import { describe, it, expect } from "vitest";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { BackgroundLayer, PlayerLayer, TileSizePixels, GameColors } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { ScreenPosition } from "../../Contracts/Components/ScreenPosition.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { AddCameraViewing, BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { FindCameraPosition } from "../../Utilities/CameraUtilities.ts";
import { CreateRecordingRenderingResources } from "../TestHelpers/RecordingRenderingResources.ts";

const HalfCell = TileSizePixels / 2;

const BlockPalette = [new Representation("#", GameColors.Grass)] as const;

/** A width x height block of a single glyph, anchored at the given world position. */
const AddBlock = (registry : GlobalRegistry, worldX : number, worldY : number, width : number, height : number, layerIndex = BackgroundLayer) =>
  new EntityBuilder(registry)
    .AddPosition(new Position(worldX, worldY))
    .AddLayer(new Layer(layerIndex))
    .AddMultiTileRepresentation(new MultiTileRepresentation(width, height, new Uint8Array(width * height), BlockPalette))
    .GetEntity();

const AddGlyph = (registry : GlobalRegistry, worldX : number, worldY : number, model : string, layerIndex : number) =>
  new EntityBuilder(registry)
    .AddPosition(new Position(worldX, worldY))
    .AddLayer(new Layer(layerIndex))
    .AddRepresentation(new Representation(model, GameColors.Player))
    .GetEntity();

/**
 * A registry with the camera looking at the world origin.
 *
 * The camera is an entity now, so it lives in the registry rather than on the
 * rendering resources. At the origin, screen coordinates equal world
 * coordinates, which is what every test below assumes unless it says otherwise.
 */
function BuildRenderRegistry() : GlobalRegistry {
  const registry = BuildTestRegistry();

  AddCameraViewing(registry, 0, 0);

  return registry;
}

/**
 * Points the viewport's top-left corner at a world tile.
 *
 * Per axis, and stated as the corner, because that is the coordinate the
 * renderer's screen mapping is expressed in; the camera's own Position is half a
 * viewport away from it.
 */
const SetViewOriginX = (registry : GlobalRegistry, originX : number) => { FindCameraPosition(registry)!.x = originX + GameWidth / 2; };
const SetViewOriginY = (registry : GlobalRegistry, originY : number) => { FindCameraPosition(registry)!.y = originY + GameWidth / 2; };

describe("single-tile rendering", () => {
  it("draws a glyph at its screen cell", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, 3, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toEqual([{ model: "@", canvasX: 3 * TileSizePixels + HalfCell, canvasY: 4 * TileSizePixels + HalfCell, fillStyle: expect.any(String) }]);
  });

  it("skips a glyph outside the viewport", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, GameWidth + 5, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });

  it("skips a glyph at a negative world position when the camera is at the origin", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, -1, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });
});

describe("camera offset", () => {
  it("shifts a glyph's screen position", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    SetViewOriginX(registry, 20);
    SetViewOriginY(registry, 30);
    AddGlyph(registry, 25, 35, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect([drawnGlyphs[0]?.canvasX, drawnGlyphs[0]?.canvasY]).toEqual([5 * TileSizePixels + HalfCell, 5 * TileSizePixels + HalfCell]);
  });

  it("brings a negative world position into view", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    SetViewOriginX(registry, -50);
    SetViewOriginY(registry, -50);
    AddGlyph(registry, -45, -45, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(1);
  });

  it("scrolls a previously visible glyph off screen", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    SetViewOriginX(registry, 500);
    AddGlyph(registry, 5, 5, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });
});

describe("multi-tile rendering", () => {
  it("draws every tile of a fully visible block", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 10, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(100);
  });

  it("draws only the visible sub-rectangle of a straddling block", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    // Half of a 20-wide block hangs off the left edge.
    AddBlock(registry, -10, 0, 20, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(10 * 10);
  });

  it("clips a block hanging off the right edge", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, GameWidth - 4, 0, 20, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(4 * 10);
  });

  it("draws nothing for an entirely off-screen block", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, GameWidth + 50, 0, 20, 20);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });

  it("positions tiles relative to the block origin", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 7, 9, 2, 2);

    RenderCanvas(registry, resources);

    const positions = drawnGlyphs.map((glyph) => [glyph.canvasX / TileSizePixels - 0.5, glyph.canvasY / TileSizePixels - 0.5]);
    expect(positions.sort()).toEqual([[7, 9], [7, 10], [8, 9], [8, 10]].sort());
  });

  it("shifts with the camera", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    SetViewOriginX(registry, 100);
    SetViewOriginY(registry, 100);
    AddBlock(registry, 100, 100, 3, 3);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(9);
    expect(drawnGlyphs[0]?.canvasX).toBe(HalfCell);
  });
});

describe("layer resolution across both paths", () => {
  it("a higher-layer glyph overdraws terrain in the same cell", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 5, 5);
    AddGlyph(registry, 2, 2, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    // 25 terrain cells, one of which is now the player rather than terrain.
    expect(drawnGlyphs).toHaveLength(25);
    expect(drawnGlyphs.filter((glyph) => glyph.model === "@")).toHaveLength(1);
  });

  it("a lower-layer glyph does not overdraw terrain", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 5, 5, PlayerLayer);
    AddGlyph(registry, 2, 2, "@", BackgroundLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs.filter((glyph) => glyph.model === "@")).toHaveLength(0);
  });

  it("each screen cell is drawn at most once", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 8, 8);
    AddBlock(registry, 0, 0, 8, 8);
    AddGlyph(registry, 1, 1, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    const cells = drawnGlyphs.map((glyph) => `${glyph.canvasX},${glyph.canvasY}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

// PanCamera moves the camera by a fraction of a tile per frame, so the origin is
// almost never whole. It used to be subtracted raw, which made the multi-tile
// loop bounds fractional, which made paletteIndices[rowOffset + localX] a
// fractional index into a Uint8Array: undefined, swallowed by a ?? 0, so every
// tile of the chunk drew as palette[0]. On screen that read as terrain that
// never loaded, and only for chunks above or left of the camera.
describe("a camera between tiles", () => {
  const MixedPalette = [new Representation(".", GameColors.Water), new Representation("^", GameColors.Mountain)] as const;

  /** A block whose tiles alternate between the two palette entries. */
  const AddMixedBlock = (registry : GlobalRegistry, worldX : number, worldY : number, size : number) => {
    const indices = new Uint8Array(size * size);
    for (let i = 0; i < indices.length; i++) indices[i] = i % 2;

    return new EntityBuilder(registry)
      .AddPosition(new Position(worldX, worldY))
      .AddLayer(new Layer(BackgroundLayer))
      .AddMultiTileRepresentation(new MultiTileRepresentation(size, size, indices, MixedPalette))
      .GetEntity();
  };

  it("draws a block above it with its real glyphs, not a flat fill", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    // Fractional, and positive, so the block above sits at a negative screen
    // origin -- the case that produced the fractional loop bounds.
    SetViewOriginY(registry, 10.37);
    // Tall enough to still reach the screen from up there.
    AddMixedBlock(registry, 0, 0, 30);

    RenderCanvas(registry, resources);

    expect(new Set(drawnGlyphs.map((glyph) => glyph.model))).toEqual(new Set([".", "^"]));
  });

  it("draws the same cells as it would from the whole tile below", () => {
    const registry = BuildRenderRegistry();
    const whole = CreateRecordingRenderingResources();
    const fractional = CreateRecordingRenderingResources();
    AddMixedBlock(registry, 0, 0, 30);

    // One camera, panned between the two draws, rather than two cameras: there
    // is exactly one camera in a world now, and asking for a second throws.
    SetViewOriginX(registry, 10);
    RenderCanvas(registry, whole.resources);

    SetViewOriginX(registry, 10.63);
    RenderCanvas(registry, fractional.resources);

    // The viewport is a whole-tile grid, so a sub-tile pan shows the same tiles
    // until the origin crosses into the next one.
    expect(fractional.drawnGlyphs).toEqual(whole.drawnGlyphs);
  });

  // Negative origins are where truncation and flooring disagree, and the click
  // path shares this floor: get it wrong and clicks land a row off the glyph.
  it("places a block below it by rounding the origin down, not towards zero", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    SetViewOriginY(registry, -10.37);
    AddMixedBlock(registry, 0, 0, 10);

    RenderCanvas(registry, resources);

    // World row 0 sits 11 rows below a camera whose origin tile is -11.
    const screenRows = new Set(drawnGlyphs.map((glyph) => glyph.canvasY / TileSizePixels - 0.5));
    expect(screenRows).toEqual(new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
    expect(new Set(drawnGlyphs.map((glyph) => glyph.model))).toEqual(new Set([".", "^"]));
  });
});

describe("fill style memoisation", () => {
  it("writes one style per colour run, not one per tile", () => {
    const registry = BuildRenderRegistry();
    const { resources, GetFillStyleWriteCount } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 20, 20);

    RenderCanvas(registry, resources);

    // 400 tiles of one colour, plus the background clear.
    expect(GetFillStyleWriteCount()).toBeLessThan(5);
  });
});

describe("without a camera", () => {
  // There is no viewpoint to draw from, and the cleared background is the honest
  // answer -- falling back to the world origin would show a view nothing chose.
  it("draws nothing and does not throw", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, 3, 4, "@", PlayerLayer);

    expect(() => RenderCanvas(registry, resources)).not.toThrow();
    expect(drawnGlyphs).toHaveLength(0);
  });

  it("still clears the canvas", () => {
    const registry = BuildTestRegistry();
    const { resources, GetFillStyleWriteCount } = CreateRecordingRenderingResources();

    RenderCanvas(registry, resources);

    expect(GetFillStyleWriteCount()).toBeGreaterThan(0);
  });
});

// A menu's backdrop has to be opaque, and a glyph cannot do that: monospace
// advance width is about 0.6em, so a "solid" panel drawn as full-block
// characters comes out as vertical stripes with the world showing between them.
describe("cell-filling representations", () => {
  const AddSolidTile = (registry : GlobalRegistry, worldX : number, worldY : number) =>
    new EntityBuilder(registry)
      .AddPosition(new Position(worldX, worldY))
      .AddLayer(new Layer(PlayerLayer))
      .AddRepresentation(new Representation("#", GameColors.Player, true))
      .GetEntity();

  it("is painted as a rectangle rather than drawn as a glyph", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();

    AddSolidTile(registry, 3, 4);
    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });

  it("covers the tile edge to edge, anchored at its corner", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnRects } = CreateRecordingRenderingResources();

    AddSolidTile(registry, 3, 4);
    RenderCanvas(registry, resources);

    // The first rect is the frame's background clear; the tile follows it.
    expect(drawnRects.at(-1)).toMatchObject({
      canvasX: 3 * TileSizePixels,
      canvasY: 4 * TileSizePixels,
      width: TileSizePixels,
      height: TileSizePixels,
    });
  });

  it("keeps a glyph above it, drawing both", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddSolidTile(registry, 3, 4);
    AddGlyph(registry, 3, 4, "@", PlayerLayer + 1);
    RenderCanvas(registry, resources);

    // Both, in that order. A single-winner buffer dropped the fill here, which is
    // what put a black hole behind every character of a menu.
    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["@"]);
    expect(drawnRects).toHaveLength(2);
  });

  // AddRepresentation copies rather than stores, so the flag has to survive it
  // or every panel built through the builder would silently go back to striping.
  it("survives being copied by EntityBuilder", () => {
    const registry = BuildRenderRegistry();
    const entity = AddSolidTile(registry, 0, 0);

    expect(registry.GetComponent(entity, Representation)?.fillsCell).toBe(true);
  });
});

// Menus need a full-screen backdrop, and doing that a cell at a time would be
// GameWidth squared entities rebuilt on every cursor move.
describe("screen-anchored multi-tile blocks", () => {
  const StripePalette = [
    new Representation("#", GameColors.Background, true),
    new Representation("#", GameColors.Mountain, true),
  ] as const;

  /** A full-viewport block of alternating columns, as the menu scrim is. */
  const AddScreenStripes = (registry : GlobalRegistry, layerIndex : number) => {
    const indices = new Uint8Array(GameWidth * GameWidth);

    for (let y = 0; y < GameWidth; y++) {
      for (let x = 0; x < GameWidth; x++) indices[y * GameWidth + x] = x % 2;
    }

    const entity = new EntityBuilder(registry)
      .AddLayer(new Layer(layerIndex))
      .AddMultiTileRepresentation(new MultiTileRepresentation(GameWidth, GameWidth, indices, StripePalette))
      .GetEntity();

    registry.RegisterEntity(entity, ScreenPosition, new ScreenPosition(0, 0));

    return entity;
  };

  it("covers every cell of the viewport", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnRects } = CreateRecordingRenderingResources();

    AddScreenStripes(registry, PlayerLayer);
    RenderCanvas(registry, resources);

    // Every tile, plus the one full-canvas clear at the top of the frame.
    expect(drawnRects).toHaveLength(GameWidth * GameWidth + 1);
  });

  // Screen-anchored, so unlike terrain it must not shift when the camera moves.
  it("does not move with the camera", () => {
    const registry = BuildRenderRegistry();

    AddScreenStripes(registry, PlayerLayer);

    const before = CreateRecordingRenderingResources();
    RenderCanvas(registry, before.resources);

    SetViewOriginX(registry, 37);
    SetViewOriginY(registry, -14);

    const after = CreateRecordingRenderingResources();
    RenderCanvas(registry, after.resources);

    expect(after.drawnRects).toEqual(before.drawnRects);
  });

  it("composites a glyph above it without losing the cell", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddScreenStripes(registry, PlayerLayer);
    AddGlyph(registry, 3, 4, "@", PlayerLayer + 1);
    RenderCanvas(registry, resources);

    // Every cell still fills, including the one the glyph sits on -- plus the
    // clear. This is the menu panel and its text, in miniature.
    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["@"]);
    expect(drawnRects).toHaveLength(GameWidth * GameWidth + 1);
  });

  it("hides a glyph beneath it", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();

    AddScreenStripes(registry, PlayerLayer);
    AddGlyph(registry, 3, 4, "@", PlayerLayer - 1);
    RenderCanvas(registry, resources);

    // A fill is opaque, so what is behind it does not draw. This is what stops
    // terrain reading through a menu panel.
    expect(drawnGlyphs).toHaveLength(0);
  });
});

/**
 * A cell holds a background and a glyph, not one winner.
 *
 * The single-winner buffer this replaced made a higher layer *erase* a lower one,
 * so menu text beat the panel it was written on and the panel cell was never
 * painted -- every character sat in a black hole showing the frame's clear.
 */
describe("compositing a background with a glyph", () => {
  const AddFill = (registry : GlobalRegistry, worldX : number, worldY : number, layerIndex : number) =>
    new EntityBuilder(registry)
      .AddPosition(new Position(worldX, worldY))
      .AddLayer(new Layer(layerIndex))
      .AddRepresentation(new Representation("#", GameColors.Mountain, true))
      .GetEntity();

  /** Rects excluding the frame's opening full-canvas clear. */
  const TileFills = (drawnRects : ReturnType<typeof CreateRecordingRenderingResources>["drawnRects"]) =>
    drawnRects.filter((rect) => rect.width === TileSizePixels && rect.height === TileSizePixels);

  it("draws a glyph over a fill below it", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddFill(registry, 2, 2, PlayerLayer);
    AddGlyph(registry, 2, 2, "@", PlayerLayer + 1);
    RenderCanvas(registry, resources);

    expect(TileFills(drawnRects)).toHaveLength(1);
    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["@"]);
  });

  it("suppresses a glyph under a fill above it", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddGlyph(registry, 2, 2, "@", PlayerLayer);
    AddFill(registry, 2, 2, PlayerLayer + 1);
    RenderCanvas(registry, resources);

    expect(TileFills(drawnRects)).toHaveLength(1);
    expect(drawnGlyphs).toHaveLength(0);
  });

  it("draws a lone glyph with no fill under it", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddGlyph(registry, 2, 2, "@", PlayerLayer);
    RenderCanvas(registry, resources);

    expect(TileFills(drawnRects)).toHaveLength(0);
    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["@"]);
  });

  // Two opaque fills in one cell: only the top one can be seen, so only it draws.
  it("keeps just the topmost of two fills", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnRects } = CreateRecordingRenderingResources();

    AddFill(registry, 2, 2, PlayerLayer);
    AddFill(registry, 2, 2, PlayerLayer + 1);
    RenderCanvas(registry, resources);

    expect(TileFills(drawnRects)).toHaveLength(1);
  });

  // Only the topmost glyph, exactly as before -- a character grid holds one
  // character per cell, and this is how the player draws over terrain.
  it("keeps just the topmost of two glyphs", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();

    AddGlyph(registry, 2, 2, "low", BackgroundLayer);
    AddGlyph(registry, 2, 2, "high", PlayerLayer);
    RenderCanvas(registry, resources);

    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["high"]);
  });

  // The cell is listed once for the blit however many times it is written to.
  it("does not draw a cell twice when it takes a fill and a glyph", () => {
    const registry = BuildRenderRegistry();
    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources();

    AddFill(registry, 2, 2, PlayerLayer);
    AddGlyph(registry, 2, 2, "@", PlayerLayer + 1);
    AddFill(registry, 2, 2, PlayerLayer + 2);
    AddGlyph(registry, 2, 2, "!", PlayerLayer + 3);
    RenderCanvas(registry, resources);

    expect(TileFills(drawnRects)).toHaveLength(1);
    expect(drawnGlyphs.map((glyph) => glyph.model)).toEqual(["!"]);
  });
});
