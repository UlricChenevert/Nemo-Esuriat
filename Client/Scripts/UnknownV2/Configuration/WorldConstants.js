import { GameWidth } from "./GameConstants.js";
/** Tiles per side of one terrain chunk. */
export const ChunkWidth = 50;
/** Chunks per side of the loaded buffer around the viewport. */
export const ChunkGridWidth = 5;
/**
 * The loaded buffer must cover the viewport no matter where in the centre chunk
 * the camera looks. The centre can sit at either edge of that chunk, so the
 * worst case needs a full viewport plus a full chunk of span.
 *
 * The buffer is deliberately wider than that minimum: at 3 the margin was
 * exactly zero, so a chunk was generated in the frame it scrolled on screen and
 * a fast pan showed the hitch. 5 * 50 = 250 against a 150-tile requirement
 * leaves a chunk and a half of terrain ready ahead of the view in every
 * direction.
 *
 * The floor is asserted at module load rather than left as a comment because
 * raising GameWidth or shrinking ChunkWidth without also raising ChunkGridWidth
 * would leave an unrendered strip at the edge of the screen.
 */
if (ChunkGridWidth * ChunkWidth < GameWidth + ChunkWidth) {
    throw new Error(`Chunk buffer (${ChunkGridWidth * ChunkWidth} tiles) cannot cover the viewport ` +
        `(${GameWidth} tiles) from any position in the centre chunk. Raise ChunkGridWidth.`);
}
/** Seed for the world's noise field. The same seed always yields the same world. */
export const WorldSeed = 1000;
/**
 * Gradient cells per axis in the noise field. With NoiseScale, this sets how far
 * the player walks before terrain repeats: GradientGridWidth * NoiseScale tiles.
 * 32 * 62.5 = 2000 tiles, matching the original game's world size.
 */
export const GradientGridWidth = 32;
/** World tiles spanned by one gradient cell. Larger means broader, smoother landmasses. */
export const NoiseScale = 62.5;
/** Detail passes per sample. More octaves add finer features to the same landmasses. */
export const NoiseOctaves = 4;
/** Amplitude falloff per octave. Below 1 so fine detail stays subordinate to the base shape. */
export const NoisePersistence = 0.5;
/** Frequency growth per octave. */
export const NoiseLacunarity = 2;
/**
 * Contrast stretch applied to the noise field before it is remapped onto [0, 1].
 *
 * Averaging four octaves leaves the raw field bunched around the middle — it
 * spanned only 0.28 to 0.70, so the water band below 0.36 was unreachable and
 * the world generated as grass and hills alone. 2 restores a field that spans
 * roughly 0.02 to 0.97, which is as wide as it can go before GetNoise's clamp
 * starts flattening peaks and troughs into plateaus.
 *
 * This is tied to NoiseOctaves: fewer octaves need less of a stretch, more need
 * a little more. Changing either without rechecking the terrain proportions will
 * skew the mix of water, grass, hill, and mountain.
 */
export const NoiseGain = 2;
/**
 * How many recently-unloaded chunks to keep in memory.
 *
 * This replaces the original game's border hysteresis. A player pacing across a
 * chunk boundary would otherwise regenerate three chunks per step; with a cache,
 * stepping back into a chunk just left is a map lookup. It also covers walking
 * away and returning, which hysteresis never did.
 */
export const RecentChunkCacheSize = 16;
//# sourceMappingURL=WorldConstants.js.map