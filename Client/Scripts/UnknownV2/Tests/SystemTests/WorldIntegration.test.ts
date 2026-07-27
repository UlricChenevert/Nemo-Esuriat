import { describe, it, expect } from "vitest";
import { CreateWorldStreamingResources } from "../../Systems.World/CreateWorldStreamingResources.ts";
import { StreamChunks } from "../../Systems.World/StreamChunks.ts";
import { CentreCameraOnPlayer } from "../../Systems.World/CentreCameraOnPlayer.ts";
import { PanCamera } from "../../Systems.World/PanCamera.ts";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { ChunkGridWidth, ChunkWidth } from "../../Configuration/WorldConstants.ts";
import { CameraPanSpeed, GameWidth } from "../../Configuration/GameConstants.ts";
import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { CharacterRepresentation } from "../../Configuration/DisplayConstants.ts";
import { InputResources, TimeResources } from "../../Contracts/SystemResources.ts";
import { BuildTestRegistry, AddPlayerAt } from "../TestHelpers/BuildTestRegistry.ts";
import { CreateRecordingRenderingResources } from "../TestHelpers/RecordingRenderingResources.ts";

const TerrainGlyphs = new Set([
  CharacterRepresentation.Water, CharacterRepresentation.Grass,
  CharacterRepresentation.Hill, CharacterRepresentation.Mountain,
]);

const HalfViewport = Math.floor(GameWidth / 2);

type Rendering = ReturnType<typeof CreateRecordingRenderingResources>;

/** Runs the world half of the game loop for one frame. */
function Tick(registry : ReturnType<typeof BuildTestRegistry>, world : ReturnType<typeof CreateWorldStreamingResources>, rendering : Rendering) {
  StreamChunks(registry, world, rendering.resources.Camera);
  RenderCanvas(registry, rendering.resources);
}

/** Points the viewport centre at a world tile, as panning there would. */
function LookAt(rendering : Rendering, x : number, y : number) {
  rendering.resources.Camera.worldOriginX = x - HalfViewport;
  rendering.resources.Camera.worldOriginY = y - HalfViewport;
}

/** A fresh recorder already looking at a world tile. */
function LookingAt(x : number, y : number) : Rendering {
  const rendering = CreateRecordingRenderingResources();
  LookAt(rendering, x, y);
  return rendering;
}

describe("composition root", () => {
  it("builds without a DOM", () => expect(() => CreateWorldStreamingResources()).not.toThrow());
  it("starts with no chunk buffer position", () => expect(Number.isNaN(CreateWorldStreamingResources().lastCenterChunkX)).toBe(true));
});

describe("a rendered frame", () => {
  it("fills every cell of the viewport with terrain", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(0, 0);

    Tick(registry, world, rendering);

    // The whole screen is covered: the chunk buffer is large enough to reach
    // every corner no matter where in its centre chunk the camera looks.
    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
  });

  it("draws only terrain glyphs", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(0, 0);

    Tick(registry, world, rendering);

    expect(rendering.drawnGlyphs.every((glyph) => TerrainGlyphs.has(glyph.model))).toBe(true);
  });

  it("shows more than one kind of terrain", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(0, 0);

    Tick(registry, world, rendering);

    expect(new Set(rendering.drawnGlyphs.map((glyph) => glyph.model)).size).toBeGreaterThan(1);
  });
});

