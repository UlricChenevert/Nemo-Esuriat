import { GameWidth } from "./GameConstants.ts";

/** Tiles per side of one terrain chunk. */
export const ChunkWidth = 50

/** Chunks per side of the loaded buffer around the player. */
export const ChunkGridWidth = 3

/**
 * The loaded buffer must cover the viewport no matter where in the centre chunk
 * the player stands. The player can sit at either edge of the centre chunk, so
 * the worst case needs a full viewport plus a full chunk of span.
 *
 * At the current values this holds with exactly zero margin: 3 * 50 = 150 and
 * 100 + 50 = 150. Raising GameWidth or shrinking ChunkWidth without also raising
 * ChunkGridWidth would leave an unrendered strip at the edge of the screen,
 * which is why this is asserted at module load rather than left as a comment.
 */
if (ChunkGridWidth * ChunkWidth < GameWidth + ChunkWidth) {
    throw new Error(
        `Chunk buffer (${ChunkGridWidth * ChunkWidth} tiles) cannot cover the viewport ` +
        `(${GameWidth} tiles) from any position in the centre chunk. Raise ChunkGridWidth.`)
}

/** Seed for the world's noise field. The same seed always yields the same world. */
export const WorldSeed = 1000

/**
 * Gradient cells per axis in the noise field. With NoiseScale, this sets how far
 * the player walks before terrain repeats: GradientGridWidth * NoiseScale tiles.
 * 32 * 62.5 = 2000 tiles, matching the original game's world size.
 */
export const GradientGridWidth = 32

/** World tiles spanned by one gradient cell. Larger means broader, smoother landmasses. */
export const NoiseScale = 62.5

/** Detail passes per sample. More octaves add finer features to the same landmasses. */
export const NoiseOctaves = 4

/** Amplitude falloff per octave. Below 1 so fine detail stays subordinate to the base shape. */
export const NoisePersistence = 0.5

/** Frequency growth per octave. */
export const NoiseLacunarity = 2

/**
 * How many recently-unloaded chunks to keep in memory.
 *
 * This replaces the original game's border hysteresis. A player pacing across a
 * chunk boundary would otherwise regenerate three chunks per step; with a cache,
 * stepping back into a chunk just left is a map lookup. It also covers walking
 * away and returning, which hysteresis never did.
 */
export const RecentChunkCacheSize = 16
