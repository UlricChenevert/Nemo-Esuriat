/****************************************/
//
//     LinearCongruentialGenerator
//
/****************************************/

import type { IRandomNumberGenerator } from "../../Interfaces/IRandomNumberGenerator.ts";

/** 2^32. The generator's modulus, and the divisor that maps state onto [0, 1). */
const Modulus = 4294967296

/**
 * A seeded linear congruential generator: state = (multiplier * state + increment) mod 2^32.
 *
 * The modulus is fixed at 2^32 rather than being configurable, because the
 * arithmetic depends on it. Reducing modulo 2^32 is exactly what `>>> 0` does
 * for free, and `Math.imul` performs the multiply with 32-bit wraparound so the
 * product never exceeds the 53 bits a JavaScript number can hold exactly. A
 * configurable modulus would force the multiply back into floating point, where
 * a large multiplier silently loses low-order bits — and those are precisely the
 * bits an LCG's output depends on.
 *
 * The default multiplier/increment pair is from Numerical Recipes and has full
 * period, so the generator visits all 2^32 states before repeating. That matters
 * here: the Perlin gradient grid consumes width^2 draws up front, and a
 * generator that cycles partway through would fill the far side of the grid with
 * a copy of the near side, producing terrain that visibly repeats.
 */
export class LinearCongruentialGenerator implements IRandomNumberGenerator {
    private _state : number

    constructor (seed : number, private _multiplier = 1664525, private _increment = 1013904223) {
        // Coerce the seed into the generator's state space so a negative or
        // fractional seed is still a valid starting point rather than poisoning
        // every subsequent draw with NaN.
        this._state = (seed >>> 0)
    }

    Random() : number {
        this._state = (Math.imul(this._multiplier, this._state) + this._increment) >>> 0

        return this._state / Modulus
    }
}
