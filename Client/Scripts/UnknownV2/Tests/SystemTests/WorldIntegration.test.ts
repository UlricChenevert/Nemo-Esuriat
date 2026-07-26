import { describe, it, expect } from "vitest";
import { CreateWorldStreamingResources } from "../../Systems.World/CreateWorldStreamingResources.ts";
import { StreamChunks } from "../../Systems.World/StreamChunks.ts";
import { UpdateCamera } from "../../Systems.World/UpdateCamera.ts";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { ChunkWidth } from "../../Configuration/WorldConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { CharacterRepresentation } from "../../Configuration/DisplayConstants.ts";
import { BuildTestRegistry, AddPlayerAt } from "../TestHelpers/BuildTestRegistry.ts";
import { CreateRecordingRenderingResources } from "../TestHelpers/RecordingRenderingResources.ts";

const TerrainGlyphs = new Set([
  CharacterRepresentation.Water, CharacterRepresentation.Grass,
  CharacterRepresentation.Hill, CharacterRepresentation.Mountain,
]);

/** Runs the world half of the game loop for one frame. */
function Tick(registry : ReturnType<typeof BuildTestRegistry>, world : ReturnType<typeof CreateWorldStreamingResources>, rendering : ReturnType<typeof CreateRecordingRenderingResources>) {
  StreamChunks(registry, world);
  UpdateCamera(registry, rendering.resources.Camera);
  RenderCanvas(registry, rendering.resources);
}

describe("composition root", () => {
  it("builds without a DOM", () => expect(() => CreateWorldStreamingResources()).not.toThrow());
  it("starts with no chunk buffer position", () => expect(Number.isNaN(CreateWorldStreamingResources().lastCenterChunkX)).toBe(true));
});

describe("a rendered frame", () => {
  it("fills every cell of the viewport with terrain", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 0, 0);

    Tick(registry, world, rendering);

    // The whole screen is covered: the chunk buffer is large enough to reach
    // every corner no matter where in its centre chunk the player stands.
    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
  });

  it("draws only terrain glyphs", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 0, 0);

    Tick(registry, world, rendering);

    expect(rendering.drawnGlyphs.every((glyph) => TerrainGlyphs.has(glyph.model))).toBe(true);
  });

  it("shows more than one kind of terrain", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 0, 0);

    Tick(registry, world, rendering);

    expect(new Set(rendering.drawnGlyphs.map((glyph) => glyph.model)).size).toBeGreaterThan(1);
  });
});

describe("walking the world", () => {
  it("keeps the viewport fully covered from every corner of the centre chunk", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const player = AddPlayerAt(registry, 0, 0);

    // The tightest case for the buffer: standing at each extreme of a chunk.
    for (const [x, y] of [[0, 0], [ChunkWidth - 1, 0], [0, ChunkWidth - 1], [ChunkWidth - 1, ChunkWidth - 1]]) {
      const rendering = CreateRecordingRenderingResources();
      registry.RegisterEntity(player, Position, new Position(x!, y!));

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered walking far into negative space", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const player = AddPlayerAt(registry, 0, 0);

    for (let step = 0; step > -300; step -= 17) {
      const rendering = CreateRecordingRenderingResources();
      registry.RegisterEntity(player, Position, new Position(step, step));

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered walking diagonally across many chunks", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const player = AddPlayerAt(registry, 0, 0);

    for (let step = 0; step < 400; step += 23) {
      const rendering = CreateRecordingRenderingResources();
      registry.RegisterEntity(player, Position, new Position(step, step));

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("reproduces the same terrain after walking away and back", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const player = AddPlayerAt(registry, 0, 0);

    const before = CreateRecordingRenderingResources();
    Tick(registry, world, before);

    // Far enough that the cache cannot be what carries the terrain back.
    registry.RegisterEntity(player, Position, new Position(5000, 5000));
    Tick(registry, world, CreateRecordingRenderingResources());

    registry.RegisterEntity(player, Position, new Position(0, 0));
    const after = CreateRecordingRenderingResources();
    Tick(registry, world, after);

    expect(after.drawnGlyphs).toEqual(before.drawnGlyphs);
  });

  it("never leaves stale chunks behind", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const player = AddPlayerAt(registry, 0, 0);

    for (let step = 0; step < 500; step += 31) {
      registry.RegisterEntity(player, Position, new Position(step, -step));
      Tick(registry, world, CreateRecordingRenderingResources());
    }

    let chunkCount = 0;
    registry.ForEachEntityWith([ChunkCoordinate], () => { chunkCount++; });

    expect(chunkCount).toBe(9);
  });
});

describe("the player over terrain", () => {
  it("is drawn at the centre of the viewport", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 137, -42);

    Tick(registry, world, rendering);

    // Nothing gives the test player a Representation, so terrain fills the
    // centre cell; what matters is that the camera put the player there.
    expect([137 - rendering.resources.Camera.worldOriginX, -42 - rendering.resources.Camera.worldOriginY])
      .toEqual([Math.floor(GameWidth / 2), Math.floor(GameWidth / 2)]);
  });
});
