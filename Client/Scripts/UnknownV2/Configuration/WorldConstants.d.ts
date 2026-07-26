/** Tiles per side of one terrain chunk. */
export declare const ChunkWidth = 50;
/** Chunks per side of the loaded buffer around the player. */
export declare const ChunkGridWidth = 3;
/** Seed for the world's noise field. The same seed always yields the same world. */
export declare const WorldSeed = 1000;
/**
 * Gradient cells per axis in the noise field. With NoiseScale, this sets how far
 * the player walks before terrain repeats: GradientGridWidth * NoiseScale tiles.
 * 32 * 62.5 = 2000 tiles, matching the original game's world size.
 */
export declare const GradientGridWidth = 32;
/** World tiles spanned by one gradient cell. Larger means broader, smoother landmasses. */
export declare const NoiseScale = 62.5;
/** Detail passes per sample. More octaves add finer features to the same landmasses. */
export declare const NoiseOctaves = 4;
/** Amplitude falloff per octave. Below 1 so fine detail stays subordinate to the base shape. */
export declare const NoisePersistence = 0.5;
/** Frequency growth per octave. */
export declare const NoiseLacunarity = 2;
/**
 * How many recently-unloaded chunks to keep in memory.
 *
 * This replaces the original game's border hysteresis. A player pacing across a
 * chunk boundary would otherwise regenerate three chunks per step; with a cache,
 * stepping back into a chunk just left is a map lookup. It also covers walking
 * away and returning, which hysteresis never did.
 */
export declare const RecentChunkCacheSize = 16;
//# sourceMappingURL=WorldConstants.d.ts.map