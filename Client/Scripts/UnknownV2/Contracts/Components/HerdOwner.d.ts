import type { Position } from "./Position.ts";
/**
 * The tuning knobs and roaming state for one herd, held by the entity that Owns
 * its members.
 *
 * SteeringClamp bounds the length of a member's steering vector, which is the
 * distance its TargetLocation is placed ahead of it -- not a speed. How fast the
 * member actually covers that distance is IsMoveable.speed, applied by
 * HandleMovement.
 *
 * WanderTarget and WanderBearing start undefined so the first tick can seed them
 * from where the herd actually is and send it off in an arbitrary direction,
 * rather than from a spawn position and heading the component would have to be
 * told about.
 */
export declare class HerdOwner {
    SteeringClamp: number;
    BubbleRadius: number;
    WanderRadius: number;
    ArrivalRadius: number;
    /**
     * How close a Human has to be before the herd starts shying away, in
     * tiles. Comfortably wider than BubbleRadius: an animal that only
     * noticed a person once they were inside its own spacing bubble would
     * be brushed against before it reacted.
     */
    FearRadius: number;
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
    MaxTurn: number;
    /** Which way the herd is currently roaming, in radians. */
    WanderBearing: number | undefined;
    WanderTarget: Position | undefined;
    constructor(SteeringClamp?: number, BubbleRadius?: number, WanderRadius?: number, ArrivalRadius?: number, 
    /**
     * How close a Human has to be before the herd starts shying away, in
     * tiles. Comfortably wider than BubbleRadius: an animal that only
     * noticed a person once they were inside its own spacing bubble would
     * be brushed against before it reacted.
     */
    FearRadius?: number, 
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
    MaxTurn?: number, 
    /** Which way the herd is currently roaming, in radians. */
    WanderBearing?: number | undefined, WanderTarget?: Position | undefined);
}
//# sourceMappingURL=HerdOwner.d.ts.map