describe("panning the world", () => {
  it("keeps the viewport fully covered from every corner of the centre chunk", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();

    // The tightest case for the buffer: looking at each extreme of a chunk.
    for (const [x, y] of [[0, 0], [ChunkWidth - 1, 0], [0, ChunkWidth - 1], [ChunkWidth - 1, ChunkWidth - 1]]) {
      const rendering = LookingAt(x!, y!);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered panning far into negative space", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step > -300; step -= 17) {
      const rendering = LookingAt(step, step);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered panning diagonally across many chunks", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step < 400; step += 23) {
      const rendering = LookingAt(step, step);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("reproduces the same terrain after panning away and back", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();

    const before = LookingAt(0, 0);
    Tick(registry, world, before);

    // Far enough that the cache cannot be what carries the terrain back.
    Tick(registry, world, LookingAt(5000, 5000));

    const after = LookingAt(0, 0);
    Tick(registry, world, after);

    expect(after.drawnGlyphs).toEqual(before.drawnGlyphs);
  });

  it("never leaves stale chunks behind", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step < 500; step += 31) Tick(registry, world, LookingAt(step, -step));

    let chunkCount = 0;
    registry.ForEachEntityWith([ChunkCoordinate], () => { chunkCount++; });

    expect(chunkCount).toBe(ChunkGridWidth * ChunkGridWidth);
  });
});

describe("keyboard input drives the world", () => {
  /** A tick long enough to pan exactly `tiles` tiles. */
  const TickOf = (tiles : number) => {
    const time = new TimeResources();
    time.deltaSeconds = tiles / CameraPanSpeed;
    return time;
  };

  // The full chain the black-screen and dropped-keypress reports were about: a
  // key lands in the queue, a system consumes it, the camera scrolls, and
  // streaming reacts to where it now points.
  it("a held key scrolls the camera", async () => {
    const { EventQueue } = await import("../../Systems.Framework/EventQueue.ts");
    const { LinkedList } = await import("../../Libraries/FastList/FastList.ts");
    const { GameKeyboardEvent } = await import("../../Contracts/Events/KeyBoardEvent.ts");

    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(0, 0);

    Tick(registry, world, rendering);
    const cameraBefore = rendering.resources.Camera.worldOriginX;

    const queue = new EventQueue(new LinkedList());
    queue.EnqueueEvent(new GameKeyboardEvent({ code: "ArrowRight", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, true));
    PanCamera(queue, new InputResources(), rendering.resources.Camera, TickOf(1));

    // Same rendering resource, so the camera carries over between frames.
    Tick(registry, world, rendering);

    expect(rendering.resources.Camera.worldOriginX).toBe(cameraBefore + 1);
    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth * 2);
  });

  it("panning across a chunk boundary streams new terrain", async () => {
    const { EventQueue } = await import("../../Systems.Framework/EventQueue.ts");
    const { LinkedList } = await import("../../Libraries/FastList/FastList.ts");
    const { GameKeyboardEvent } = await import("../../Contracts/Events/KeyBoardEvent.ts");

    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(ChunkWidth - 1, 0);

    Tick(registry, world, rendering);
    const before = new Set<string>();
    registry.ForEachEntityWith([ChunkCoordinate], (_e, chunk) => { before.add(`${chunk.chunkX},${chunk.chunkY}`); });

    // One tile right carries the viewport centre into the next chunk.
    const queue = new EventQueue(new LinkedList());
    queue.EnqueueEvent(new GameKeyboardEvent({ code: "ArrowRight", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, true));
    PanCamera(queue, new InputResources(), rendering.resources.Camera, TickOf(1));

    const after = new Set<string>();
    Tick(registry, world, rendering);
    registry.ForEachEntityWith([ChunkCoordinate], (_e, chunk) => { after.add(`${chunk.chunkX},${chunk.chunkY}`); });

    expect(after).not.toEqual(before);
  });
});

describe("the camera at startup", () => {
  it("puts the player at the centre of the viewport", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry, rendering.resources.Camera);
    Tick(registry, world, rendering);

    // Nothing gives the test player a Representation, so terrain fills the
    // centre cell; what matters is that the camera put the player there.
    expect([137 - rendering.resources.Camera.worldOriginX, -42 - rendering.resources.Camera.worldOriginY])
      .toEqual([HalfViewport, HalfViewport]);
  });

  it("streams the terrain around wherever it starts", () => {
    const registry = BuildTestRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry, rendering.resources.Camera);
    Tick(registry, world, rendering);

    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
  });
});
