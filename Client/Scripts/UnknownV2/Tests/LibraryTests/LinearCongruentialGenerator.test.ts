import { describe, it, expect } from "vitest";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";

const Draw = (generator : LinearCongruentialGenerator, count : number) =>
  Array.from({ length: count }, () => generator.Random());

describe("determinism", () => {
  it("same seed reproduces the sequence", () =>
    expect(Draw(new LinearCongruentialGenerator(1000), 20)).toEqual(Draw(new LinearCongruentialGenerator(1000), 20)));

  it("different seeds diverge", () =>
    expect(Draw(new LinearCongruentialGenerator(1), 20)).not.toEqual(Draw(new LinearCongruentialGenerator(2), 20)));

  it("instances are independent", () => {
    const first = new LinearCongruentialGenerator(7);
    const second = new LinearCongruentialGenerator(7);

    first.Random();

    // Advancing one generator must not perturb the other, or the composition
    // root's ordering would silently change the world.
    expect(second.Random()).toBe(new LinearCongruentialGenerator(7).Random());
  });
});

describe("range", () => {
  const values = Draw(new LinearCongruentialGenerator(1000), 5000);

  it("every draw is at least 0", () => expect(values.every((value) => value >= 0)).toBe(true));
  it("every draw is below 1", () => expect(values.every((value) => value < 1)).toBe(true));
  it("no draw is NaN", () => expect(values.every((value) => Number.isFinite(value))).toBe(true));
});

describe("seed coercion", () => {
  it("negative seed still produces finite draws", () =>
    expect(Draw(new LinearCongruentialGenerator(-500), 10).every(Number.isFinite)).toBe(true));

  it("fractional seed still produces finite draws", () =>
    expect(Draw(new LinearCongruentialGenerator(3.7), 10).every(Number.isFinite)).toBe(true));

  it("seed 0 does not lock the generator at 0", () =>
    expect(Draw(new LinearCongruentialGenerator(0), 5).some((value) => value !== 0)).toBe(true));
});

describe("distribution", () => {
  // A generator whose period collapsed would repeat values long before this
  // many draws; a full-period LCG over 2^32 states will not.
  it("10000 draws are all distinct", () =>
    expect(new Set(Draw(new LinearCongruentialGenerator(1000), 10000)).size).toBe(10000));

  it("mean is near 0.5", () => {
    const values = Draw(new LinearCongruentialGenerator(1000), 10000);
    const mean = values.reduce((total, value) => total + value, 0) / values.length;

    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
  });
});
