/****************************************/
//
//     PerlinNoise
//
/****************************************/
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
export class PerlinNoise {
    /** Interleaved [x0, y0, x1, y1, ...], row-major over the gradient grid. */
    _gradientComponents;
    _gradientGridWidth;
    _noiseScale;
    _octaves;
    _persistence;
    _lacunarity;
    constructor(randomNumberGenerator, configuration) {
        this._gradientGridWidth = configuration.GradientGridWidth;
        this._noiseScale = configuration.NoiseScale;
        this._octaves = configuration.Octaves;
        this._persistence = configuration.Persistence;
        this._lacunarity = configuration.Lacunarity;
        if (this._gradientGridWidth < 1)
            throw new RangeError("GradientGridWidth must be at least 1.");
        if (this._noiseScale <= 0)
            throw new RangeError("NoiseScale must be greater than 0.");
        if (this._octaves < 1)
            throw new RangeError("Octaves must be at least 1.");
        // Built eagerly, so identical configuration and seed always produce an
        // identical grid regardless of which coordinates get sampled first.
        this._gradientComponents = new Float32Array(this._gradientGridWidth * this._gradientGridWidth * 2);
        for (let component = 0; component < this._gradientComponents.length; component++) {
            // Random() is [0, 1); this maps it onto [-1, 1).
            this._gradientComponents[component] = randomNumberGenerator.Random() * 2 - 1;
        }
    }
    GetNoise(worldX, worldY) {
        let amplitude = 1;
        let frequency = 1;
        let total = 0;
        let amplitudeSum = 0;
        for (let octave = 0; octave < this._octaves; octave++) {
            total += amplitude * this._SampleGradientNoise(worldX * frequency / this._noiseScale, worldY * frequency / this._noiseScale);
            amplitudeSum += amplitude;
            amplitude *= this._persistence;
            frequency *= this._lacunarity;
        }
        // Dividing by the summed amplitude before the remap keeps the result in
        // [0, 1] for any octave count. Without it, more octaves push the range
        // wider and every terrain threshold shifts meaning.
        const normalized = (total / amplitudeSum + 1) / 2;
        // Perlin's theoretical bound is slightly wider than the range it reaches
        // in practice, so clamp rather than let a rare sample escape [0, 1].
        return Math.min(1, Math.max(0, normalized));
    }
    /**
     * One octave of raw gradient noise at a point in gradient-grid space.
     * Returns roughly [-1, 1]; the remap onto [0, 1] belongs in GetNoise, after
     * the octaves are summed, not here.
     */
    _SampleGradientNoise(gridX, gridY) {
        const cellX = Math.floor(gridX);
        const cellY = Math.floor(gridY);
        // Offset of the sample within its gradient cell, in [0, 1).
        const localX = gridX - cellX;
        const localY = gridY - cellY;
        const topLeft = this._DotGradientAtCorner(cellX, cellY, localX, localY);
        const topRight = this._DotGradientAtCorner(cellX + 1, cellY, localX - 1, localY);
        const bottomLeft = this._DotGradientAtCorner(cellX, cellY + 1, localX, localY - 1);
        const bottomRight = this._DotGradientAtCorner(cellX + 1, cellY + 1, localX - 1, localY - 1);
        const smoothX = this._SmoothStep(localX);
        const smoothY = this._SmoothStep(localY);
        const topRowInterpolation = this._Interpolate(topLeft, topRight, smoothX);
        const bottomRowInterpolation = this._Interpolate(bottomLeft, bottomRight, smoothX);
        return this._Interpolate(topRowInterpolation, bottomRowInterpolation, smoothY);
    }
    /**
     * Influence of the gradient at one cell corner on the sample: the dot
     * product of that gradient with the offset from the corner to the sample.
     *
     * Wrapping, lookup, and the dot product are folded together deliberately.
     * It is called four times per sample, and keeping it in one place means the
     * whole file needs a single fallback for noUncheckedIndexedAccess instead of
     * four non-null assertions per call site.
     */
    _DotGradientAtCorner(cellX, cellY, deltaX, deltaY) {
        const offset = (this._WrapToGrid(cellY) * this._gradientGridWidth + this._WrapToGrid(cellX)) * 2;
        return (this._gradientComponents[offset] ?? 0) * deltaX + (this._gradientComponents[offset + 1] ?? 0) * deltaY;
    }
    /**
     * Wraps a gradient cell index into the grid, toroidally.
     *
     * The double modulo is what makes negative world coordinates work: a plain
     * `%` in JavaScript keeps the sign of its left operand, so it maps -1 to -1
     * rather than to the last row.
     */
    _WrapToGrid(value) {
        const width = this._gradientGridWidth;
        return ((value % width) + width) % width;
    }
    _Interpolate(startValue, endValue, weight) {
        return startValue + weight * (endValue - startValue);
    }
    /** Ken Perlin's quintic ease curve, whose first and second derivatives vanish at 0 and 1. */
    _SmoothStep(value) {
        return 6 * value ** 5 - 15 * value ** 4 + 10 * value ** 3;
    }
}
//# sourceMappingURL=PerlinNoise.js.map