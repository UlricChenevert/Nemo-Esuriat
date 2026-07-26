import { describe, it, expect } from "vitest";
import { GenerateChunk, BandNoiseToTerrain } from "../../Systems.World/GenerateChunk.ts";
import { ChunkWidth, GradientGridWidth, NoiseScale, NoiseOctaves, NoisePersistence, NoiseLacunarity, WorldSeed } from "../../Configuration/WorldConstants.ts";
import { TerrainKind, TerrainPalette } from "../../Configuration/DisplayConstants.ts";
import { PerlinNoise } from "../../Libraries/Noise/PerlinNoise.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import type { INoiseGenerator } from "../../Interfaces/INoiseGenerator.ts";

const BuildNoise = () => new PerlinNoise(new LinearCongruentialGenerator(WorldSeed), {
  GradientGridWidth, NoiseScale, Octaves: NoiseOctaves, Persistence: NoisePersistence, Lacunarity: NoiseLacunarity,
});

/** A noise generator returning one fixed value, so banding can be asserted exactly. */
const FixedNoise = (value : number) : INoiseGenerator => ({ GetNoise: () => value });

describe("banding", () => {
  it("high noise is mountain", () => expect(BandNoiseToTerrain(0.7)).toBe(TerrainKind.Mountain));
  it("mid-high noise is hill", () => expect(BandNoiseToTerrain(0.55)).toBe(TerrainKind.Hill));
  it("mid noise is grass", () => expect(BandNoiseToTerrain(0.35)).toBe(TerrainKind.Grass));
  it("low noise is water", () => expect(BandNoiseToTerrain(0.0)).toBe(TerrainKind.Water));

  // Pins the strictly-greater-than comparison inherited from the original game.
  it("exactly the mountain threshold is hill", () => expect(BandNoiseToTerrain(0.6)).toBe(TerrainKind.Hill));
  it("exactly the hill threshold is grass", () => expect(BandNoiseToTerrain(0.5)).toBe(TerrainKind.Grass));
  it("exactly the grassland threshold is water", () => expect(BandNoiseToTerrain(0.3)).toBe(TerrainKind.Water));

  it("every band is a valid palette index", () =>
    expect([0, 0.35, 0.55, 0.7].every((value) => BandNoiseToTerrain(value) < TerrainPalette.length)).toBe(true));
});

describe("chunk shape", () => {
  const chunk = GenerateChunk(0, 0, BuildNoise());

  it("is ChunkWidth wide", () => expect(chunk.width).toBe(ChunkWidth));
  it("is ChunkWidth tall", () => expect(chunk.height).toBe(ChunkWidth));
  it("has one index per tile", () => expect(chunk.paletteIndices.length).toBe(ChunkWidth * ChunkWidth));
  it("uses the shared terrain palette", () => expect(chunk.palette).toBe(TerrainPalette));
  it("every index is within the palette", () =>
    expect(Array.from(chunk.paletteIndices).every((index) => index < TerrainPalette.length)).toBe(true));
});

describe("fixed noise fills uniformly", () => {
  it("all-mountain noise gives an all-mountain chunk", () => {
    const chunk = GenerateChunk(0, 0, FixedNoise(0.7));
    expect(Array.from(chunk.paletteIndices).every((index) => index === TerrainKind.Mountain)).toBe(true);
  });

  it("all-water noise gives an all-water chunk", () => {
    const chunk = GenerateChunk(0, 0, FixedNoise(0.1));
    expect(Array.from(chunk.paletteIndices).every((index) => index === TerrainKind.Water)).toBe(true);
  });
});

describe("determinism", () => {
  it("same coordinates and seed give the same tiles", () =>
    expect(GenerateChunk(3, -2, BuildNoise()).paletteIndices).toEqual(GenerateChunk(3, -2, BuildNoise()).paletteIndices));

  it("different chunks differ", () =>
    expect(GenerateChunk(0, 0, BuildNoise()).paletteIndices).not.toEqual(GenerateChunk(5, 5, BuildNoise()).paletteIndices));
});

describe("negative chunk coordinates", () => {
  // The original implementation crashed here: negative world coordinates
  // produced negative gradient indices.
  const chunk = GenerateChunk(-3, -4, BuildNoise());

  it("produces a full chunk", () => expect(chunk.paletteIndices.length).toBe(ChunkWidth * ChunkWidth));
  it("contains no out-of-palette index", () =>
    expect(Array.from(chunk.paletteIndices).every((index) => index < TerrainPalette.length)).toBe(true));
  it("does not throw", () => expect(() => GenerateChunk(-100, -100, BuildNoise())).not.toThrow());
});

describe("seam continuity", () => {
  // Chunks must tile without a visible join, which means chunk (1,0)'s first
  // column has to be exactly what the noise field says at world x = ChunkWidth.
  const noise = BuildNoise();

  it("the right neighbour's first column continues the field", () => {
    const neighbour = GenerateChunk(1, 0, noise);

    for (let localY = 0; localY < ChunkWidth; localY++) {
      expect(neighbour.paletteIndices[localY * ChunkWidth]).toBe(BandNoiseToTerrain(noise.GetNoise(ChunkWidth, localY)));
    }
  });

  it("the bottom neighbour's first row continues the field", () => {
    const neighbour = GenerateChunk(0, 1, noise);

    for (let localX = 0; localX < ChunkWidth; localX++) {
      expect(neighbour.paletteIndices[localX]).toBe(BandNoiseToTerrain(noise.GetNoise(localX, ChunkWidth)));
    }
  });

  it("a negative-coordinate neighbour continues the field", () => {
    const neighbour = GenerateChunk(-1, 0, noise);

    for (let localY = 0; localY < ChunkWidth; localY++) {
      expect(neighbour.paletteIndices[localY * ChunkWidth]).toBe(BandNoiseToTerrain(noise.GetNoise(-ChunkWidth, localY)));
    }
  });
});

describe("terrain variety", () => {
  it("the world contains more than one terrain kind", () => {
    // Sampling several chunks, because any single one could legitimately be all
    // ocean; a world of one biome would mean the thresholds and the noise range
    // disagree.
    const kinds = new Set<number>();

    for (let chunkX = -2; chunkX <= 2; chunkX++) Array.from(GenerateChunk(chunkX, 0, BuildNoise()).paletteIndices).forEach((index) => kinds.add(index));

    expect(kinds.size).toBeGreaterThan(1);
  });
});
