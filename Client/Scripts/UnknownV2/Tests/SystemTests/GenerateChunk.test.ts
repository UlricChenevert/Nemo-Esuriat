import { describe, it, expect } from "vitest";
import { GenerateChunk, BandNoiseToTerrain, ShadeNoiseToPaletteIndex } from "../../Systems.World/GenerateChunk.ts";
import { ChunkWidth, GradientGridWidth, NoiseScale, NoiseOctaves, NoisePersistence, NoiseLacunarity, NoiseGain, WorldSeed } from "../../Configuration/WorldConstants.ts";
import { TerrainBands, TerrainKind, TerrainKindOfPaletteIndex, TerrainPalette, TerrainShadeCount, TerrainThresholds } from "../../Configuration/DisplayConstants.ts";
import { PerlinNoise } from "../../Libraries/Noise/PerlinNoise.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import type { INoiseGenerator } from "../../Interfaces/INoiseGenerator.ts";

const BuildNoise = () => new PerlinNoise(new LinearCongruentialGenerator(WorldSeed), {
  GradientGridWidth, NoiseScale, Octaves: NoiseOctaves, Persistence: NoisePersistence, Lacunarity: NoiseLacunarity, Gain: NoiseGain,
});

/** A noise generator returning one fixed value, so banding can be asserted exactly. */
const FixedNoise = (value : number) : INoiseGenerator => ({ GetNoise: () => value });

/**
 * Enough to clear a threshold without landing on it.
 *
 * Sample points are derived from the thresholds rather than written as literals.
 * These tests used to hardcode 0.3/0.5/0.6, which meant retuning the thresholds
 * silently moved the values out of the bands they were named for.
 */
const Nudge = 0.0001;

/** A point safely inside a band, at the given fraction of the way up it. */
const Within = (kind : number, fraction : number) => {
  const band = TerrainBands[kind]!;

  return band.lowerBound + (band.upperBound - band.lowerBound) * fraction;
};

describe("banding", () => {
  it("high noise is mountain", () => expect(BandNoiseToTerrain(Within(TerrainKind.Mountain, 0.5))).toBe(TerrainKind.Mountain));
  it("mid-high noise is hill", () => expect(BandNoiseToTerrain(Within(TerrainKind.Hill, 0.5))).toBe(TerrainKind.Hill));
  it("mid noise is grass", () => expect(BandNoiseToTerrain(Within(TerrainKind.Grass, 0.5))).toBe(TerrainKind.Grass));
  it("low noise is water", () => expect(BandNoiseToTerrain(0.0)).toBe(TerrainKind.Water));

  // Pins the strictly-greater-than comparison inherited from the original game.
  it("exactly the mountain threshold is hill", () => expect(BandNoiseToTerrain(TerrainThresholds.Mountain)).toBe(TerrainKind.Hill));
  it("exactly the hill threshold is grass", () => expect(BandNoiseToTerrain(TerrainThresholds.Hill)).toBe(TerrainKind.Grass));
  it("exactly the grassland threshold is water", () => expect(BandNoiseToTerrain(TerrainThresholds.Grassland)).toBe(TerrainKind.Water));

  it("every band is a valid terrain kind", () =>
    expect(TerrainBands.every((_band, kind) => BandNoiseToTerrain(Within(kind, 0.5)) < TerrainBands.length)).toBe(true));

  // The bug this whole change exists for: the thresholds were tuned against a
  // noise field that never descended to them, so water was 0.01% of the world.
  // Every band has to be reachable from the field the game actually generates.
  it("every band is reachable from the real noise field", () => {
    const noise = BuildNoise();
    const kinds = new Set<number>();

    for (let x = 0; x < GradientGridWidth * NoiseScale; x += 7)
      for (let y = 0; y < GradientGridWidth * NoiseScale; y += 7) kinds.add(BandNoiseToTerrain(noise.GetNoise(x, y)));

    expect(kinds.size).toBe(TerrainBands.length);
  });
});

