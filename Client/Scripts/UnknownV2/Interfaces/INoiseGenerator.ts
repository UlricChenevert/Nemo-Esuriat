/**
 * Samples a continuous, deterministic noise field over infinite world space.
 *
 * Chunk generation depends on this interface rather than on PerlinNoise directly
 * so that tests can substitute a generator returning fixed values and assert the
 * terrain banding exactly, without reasoning about what the noise happens to
 * produce at a given coordinate.
 */
export interface INoiseGenerator {
    /** Noise at a world tile coordinate, in [0, 1]. Any finite x/y is valid, including negatives. */
    GetNoise(worldX : number, worldY : number) : number
}
