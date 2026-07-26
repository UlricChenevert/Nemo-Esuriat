/**
 * A source of deterministic pseudo-random numbers.
 *
 * Deterministic is the operative word: world generation reproduces terrain from
 * a seed rather than storing it, so every implementation must yield the same
 * sequence for the same seed on every run.
 */
export interface IRandomNumberGenerator {
    /** The next value in the sequence, in [0, 1). */
    Random() : number
}
