import { describe, it, expect } from "vitest";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import { PerlinNoise, type PerlinConfiguration } from "../../Libraries/Noise/PerlinNoise.ts";
import { TerrainThresholds } from "../../Configuration/DisplayConstants.ts";

const BaseConfiguration : PerlinConfiguration = {
  GradientGridWidth: 32,
  NoiseScale: 62.5,
  Octaves: 4,
  Persistence: 0.5,
  Lacunarity: 2,
  Gain: 2,
};

const Build = (seed = 1000, overrides : Partial<PerlinConfiguration> = {}) =>
  new PerlinNoise(new LinearCongruentialGenerator(seed), { ...BaseConfiguration, ...overrides });

describe("configuration validation", () => {
  it("rejects a gradient grid narrower than 1", () => expect(() => Build(1000, { GradientGridWidth: 0 })).toThrow(RangeError));
  it("rejects a non-positive noise scale", () => expect(() => Build(1000, { NoiseScale: 0 })).toThrow(RangeError));
  it("rejects fewer than 1 octave", () => expect(() => Build(1000, { Octaves: 0 })).toThrow(RangeError));
});

describe("determinism", () => {
  it("same seed and config give the same sample", () => expect(Build().GetNoise(12.5, -3.25)).toBe(Build().GetNoise(12.5, -3.25)));
  it("different seeds give different samples", () => expect(Build(1).GetNoise(12.5, 7.5)).not.toBe(Build(2).GetNoise(12.5, 7.5)));

  it("sample order does not affect results", () => {
    // The gradient grid is built eagerly, so sampling elsewhere first must not
    // shift the field. A lazily-filled grid would fail this.
    const eager = Build();
    const warmed = Build();

    warmed.GetNoise(-900, 400);

    expect(warmed.GetNoise(12.5, -3.25)).toBe(eager.GetNoise(12.5, -3.25));
  });
});

describe("range and negative coordinates", () => {
  // The direct regression test for the legacy crash: negative coordinates used
  // to produce negative array indices and read undefined gradients.
  const samples : number[] = [];
  const noise = Build();

  for (let step = 0; step < 1000; step++) {
    const coordinate = -1500 + step * 3;
    samples.push(noise.GetNoise(coordinate, coordinate * 0.5 - 200));
  }

  it("no sample is NaN", () => expect(samples.every(Number.isFinite)).toBe(true));
  it("no sample is below 0", () => expect(samples.every((value) => value >= 0)).toBe(true));
  it("no sample is above 1", () => expect(samples.every((value) => value <= 1)).toBe(true));
  it("samples are not all identical", () => expect(new Set(samples).size).toBeGreaterThan(100));

  it("a far negative coordinate does not throw", () => expect(() => Build().GetNoise(-1000, -1000)).not.toThrow());
  // Off-lattice on purpose: Perlin is identically 0 at gradient lattice points,
  // so coordinates that are exact multiples of NoiseScale would match trivially.
  it("negative and positive coordinates both produce noise", () =>
    expect(Build().GetNoise(-237, -237)).not.toBe(Build().GetNoise(237, 237)));

  it("a lattice point samples to exactly 0.5", () =>
    expect(Build(1000, { Octaves: 1 }).GetNoise(BaseConfiguration.NoiseScale * 4, BaseConfiguration.NoiseScale * 4)).toBe(0.5));
});

describe("toroidal tiling", () => {
  const period = BaseConfiguration.GradientGridWidth * BaseConfiguration.NoiseScale;

  it("repeats after one period in x", () => {
    const noise = Build();
    expect(noise.GetNoise(10, 20)).toBeCloseTo(noise.GetNoise(10 + period, 20), 5);
  });

  it("repeats after one period in y", () => {
    const noise = Build();
    expect(noise.GetNoise(10, 20)).toBeCloseTo(noise.GetNoise(10, 20 + period), 5);
  });

  it("repeats into negative space", () => {
    const noise = Build();
    expect(noise.GetNoise(10, 20)).toBeCloseTo(noise.GetNoise(10 - period, 20), 5);
  });

  it("does not repeat at half a period", () => {
    const noise = Build();
    expect(noise.GetNoise(10, 20)).not.toBeCloseTo(noise.GetNoise(10 + period / 2, 20), 3);
  });
});

describe("continuity", () => {
  // A transposed interpolation, or a wrap that skipped a gradient row, shows up
  // as a discontinuity exactly at a gradient cell boundary. Single octave so the
  // boundary under test is the only one in play.
  const noise = Build(1000, { Octaves: 1 });
  const scale = BaseConfiguration.NoiseScale;

  it("is continuous across a gradient cell boundary in x", () =>
    expect(Math.abs(noise.GetNoise(scale - 0.001, 30) - noise.GetNoise(scale + 0.001, 30))).toBeLessThan(0.01));

  it("is continuous across a gradient cell boundary in y", () =>
    expect(Math.abs(noise.GetNoise(30, scale - 0.001) - noise.GetNoise(30, scale + 0.001))).toBeLessThan(0.01));

  it("is continuous across the origin boundary", () =>
    expect(Math.abs(noise.GetNoise(-0.001, 30) - noise.GetNoise(0.001, 30))).toBeLessThan(0.01));

  it("neighbouring world tiles differ only gradually", () => {
    let largestStep = 0;

    for (let x = -200; x < 200; x++) largestStep = Math.max(largestStep, Math.abs(noise.GetNoise(x, 17) - noise.GetNoise(x + 1, 17)));

    expect(largestStep).toBeLessThan(0.1);
  });
});

