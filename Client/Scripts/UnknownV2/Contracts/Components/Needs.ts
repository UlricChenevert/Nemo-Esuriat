import { NeedKind } from "../../Configuration/HerdConstants.ts";

/**
 * What one animal wants, each on [0, 1] where 1 is fully sated.
 *
 * Held per member rather than per herd, even though it is the herd that decides
 * where to go. A herd-level aggregate with no contributors would be a number
 * nobody owns, and a herd that cannot disagree with itself has nothing to average
 * -- the point of putting it here is that one thirsty straggler pulls on the
 * herd's decision in proportion to it being one animal out of nine.
 *
 * Starts full so a freshly spawned herd grazes where it was put rather than
 * immediately marching across the world for water it does not need yet.
 */
export class Needs {
    constructor(
        public hungerUnits = 1,
        public water = 1,
        public sleep = 1,
        /**
         * How fast this body burns through what it has, as a multiplier on every
         * drain. 1 is the tuning in HerdConstants; 0 freezes the appetites.
         *
         * Per body rather than global because the drain rates are the same
         * statement for a deer and for a person only by coincidence -- this is the
         * dial that lets them differ without a second set of constants. It scales
         * consumption alone: sleep RECOVERY is not metabolic, and scaling it here
         * would make a fast metabolism mean "sleeps better" as well as "starves
         * sooner".
         */
        public metabolismRate = 1
    ) {}

    /**
     * Reads one need by NeedKind.
     *
     * So that the behaviour tables can be driven by a need index rather than each
     * one carrying its own switch over three field names.
     */
    Get (kind : number) : number {
        if (kind === NeedKind.Water) return this.water
        if (kind === NeedKind.Sleep) return this.sleep

        return this.hungerUnits
    }

    /**
     * Adds `amount` to one need -- negative drains it -- and clamps back onto
     * [0, 1].
     *
     * Clamping lives here rather than at each caller so there is exactly one place
     * that could let a need escape its range. An unclamped need silently disables
     * its own hysteresis: a value that has drifted to -40 takes forty times as
     * long to climb back over its exit threshold as it should, and the herd looks
     * like it has forgotten how to stop drinking.
     */
    Add (kind : number, amount : number) : this {
        const clamped = Math.max(0, Math.min(1, this.Get(kind) + amount))

        if (kind === NeedKind.Water) this.water = clamped
        else if (kind === NeedKind.Sleep) this.sleep = clamped
        else this.hungerUnits = clamped

        return this
    }

    /**
     * Which of food and water is in shortest supply, as a NeedKind.
     *
     * Sleep is excluded deliberately. It is not something a herd travels to find,
     * so ranking it alongside the two that are would have a tired herd setting off
     * for a destination that does not exist.
     */
    ScarcestTravelNeed () : number {
        return (this.water <= this.hungerUnits) ? NeedKind.Water : NeedKind.Food
    }
}
