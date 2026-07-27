import { describe, it, expect } from "vitest";
import { StreamChunks } from "../../Systems.World/StreamChunks.ts";
import { ChunkWidth, ChunkGridWidth, RecentChunkCacheSize } from "../../Configuration/WorldConstants.ts";
import { BackgroundLayer } from "../../Configuration/DisplayConstants.ts";
import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Camera, WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { InMemoryKeyValueStore } from "../../Libraries/Storage/InMemoryKeyValueStore.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { BuildTestRegistry, AddPlayerAt } from "../TestHelpers/BuildTestRegistry.ts";

const ExpectedChunkCount = ChunkGridWidth * ChunkGridWidth;

/** Noise that counts how many samples were taken, to detect regeneration. */
function CountingNoise() {
  let sampleCount = 0;
  return {
    noise: { GetNoise: (x : number, y : number) => { sampleCount++; return ((x * 0.01 + y * 0.017) % 1 + 1) % 1; } },
    GetSampleCount: () => sampleCount,
  };
}

function BuildWorld() {
  const { noise, GetSampleCount } = CountingNoise();
  return { world: new WorldStreamingResources(noise, new InMemoryKeyValueStore(), 1000), GetSampleCount };
}

/** The set of loaded chunk coordinates, as "x,y" strings. */
function LoadedChunkKeys(registry : GlobalRegistry) : Set<string> {
  const keys = new Set<string>();
  registry.ForEachEntityWith([ChunkCoordinate], (_entity, chunk) => { keys.add(`${chunk.chunkX},${chunk.chunkY}`); });
  return keys;
}

function ExpectedKeysAround(centerX : number, centerY : number) : Set<string> {
  const radius = Math.floor(ChunkGridWidth / 2);
  const keys = new Set<string>();

  for (let y = centerY - radius; y <= centerY + radius; y++) for (let x = centerX - radius; x <= centerX + radius; x++) keys.add(`${x},${y}`);

  return keys;
}

const HalfViewport = GameWidth / 2;

/** A camera whose viewport centre sits on the given world tile. */
function CameraOn(x : number, y : number) {
  return new Camera(x - HalfViewport, y - HalfViewport);
}

/** Points the camera's centre at a world tile, as panning there would. */
function MoveCameraTo(camera : Camera, x : number, y : number) {
  camera.worldOriginX = x - HalfViewport;
  camera.worldOriginY = y - HalfViewport;
}

describe("initial load", () => {
  it("creates a full buffer of chunks", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry).size).toBe(ExpectedChunkCount);
  });

  it("centres the buffer on the camera's chunk", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(0, 0));
  });

  it("gives each chunk its world position, layer, and terrain", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);

    let checked = 0;
    registry.ForEachEntityWith([ChunkCoordinate, Position, Layer, MultiTileRepresentation], (_entity, chunk, position, layer, terrain) => {
      expect([position.x, position.y]).toEqual([chunk.chunkX * ChunkWidth, chunk.chunkY * ChunkWidth]);
      expect(layer.layerIndex).toBe(BackgroundLayer);
      expect(terrain.width).toBe(ChunkWidth);
      checked++;
    });

    expect(checked).toBe(ExpectedChunkCount);
  });

  it("centres on a distant starting chunk", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(10 * ChunkWidth + 5, 7 * ChunkWidth + 5);

    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(10, 7));
  });
});

describe("negative coordinates", () => {
  it("puts world x = -1 in chunk -1, not chunk 0", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(-1, -1);

    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(-1, -1));
  });

  it("loads a buffer deep in negative space", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(-10 * ChunkWidth, -10 * ChunkWidth);

    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(-10, -10));
  });
});

describe("movement", () => {
  it("shifts the buffer one column when the camera crosses in x", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, ChunkWidth, 0);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(1, 0));
  });

  it("shifts the buffer one row when the camera crosses in y", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, 0, ChunkWidth);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(0, 1));
  });

  // The case the original implementation got wrong: its two shift branches each
  // read from the unshifted buffer, so one of the two axes was lost.
  it("shifts both axes on a diagonal pan", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, ChunkWidth, ChunkWidth);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(1, 1));
  });

  it("keeps the buffer size constant while moving", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    for (let step = 1; step <= 5; step++) { MoveCameraTo(camera, step * ChunkWidth, step * ChunkWidth); StreamChunks(registry, world, camera); }

    expect(LoadedChunkKeys(registry).size).toBe(ExpectedChunkCount);
  });

  it("replaces the whole buffer on a teleport", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, 1000 * ChunkWidth, 1000 * ChunkWidth);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(1000, 1000));
  });

  it("crossing into negative space shifts correctly", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, -1, -1);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(-1, -1));
  });
});

describe("staying within a chunk", () => {
  it("generates nothing further", () => {
    const registry = BuildTestRegistry();
    const { world, GetSampleCount } = BuildWorld();
    const camera = CameraOn(5, 5);

    StreamChunks(registry, world, camera);
    const afterInitialLoad = GetSampleCount();

    MoveCameraTo(camera, ChunkWidth - 1, ChunkWidth - 1);
    StreamChunks(registry, world, camera);

    expect(GetSampleCount()).toBe(afterInitialLoad);
  });

  it("leaves the chunk entities untouched", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(5, 5);

    StreamChunks(registry, world, camera);
    const before = LoadedChunkKeys(registry);

    MoveCameraTo(camera, 10, 10);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(before);
  });
});

describe("recent chunk cache", () => {
  it("reuses a chunk the camera pans back into", () => {
    const registry = BuildTestRegistry();
    const { world, GetSampleCount } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, ChunkWidth, 0);
    StreamChunks(registry, world, camera);

    const afterStepOut = GetSampleCount();

    MoveCameraTo(camera, 0, 0);
    StreamChunks(registry, world, camera);

    // Every chunk needed on the way back was just evicted, so all of them come
    // from the cache and no new noise is sampled.
    expect(GetSampleCount()).toBe(afterStepOut);
  });

  it("stays bounded", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    for (let step = 0; step < 20; step++) { MoveCameraTo(camera, step * ChunkWidth, 0); StreamChunks(registry, world, camera); }

    expect(world.recentChunkCache.size).toBeLessThanOrEqual(RecentChunkCacheSize);
  });

  it("does not resurrect a cached chunk as a live entity", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, 5 * ChunkWidth, 0);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry).size).toBe(ExpectedChunkCount);
  });
});

// Streaming used to key off the player. It keys off the camera now, which is
// free to pan away from them, so these pin down that the player has no say in
// what terrain exists.
describe("independence from the player", () => {
  it("loads a buffer with no player in the world at all", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();

    StreamChunks(registry, world, CameraOn(0, 0));

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(0, 0));
  });

  it("follows the camera away from a stationary player", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);
    AddPlayerAt(registry, 0, 0);

    StreamChunks(registry, world, camera);
    MoveCameraTo(camera, 10 * ChunkWidth, 0);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry)).toEqual(ExpectedKeysAround(10, 0));
  });

  it("keeps the buffer when the player is destroyed", () => {
    const registry = BuildTestRegistry();
    const { world } = BuildWorld();
    const camera = CameraOn(0, 0);
    const player = AddPlayerAt(registry, 0, 0);

    StreamChunks(registry, world, camera);
    registry.DestroyEntity(player);
    StreamChunks(registry, world, camera);

    expect(LoadedChunkKeys(registry).size).toBe(ExpectedChunkCount);
  });
});
