/**
 * A member that has stopped being a boid in order to stand in one place and take
 * something in -- water from a shallow tile, food from grass.
 *
 * Its presence IS the entire break-out-of-the-flock mechanism. While it is here
 * the member decision tree returns Collect, whose behaviour writes no
 * TargetLocation at all, and HandleMovement -- which only ever moves entities that
 * have one -- has nothing to walk. Nothing freezes the animal or special-cases it
 * anywhere; it simply stops being given somewhere to be.
 *
 * That is also why standing still is the ABSENCE of a target rather than a target
 * equal to the current position. HandleMovement strips a target it has arrived at,
 * so the latter would have the member flicker between moving and not, one tick on
 * and one tick off, forever.
 */
export class CollectingResource {
    constructor(
        /** Which NeedKind this tops up, as a NeedKind value. */
        public need : number,
        /**
         * Seconds of standing still still owed before the need is credited.
         *
         * Counted down by UpdateNeeds. The need is paid on completion rather than
         * in instalments so that a member shoved off the water halfway through
         * gets nothing -- an animal interrupted mid-drink has not drunk.
         */
        public remainingSeconds : number
    ) {}
}
