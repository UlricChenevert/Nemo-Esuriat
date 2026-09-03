import { describe, it, expect } from "vitest";
import { CreateWorldStreamingResources } from "../../Utilities/CreateWorldStreamingResources.ts";
import { StreamChunks } from "../../Systems.Gameloop/StreamChunks.ts";
import { CentreCameraOnPlayer, FindCameraEntity, FindCameraPosition, ScreenTileOfWorldTile } from "../../Utilities/CameraUtilities.ts";
import { CameraActions, PanCamera } from "../../Systems.Gameloop/PanCamera.ts";
import { ResolveInputActions } from "../../Systems.Gameloop/ResolveInputActions.ts";
import { GameKeyboardEvent } from "../../Contracts/Events/KeyBoardEvent.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { ChunkGridWidth, ChunkWidth } from "../../Configuration/WorldConstants.ts";
import { CameraPanSpeed, GameWidth } from "../../Configuration/GameConstants.ts";
import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { CharacterRepresentation, TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import { InputResources, TimeResources } from "../../Contracts/SystemResources.ts";
import { AddCameraAt, BuildTestRegistry, AddPlayerAt } from "../TestHelpers/BuildTestRegistry.ts";
import { CreateRecordingRenderingResources } from "../TestHelpers/RecordingRenderingResources.ts";

const TerrainGlyphs = new Set([
  CharacterRepresentation.Water, CharacterRepresentation.Grass,
  CharacterRepresentation.Hill, CharacterRepresentation.Mountain,
]);

const HalfViewport = Math.floor(GameWidth / 2);

type Registry = ReturnType<typeof BuildTestRegistry>;
type Rendering = ReturnType<typeof CreateRecordingRenderingResources>;

/**
 * A registry with the camera in it, since the camera is an entity now rather
 * than part of the rendering resources.
 */
function BuildWorldRegistry() : Registry {
  const registry = BuildTestRegistry();

  AddCameraAt(registry, 0, 0);

  return registry;
}

/** Runs the world half of the game loop for one frame. */
function Tick(registry : Registry, world : ReturnType<typeof CreateWorldStreamingResources>, rendering : Rendering) {
  StreamChunks(registry, world);
  RenderCanvas(registry, rendering.resources);
}

/** Points the viewport centre at a world tile, as panning there would. */
function LookAt(registry : Registry, x : number, y : number) {
  const camera = FindCameraPosition(registry)!;

  // The camera's position IS the viewport centre, so this is a straight write.
  camera.x = x;
  camera.y = y;
}

/**
 * Aims the world's camera at a tile and hands back a fresh recorder for the
 * frame drawn from there.
 *
 * The recorder is per-frame but the camera is not: there is one camera in a
 * world, and it carries over between the frames a test runs.
 */
function LookingAt(registry : Registry, x : number, y : number) : Rendering {
  LookAt(registry, x, y);

  return CreateRecordingRenderingResources();
}

describe("composition root", () => {
  it("builds without a DOM", () => expect(() => CreateWorldStreamingResources()).not.toThrow());
  it("starts with no chunk buffer position", () => expect(Number.isNaN(CreateWorldStreamingResources().lastCenterChunkX)).toBe(true));
});

describe("a rendered frame", () => {
  it("fills every cell of the viewport with terrain", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, 0, 0);

    Tick(registry, world, rendering);

    // The whole screen is covered: the chunk buffer is large enough to reach
    // every corner no matter where in its centre chunk the camera looks.
    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
  });

  it("draws only terrain glyphs", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, 0, 0);

    Tick(registry, world, rendering);

    expect(rendering.drawnGlyphs.every((glyph) => TerrainGlyphs.has(glyph.model))).toBe(true);
  });

  it("shows more than one kind of terrain", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, 0, 0);

    Tick(registry, world, rendering);

    expect(new Set(rendering.drawnGlyphs.map((glyph) => glyph.model)).size).toBeGreaterThan(1);
  });
});

