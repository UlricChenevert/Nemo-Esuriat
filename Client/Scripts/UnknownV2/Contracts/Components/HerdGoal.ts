import { HerdState } from "../../Configuration/HerdConstants.ts";
import type { Position } from "./Position.ts";

/**
 * Everything about a herd that CHANGES, held by the same entity that Owns its
 * members and carries their HerdOwner tuning.
 *
 * The two were one component and should not have been: HerdOwner is written once
 * when the herd is built and read forever after, while every field here is
 * rewritten as the herd goes about its day. Splitting them is also what lets the
 * wander bearing sit beside the migration destination, which it must -- they are
 * two answers to the same question, "where is this herd headed", and a herd that
 * kept them in different components would need a rule about which one wins.
 *
 * State starts at Forage because that is what a herd with nothing wrong with it
 * does. The rest start undefined so the first tick can seed them from where the
 * herd actually is, rather than from a spawn position the component would have to
 * be told about.
 */
export class HerdGoal {
    constructor(
        /** One of HerdState. What the herd decided it was doing this tick. */
        public State : number = HerdState.Forage,
        /** Which way the herd is roaming, in radians. Undefined before its first leg. */
        public WanderBearing : number | undefined = undefined,
        /** Where a foraging herd is drifting. Replaced once the group arrives. */
        public WanderTarget : Position | undefined = undefined,
        /**
         * The tile a migration is aiming at, found once and cached here.
         *
         * Cached rather than recomputed because finding it can cost an outward
         * scan of the noise field. Re-deriving that every tick would be thousands
         * of samples a frame to produce an answer that has not changed since the
         * herd set off.
         */
        public Destination : Position | undefined = undefined,
        /**
         * Which NeedKind Destination was chosen to satisfy, so a member arriving
         * knows what it came for.
         */
        public DestinationNeed : number | undefined = undefined,
        /**
         * Seconds before an unreached Destination is given up on, counted down by
         * UpdateNeeds and only while the herd is actually migrating.
         *
         * Without it a herd whose target sits behind ground the coarse scan sampled
         * over walks at it until the world ends.
         */
        public DestinationSecondsRemaining = 0,
        /**
         * Seconds since the herd last got meaningfully closer to wherever it is headed.
         *
         * Counted up by UpdateNeeds and reset by the AI whenever real progress is made.
         * This is what lets a herd notice it is blocked: a destination is otherwise only
         * replaced on arrival, and arrival is exactly what does not happen when there is
         * a mountain in the way.
         */
        public StallSeconds = 0,
        /**
         * The closest the herd has come to its current destination so far, so progress
         * can be told from the weaving a flock does anyway. Infinity until it has been
         * measured once.
         */
        public BestDistanceToDestination = Number.POSITIVE_INFINITY,
        /**
         * Set when a member reported it could not move at all, and cleared by whichever
         * resolver reads it.
         *
         * The fast path out of being blocked. The stall clock above eventually notices
         * too, but it takes seconds to trip, and seconds of a deer standing motionless
         * against a rock face is precisely what that failure looks like from outside. One
         * animal finding every heading refused is already conclusive -- there is nothing
         * to be gained by waiting to see whether it stays true.
         */
        public ForcedRetarget = false
    ) {}

    /**
     * Forgets the current destination and everything learned about approaching it.
     *
     * One method rather than five assignments at each call site: the stall bookkeeping is
     * only meaningful relative to a particular destination, and leaving a stale best
     * distance behind would have the next destination judged against the last one's
     * progress -- so a herd would abandon a fresh target the moment it was chosen.
     */
    ClearDestination () : this {
        this.Destination = undefined
        this.DestinationNeed = undefined
        this.DestinationSecondsRemaining = 0
        this.ForcedRetarget = false

        return this.ResetStall()
    }

    ResetStall () : this {
        this.StallSeconds = 0
        this.BestDistanceToDestination = Number.POSITIVE_INFINITY

        return this
    }
}
