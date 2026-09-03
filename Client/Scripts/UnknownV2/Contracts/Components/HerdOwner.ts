/**
 * The tuning knobs for one herd, held by the entity that Owns its members.
 *
 * Tuning only. Everything about a herd that changes as it goes about its day --
 * which state it is in, where it is roaming, what it is walking to -- lives on
 * HerdGoal beside this. The split is worth keeping: this component is written once
 * when the herd is built and read forever after, and mixing rewritten-every-tick
 * fields into it left no rule for which of the two a new mutable field belonged
 * to.
 *
 * SteeringClamp bounds the length of a member's steering vector, which is the
 * distance its TargetLocation is placed ahead of it -- not a speed. How fast the
 * member actually covers that distance is IsMoveable.speed, applied by
 * HandleMovement.
 */
export class HerdOwner {
    constructor(
        public SteeringClamp = 1,
        public BubbleRadius = 2,
        public WanderRadius = 25,
        public ArrivalRadius = 2,
        /**
         * How close a threat has to be before the herd starts shying away, in
         * tiles. Comfortably wider than BubbleRadius: an animal that only noticed
         * something once it was inside its own spacing bubble would be brushed
         * against before it reacted.
         *
         * This is the radius for LEANING AWAY. Changing state -- bunching up or
         * scattering outright -- happens only once a threat is well inside it, at
         * PanicRadiusFraction of this distance. Without that split, anything
         * visible anywhere would panic the herd and it would never simply graze
         * warily.
         */
        public FearRadius = 8,
        /**
         * The most the herd's bearing may change when it picks its next
         * destination, in radians.
         *
         * This is what keeps the roaming readable as an animal wandering rather
         * than as a flock being teleported around. Destinations drawn freely
         * around the herd average a 90 degree turn and routinely double back,
         * so the herd visibly stops dead and reverses every time it arrives.
         * Held to a fraction of a turn instead, each leg bends off the last one
         * and the path reads as a curve.
         */
        public MaxTurn = Math.PI / 5
    ) {}
}
