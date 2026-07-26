/****************************************/
/****************************************/
import type { INoiseGenerator } from "../../Interfaces/INoiseGenerator.ts";
import type { IRandomNumberGenerator } from "../../Interfaces/IRandomNumberGenerator.ts";
export interface PerlinConfiguration {
    /** Gradient cells per axis. Also the tiling period, measured in gradient cells. */
    GradientGridWidth: number;
    /** World tiles spanned by one gradient cell. Larger means smoother, broader features. */
    NoiseScale: number;
    /** How many times to sample at successively finer detail. 1 gives plain Perlin. */
    Octaves: number;
    /** Amplitude multiplier per octave. Below 1 so fine detail contributes less. */
    Persistence: number;
    /** Frequency multiplier per octave. Above 1 so each octave is finer than the last. */
    Lacunarity: number;
}
/**
 * Deterministic 2D Perlin noise over infinite world space.
 *
 * The gradient grid wraps toroidally, so the field is defined for every finite
 * coordinate — including negative ones — and repeats every
 * GradientGridWidth * NoiseScale world tiles. That period is the price of an
 * infinite world backed by a finite gradient table; pick GradientGridWidth large
 * enough that the player never walks far enough to notice.
 *
 * Gradients live in one flat Float32Array with x and y interleaved rather than
 * in nested arrays of vector objects. Sampling touches four gradients, and a
 * chunk is thousands of samples, so the object form allocated tens of thousands
 * of short-lived vectors per chunk for arithmetic that needs none.
 */
export declare class PerlinNoise implements INoiseGenerator {
    /** Interleaved [x0, y0, x1, y1, ...], row-major over the gradient grid. */
    private readonly _gradientComponents;
    private readonly _gradientGridWidth;
    private readonly _noiseScale;
    private readonly _octaves;
    private readonly _persistence;
    private readonly _lacunarity;
    constructor(randomNumberGenerator: IRandomNumberGenerator, configuration: PerlinConfiguration);
    GetNoise(worldX: number, worldY: number): number;
    /**
     * One octave of raw gradient noise at a point in gradient-grid space.
     * Returns roughly [-1, 1]; the remap onto [0, 1] belongs in GetNoise, after
     * the octaves are summed, not here.
     */
    private _SampleGradientNoise;
    /**
     * Influence of the gradient at one cell corner on the sample: the dot
     * product of that gradient with the offset from the corner to the sample.
     *
     * Wrapping, lookup, and the dot product are folded together deliberately.
     * It is called four times per sample, and keeping it in one place means the
     * whole file needs a single fallback for noUncheckedIndexedAccess instead of
     * four non-null assertions per call site.
     */
    private _DotGradientAtCorner;
    /**
     * Wraps a gradient cell index into the grid, toroidally.
     *
     * The double modulo is what makes negative world coordinates work: a plain
     * `%` in JavaScript keeps the sign of its left operand, so it maps -1 to -1
     * rather than to the last row.
     */
    private _WrapToGrid;
    private _Interpolate;
    /** Ken Perlin's quintic ease curve, whose first and second derivatives vanish at 0 and 1. */
    private _SmoothStep;
}
//# sourceMappingURL=PerlinNoise.d.ts.map