import { TerrainBands, TerrainThresholds } from "../../Configuration/DisplayConstants.ts";
import { WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import type { INoiseGenerator } from "../../Interfaces/INoiseGenerator.ts";
import { InMemoryKeyValueStore } from "../../Libraries/Storage/InMemoryKeyValueStore.ts";

/**
 * Noise fields and worlds for tests that need terrain to be a known quantity
 * rather than the thing under test.
 *
 * The alternative -- a real PerlinNoise -- makes every assertion about a direction
 * measure two things at once: what the system decided, and what the ground
 * happened to look like where the test put the herd.
 */

/** A noise field with the same value everywhere, so the whole world is one band. */
export function FlatNoise (value : number) : INoiseGenerator {
    return { GetNoise : () => value }
}

/** A noise field computed from the world coordinate, for hand-drawn terrain. */
export function ShapedNoise (Shape : (worldX : number, worldY : number) => number) : INoiseGenerator {
    return { GetNoise : (worldX : number, worldY : number) => Shape(worldX, worldY) }
}

/**
 * A noise value a given fraction of the way through a terrain band.
 *
 * Derived from the thresholds rather than written as a literal so that retuning
 * where terrain changes cannot silently move a test's sample into the wrong band
 * while leaving it passing. This is the convention TerrainUtilities.test.ts
 * already follows.
 */
export function WithinBand (kind : number, fraction : number) : number {
    const band = TerrainBands[kind]!

    return band.lowerBound + (band.upperBound - band.lowerBound) * fraction
}

/** Water shallow enough to stand in: between the ocean floor and the grass line. */
export const ShallowWaterNoise = (TerrainThresholds.Ocean + TerrainThresholds.Grassland) / 2

/** Water too deep to enter. */
export const DeepWaterNoise = TerrainThresholds.Ocean / 2

/** Ordinary grazing ground, mid-band. */
export const GrassNoise = WithinBand(1, 0.5)

/** Impassably steep ground, mid-band. */
export const MountainNoise = WithinBand(3, 0.5)

export function BuildTestWorld (noiseGenerator : INoiseGenerator) : WorldStreamingResources {
    return new WorldStreamingResources(noiseGenerator, new InMemoryKeyValueStore(), 1000)
}

/** Featureless grazing ground in every direction. */
export function BuildGrassWorld () : WorldStreamingResources {
    return BuildTestWorld(FlatNoise(GrassNoise))
}