describe("panning the world", () => {
  it("keeps the viewport fully covered from every corner of the centre chunk", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    // The tightest case for the buffer: looking at each extreme of a chunk.
    for (const [x, y] of [[0, 0], [ChunkWidth - 1, 0], [0, ChunkWidth - 1], [ChunkWidth - 1, ChunkWidth - 1]]) {
      const rendering = LookingAt(registry, x!, y!);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered panning far into negative space", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step > -300; step -= 17) {
      const rendering = LookingAt(registry, step, step);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("stays covered panning diagonally across many chunks", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step < 400; step += 23) {
      const rendering = LookingAt(registry, step, step);

      Tick(registry, world, rendering);

      expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
    }
  });

  it("reproduces the same terrain after panning away and back", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    const before = LookingAt(registry, 0, 0);
    Tick(registry, world, before);

    // Far enough that the cache cannot be what carries the terrain back.
    Tick(registry, world, LookingAt(registry, 5000, 5000));

    const after = LookingAt(registry, 0, 0);
    Tick(registry, world, after);

    expect(after.drawnGlyphs).toEqual(before.drawnGlyphs);
  });

  it("never leaves stale chunks behind", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    for (let step = 0; step < 500; step += 31) Tick(registry, world, LookingAt(registry, step, -step));

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

  /**
   * One frame of "the pan key is down", through the real pipeline: the key goes
   * into the queue, ResolveInputActions turns it into PanCameraRight and routes
   * it to the camera's own listener, and PanCamera acts on what it heard.
   *
   * The listener is attached here rather than in BuildWorldRegistry because it
   * is what makes this chain a keyboard test -- a camera with no listener is
   * deaf, which is the point of the layer stack.
   */
  function PanRight(registry : Registry, tiles : number) {
    const input = new InputResources();
    const layer = PushInputLayer(registry, input);

    new EntityBuilder(registry, FindCameraEntity(registry)!).AddActionListener(layer, ...CameraActions);

    const queue = new EventQueue(new LinkedList());
    queue.EnqueueEvent(new GameKeyboardEvent({ code: "KeyD", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, true));

    ResolveInputActions(registry, queue, input);
    PanCamera(registry, TickOf(tiles));
  }

  // The full chain the black-screen and dropped-keypress reports were about: a
  // key lands in the queue, a system consumes it, the camera scrolls, and
  // streaming reacts to where it now points.
  it("a held key scrolls the camera", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, 0, 0);

    Tick(registry, world, rendering);
    const cameraBefore = FindCameraPosition(registry)!.x;

    PanRight(registry, 1);

    // Same rendering resource, so the camera carries over between frames.
    Tick(registry, world, rendering);

    expect(FindCameraPosition(registry)!.x).toBe(cameraBefore + 1);
    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth * 2);
  });

  it("panning across a chunk boundary streams new terrain", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, ChunkWidth - 1, 0);

    Tick(registry, world, rendering);
    const before = new Set<string>();
    registry.ForEachEntityWith([ChunkCoordinate], (_e, chunk) => { before.add(`${chunk.chunkX},${chunk.chunkY}`); });

    // One tile right carries the viewport centre into the next chunk.
    PanRight(registry, 1);

    const after = new Set<string>();
    Tick(registry, world, rendering);
    registry.ForEachEntityWith([ChunkCoordinate], (_e, chunk) => { after.add(`${chunk.chunkX},${chunk.chunkY}`); });

    expect(after).not.toEqual(before);
  });
});

describe("the camera at startup", () => {
  it("puts the player at the centre of the viewport", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry);
    Tick(registry, world, rendering);

    // Nothing gives the test player a Representation, so terrain fills the
    // centre cell; what matters is that the camera put the player there.
    // Asserted through the renderer's own mapping rather than against the
    // camera's raw coordinates, so this pins where the player is DRAWN.
    expect(ScreenTileOfWorldTile(FindCameraPosition(registry)!, 137, -42))
      .toEqual({ screenX: HalfViewport, screenY: HalfViewport });
  });

  it("streams the terrain around wherever it starts", () => {
    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = CreateRecordingRenderingResources();
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry);
    Tick(registry, world, rendering);

    expect(rendering.drawnGlyphs).toHaveLength(GameWidth * GameWidth);
  });
});

describe("terrain the world can be asked about", () => {
  // The whole point of the query: an entity anywhere can ask what it is standing
  // on, and the answer has to be the ground that was actually drawn under it.
  it("reports the terrain the renderer drew under an entity", async () => {
    const { TerrainKindOfEntity } = await import("../../Utilities/TerrainUtilities.ts");
    const { EntityBuilder } = await import("../../Systems.Framework/EntityBuilder.ts");
    const { Position } = await import("../../Contracts/Components/Position.ts");
    const { TerrainBands } = await import("../../Configuration/DisplayConstants.ts");

    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();
    const rendering = LookingAt(registry, 0, 0);

    Tick(registry, world, rendering);

    const entity = new EntityBuilder(registry).AddPosition(new Position(0, 0)).GetEntity();
    const kind = TerrainKindOfEntity(registry, world, entity)!;

    // The glyph drawn at the viewport centre, which is where the entity stands.
    // Glyphs are placed at cell centres, hence the half-tile back off.
    const centreGlyph = rendering.drawnGlyphs.find((glyph) =>
      glyph.canvasX / TileSizePixels - 0.5 === HalfViewport && glyph.canvasY / TileSizePixels - 0.5 === HalfViewport);

    expect(centreGlyph?.model).toBe(TerrainBands[kind]!.glyph);
  });

  // The reason it samples noise rather than reading a chunk: only a 5x5 buffer
  // is resident, and entities routinely stand outside it.
  it("still answers after the entity's chunk has been unloaded", async () => {
    const { TerrainKindOfEntity, TerrainKindAtWorldTile } = await import("../../Utilities/TerrainUtilities.ts");
    const { EntityBuilder } = await import("../../Systems.Framework/EntityBuilder.ts");
    const { Position } = await import("../../Contracts/Components/Position.ts");

    const registry = BuildWorldRegistry();
    const world = CreateWorldStreamingResources();

    Tick(registry, world, LookingAt(registry, 0, 0));

    const entity = new EntityBuilder(registry).AddPosition(new Position(0, 0)).GetEntity();
    const beforePanning = TerrainKindOfEntity(registry, world, entity);

    // Far enough that the entity's chunk is neither loaded nor cached.
    Tick(registry, world, LookingAt(registry, 5000, 5000));

    expect(TerrainKindOfEntity(registry, world, entity)).toBe(beforePanning);
    expect(TerrainKindOfEntity(registry, world, entity)).toBe(TerrainKindAtWorldTile(world, 0, 0));
  });
});