describe("shading", () => {
  // The point of the whole feature: height inside a band has to survive into the
  // palette index, or terrain is flat colour again.
  it("a lower noise value in a band is a lower shade", () =>
    expect(ShadeNoiseToPaletteIndex(Within(TerrainKind.Grass, 0.1))).toBeLessThan(ShadeNoiseToPaletteIndex(Within(TerrainKind.Grass, 0.9))));

  it("shading does not change the terrain kind", () =>
    expect([0.1, 0.5, 0.9].every((fraction) =>
      TerrainKindOfPaletteIndex(ShadeNoiseToPaletteIndex(Within(TerrainKind.Grass, fraction))) === TerrainKind.Grass)).toBe(true));

  it("the bottom of a band is its first shade", () =>
    expect(ShadeNoiseToPaletteIndex(TerrainThresholds.Grassland + Nudge) % TerrainShadeCount).toBe(0));

  it("the top of a band is its last shade", () =>
    expect(ShadeNoiseToPaletteIndex(TerrainThresholds.Hill - Nudge) % TerrainShadeCount).toBe(TerrainShadeCount - 1));

  // A value exactly on a bound must not round up into the next band's shades,
  // which would paint a mountain colour under a hill glyph.
  it("every band bound stays inside its own band", () => {
    for (const band of TerrainBands) {
      for (const noise of [band.lowerBound, band.upperBound, (band.lowerBound + band.upperBound) / 2]) {
        const index = ShadeNoiseToPaletteIndex(noise);
        // BandNoiseToTerrain is the authority on which band a bound belongs to,
        // so the shaded index has to agree with it rather than with the band the
        // bound was read from.
        const kind = BandNoiseToTerrain(noise);

        expect(TerrainKindOfPaletteIndex(index)).toBe(kind);
        expect(index).toBeGreaterThanOrEqual(kind * TerrainShadeCount);
        expect(index).toBeLessThan((kind + 1) * TerrainShadeCount);
      }
    }
  });

  it("every shade is a valid palette index", () => {
    const samples = [0, 1, ...Object.values(TerrainThresholds), ...TerrainBands.flatMap((_band, kind) => [Within(kind, 0.25), Within(kind, 0.75)])];

    expect(samples.every((value) => ShadeNoiseToPaletteIndex(value) < TerrainPalette.length)).toBe(true);
  });

  it("the palette has one entry per kind per shade", () =>
    expect(TerrainPalette.length).toBe(TerrainBands.length * TerrainShadeCount));

  /** The colour at each end of a band's shade range. */
  const BandEnds = (kind : number) => ({
    low: TerrainPalette[kind * TerrainShadeCount]!.color,
    high: TerrainPalette[kind * TerrainShadeCount + TerrainShadeCount - 1]!.color,
  });

  it("water deepens as it gets lower", () => {
    const { low, high } = BandEnds(TerrainKind.Water);

    expect(low.blue).toBeLessThan(high.blue);
  });

  it("mountains lighten toward the peaks", () => {
    const { low, high } = BandEnds(TerrainKind.Mountain);

    expect(high.red).toBeGreaterThan(low.red);
  });

  // Grass used to stay vivid green right up to the hill boundary, which made the
  // switch look abrupt. It should dry out on the way up instead.
  it("grass darkens toward the hill boundary", () => {
    const { low, high } = BandEnds(TerrainKind.Grass);

    expect(high.green).toBeLessThan(low.green);
  });

  it("grass browns toward the hill boundary", () => {
    const { low, high } = BandEnds(TerrainKind.Grass);

    // Brown is green giving up its lead over red, so the gap has to close.
    expect(high.green - high.red).toBeLessThan(low.green - low.red);
  });

  // The foot of a hill used to be a bright yellow tan, which read as a change of
  // lighting rather than a change of ground. It has to be brown, and brown means
  // red leading green — the tan had them level.
  it("hill starts brown rather than yellow", () => {
    const { low } = BandEnds(TerrainKind.Hill);

    expect(low.red - low.green).toBeGreaterThan(15);
  });

  // "Noticeable jump toward brown, but still similar to the grass": the hue has
  // to move decisively while the brightness stays in the same neighbourhood, or
  // the boundary goes back to looking like a lighting seam.
  it("the grass-to-hill step is a hue change, not a brightness change", () => {
    const grass = BandEnds(TerrainKind.Grass).high;
    const hill = BandEnds(TerrainKind.Hill).low;

    const Luminance = (colour : typeof grass) => 0.299 * colour.red + 0.587 * colour.green + 0.114 * colour.blue;

    // Grass ends olive, with red and green near level; hill has to open clearly
    // browner than that.
    expect(hill.red - hill.green).toBeGreaterThan(grass.red - grass.green + 20);
    expect(Math.abs(Luminance(hill) - Luminance(grass))).toBeLessThan(25);
  });

  // Likewise hill used to stay yellow-tan against the grey of the mountains.
  it("hill greys toward the mountain boundary", () => {
    const { low, high } = BandEnds(TerrainKind.Hill);

    // Grey is all three channels converging; the tan's missing blue is what reads
    // as yellow, so blue closing on green is the whole point.
    expect(high.green - high.blue).toBeLessThan(low.green - low.blue);
    expect(Math.abs(high.green - high.blue)).toBeLessThan(8);
  });

  it("a band's shades all share its glyph", () => {
    const shades = TerrainPalette.slice(TerrainKind.Water * TerrainShadeCount, (TerrainKind.Water + 1) * TerrainShadeCount);

    expect(shades.every((shade) => shade.model === TerrainPalette[TerrainKind.Water * TerrainShadeCount]!.model)).toBe(true);
  });
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
    const chunk = GenerateChunk(0, 0, FixedNoise(Within(TerrainKind.Mountain, 0.5)));
    expect(Array.from(chunk.paletteIndices).every((index) => TerrainKindOfPaletteIndex(index) === TerrainKind.Mountain)).toBe(true);
  });

  it("all-water noise gives an all-water chunk", () => {
    const chunk = GenerateChunk(0, 0, FixedNoise(Within(TerrainKind.Water, 0.5)));
    expect(Array.from(chunk.paletteIndices).every((index) => TerrainKindOfPaletteIndex(index) === TerrainKind.Water)).toBe(true);
  });

  // One noise value is one height, so it must also be one shade.
  it("fixed noise gives a single shade", () =>
    expect(new Set(GenerateChunk(0, 0, FixedNoise(Within(TerrainKind.Mountain, 0.5))).paletteIndices).size).toBe(1));
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
      expect(neighbour.paletteIndices[localY * ChunkWidth]).toBe(ShadeNoiseToPaletteIndex(noise.GetNoise(ChunkWidth, localY)));
    }
  });

  it("the bottom neighbour's first row continues the field", () => {
    const neighbour = GenerateChunk(0, 1, noise);

    for (let localX = 0; localX < ChunkWidth; localX++) {
      expect(neighbour.paletteIndices[localX]).toBe(ShadeNoiseToPaletteIndex(noise.GetNoise(localX, ChunkWidth)));
    }
  });

  it("a negative-coordinate neighbour continues the field", () => {
    const neighbour = GenerateChunk(-1, 0, noise);

    for (let localY = 0; localY < ChunkWidth; localY++) {
      expect(neighbour.paletteIndices[localY * ChunkWidth]).toBe(ShadeNoiseToPaletteIndex(noise.GetNoise(-ChunkWidth, localY)));
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
