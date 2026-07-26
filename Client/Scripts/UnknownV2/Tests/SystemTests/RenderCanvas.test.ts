import { describe, it, expect } from "vitest";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { BackgroundLayer, PlayerLayer, TileSizePixels, GameColors } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
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

describe("single-tile rendering", () => {
  it("draws a glyph at its screen cell", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, 3, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toEqual([{ model: "@", canvasX: 3 * TileSizePixels + HalfCell, canvasY: 4 * TileSizePixels + HalfCell, fillStyle: expect.any(String) }]);
  });

  it("skips a glyph outside the viewport", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, GameWidth + 5, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });

  it("skips a glyph at a negative world position when the camera is at the origin", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddGlyph(registry, -1, 4, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });
});

describe("camera offset", () => {
  it("shifts a glyph's screen position", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    resources.Camera.worldOriginX = 20;
    resources.Camera.worldOriginY = 30;
    AddGlyph(registry, 25, 35, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect([drawnGlyphs[0]?.canvasX, drawnGlyphs[0]?.canvasY]).toEqual([5 * TileSizePixels + HalfCell, 5 * TileSizePixels + HalfCell]);
  });

  it("brings a negative world position into view", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    resources.Camera.worldOriginX = -50;
    resources.Camera.worldOriginY = -50;
    AddGlyph(registry, -45, -45, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(1);
  });

  it("scrolls a previously visible glyph off screen", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    resources.Camera.worldOriginX = 500;
    AddGlyph(registry, 5, 5, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });
});

describe("multi-tile rendering", () => {
  it("draws every tile of a fully visible block", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 10, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(100);
  });

  it("draws only the visible sub-rectangle of a straddling block", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    // Half of a 20-wide block hangs off the left edge.
    AddBlock(registry, -10, 0, 20, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(10 * 10);
  });

  it("clips a block hanging off the right edge", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, GameWidth - 4, 0, 20, 10);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(4 * 10);
  });

  it("draws nothing for an entirely off-screen block", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, GameWidth + 50, 0, 20, 20);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(0);
  });

  it("positions tiles relative to the block origin", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 7, 9, 2, 2);

    RenderCanvas(registry, resources);

    const positions = drawnGlyphs.map((glyph) => [glyph.canvasX / TileSizePixels - 0.5, glyph.canvasY / TileSizePixels - 0.5]);
    expect(positions.sort()).toEqual([[7, 9], [7, 10], [8, 9], [8, 10]].sort());
  });

  it("shifts with the camera", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    resources.Camera.worldOriginX = 100;
    resources.Camera.worldOriginY = 100;
    AddBlock(registry, 100, 100, 3, 3);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs).toHaveLength(9);
    expect(drawnGlyphs[0]?.canvasX).toBe(HalfCell);
  });
});

describe("layer resolution across both paths", () => {
  it("a higher-layer glyph overdraws terrain in the same cell", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 5, 5);
    AddGlyph(registry, 2, 2, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    // 25 terrain cells, one of which is now the player rather than terrain.
    expect(drawnGlyphs).toHaveLength(25);
    expect(drawnGlyphs.filter((glyph) => glyph.model === "@")).toHaveLength(1);
  });

  it("a lower-layer glyph does not overdraw terrain", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 5, 5, PlayerLayer);
    AddGlyph(registry, 2, 2, "@", BackgroundLayer);

    RenderCanvas(registry, resources);

    expect(drawnGlyphs.filter((glyph) => glyph.model === "@")).toHaveLength(0);
  });

  it("each screen cell is drawn at most once", () => {
    const registry = BuildTestRegistry();
    const { resources, drawnGlyphs } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 8, 8);
    AddBlock(registry, 0, 0, 8, 8);
    AddGlyph(registry, 1, 1, "@", PlayerLayer);

    RenderCanvas(registry, resources);

    const cells = drawnGlyphs.map((glyph) => `${glyph.canvasX},${glyph.canvasY}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe("fill style memoisation", () => {
  it("writes one style per colour run, not one per tile", () => {
    const registry = BuildTestRegistry();
    const { resources, GetFillStyleWriteCount } = CreateRecordingRenderingResources();
    AddBlock(registry, 0, 0, 20, 20);

    RenderCanvas(registry, resources);

    // 400 tiles of one colour, plus the background clear.
    expect(GetFillStyleWriteCount()).toBeLessThan(5);
  });
});