describe("octaves", () => {
  it("more octaves changes the field", () =>
    expect(Build(1000, { Octaves: 1 }).GetNoise(37.5, 21.25)).not.toBe(Build(1000, { Octaves: 4 }).GetNoise(37.5, 21.25)));

  it("stays in range at 8 octaves", () => {
    const noise = Build(1000, { Octaves: 8 });
    const samples = Array.from({ length: 500 }, (_unused, step) => noise.GetNoise(step * 7 - 1000, step * 3 - 400));

    expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("persistence changes the field", () =>
    expect(Build(1000, { Persistence: 0.5 }).GetNoise(37.5, 21.25)).not.toBe(Build(1000, { Persistence: 0.9 }).GetNoise(37.5, 21.25)));

  it("lacunarity changes the field", () =>
    expect(Build(1000, { Lacunarity: 2 }).GetNoise(37.5, 21.25)).not.toBe(Build(1000, { Lacunarity: 3 }).GetNoise(37.5, 21.25)));
});

describe("gradient grid coverage", () => {
  // The legacy implementation wrapped modulo (width - 1), so the final row and
  // column of gradients were never read. Sampling in the last cell must differ
  // from sampling in the first.
  const noise = Build(1000, { Octaves: 1 });
  const scale = BaseConfiguration.NoiseScale;
  const lastCell = BaseConfiguration.GradientGridWidth - 1;

  it("the last gradient column participates", () =>
    expect(noise.GetNoise(lastCell * scale + scale / 2, scale / 2)).not.toBeCloseTo(noise.GetNoise(scale / 2, scale / 2), 3));

  it("the last gradient row participates", () =>
    expect(noise.GetNoise(scale / 2, lastCell * scale + scale / 2)).not.toBeCloseTo(noise.GetNoise(scale / 2, scale / 2), 3));
});

describe("distribution", () => {
  // This suite used to assert only that the minimum fell below 0.4 and the
  // maximum above 0.6, which a field spanning just 0.28 to 0.70 satisfies. It
  // did, and water — everything below 0.3 — was 0.01% of the world. Extremes
  // prove nothing about a field that is bunched everywhere else, so these assert
  // on quantiles: a threshold has to sit inside the bulk of the distribution,
  // not past its tail.
  const noise = Build();
  const samples : number[] = [];

  // Strided across the whole tiling period rather than along a line, so the
  // sample is representative of the world instead of one transect through it.
  const period = BaseConfiguration.GradientGridWidth * BaseConfiguration.NoiseScale;

  for (let x = 0; x < period; x += 14)
    for (let y = 0; y < period; y += 14) samples.push(noise.GetNoise(x, y));

  const sorted = [...samples].sort((left, right) => left - right);
  const Quantile = (fraction : number) => sorted[Math.floor(fraction * (sorted.length - 1))]!;

  it("has enough samples to be meaningful", () => expect(samples.length).toBeGreaterThan(19000));

  it("a tenth of the world is below the water line", () => expect(Quantile(0.1)).toBeLessThan(TerrainThresholds.Grassland));

  it("a tenth of the world is above the hill line", () => expect(Quantile(0.9)).toBeGreaterThan(TerrainThresholds.Hill));

  it("the highest ground clears the mountain line", () => expect(Quantile(0.99)).toBeGreaterThan(TerrainThresholds.Mountain));

  it("stays within [0, 1]", () => expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true));

  // The clamp in GetNoise is a safety net, not a shaping tool. If Gain is pushed
  // high enough that a real share of the field saturates, peaks and troughs
  // flatten into featureless plateaus.
  it("almost nothing saturates the clamp", () => {
    const saturated = samples.filter((value) => value === 0 || value === 1).length;

    expect(saturated / samples.length).toBeLessThan(0.001);
  });
});

describe("gain", () => {
  it("is rejected at zero", () => expect(() => Build(1000, { Gain: 0 })).toThrow(RangeError));
  it("is rejected when negative", () => expect(() => Build(1000, { Gain: -1 })).toThrow(RangeError));

  it("widens the spread around the midpoint", () => {
    const Spread = (gain : number) => {
      const noise = Build(1000, { Gain: gain });
      let widest = 0;

      for (let step = 0; step < 2000; step++) widest = Math.max(widest, Math.abs(noise.GetNoise(step * 0.9 - 900, step * 0.4 - 400) - 0.5));

      return widest;
    };

    expect(Spread(2)).toBeGreaterThan(Spread(1));
  });

  it("leaves a lattice point at the midpoint", () =>
    // Perlin is identically 0 on the lattice, and any gain times 0 is still 0.
    expect(Build(1000, { Octaves: 1, Gain: 5 }).GetNoise(BaseConfiguration.NoiseScale * 4, BaseConfiguration.NoiseScale * 4)).toBe(0.5));
});
