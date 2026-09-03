/****************************************/
//
//     Herd behaviour
//
/****************************************/

/**
 * The whole tuning surface of the herd AI, in one file.
 *
 * Weights live here rather than beside the steering maths they feed so that every
 * state's numbers sit next to each other where they can be compared. The point of
 * the behaviour tables is that adding a state is a local edit; that only holds if
 * its numbers are somewhere obvious rather than scattered through the functions
 * that read them.
 */

/**
 * What a herd is currently doing.
 *
 * A plain const object rather than an enum, matching TerrainKind: isolatedModules
 * forbids const enums, and a regular enum would emit a runtime object anyway.
 *
 * Not a component. The state is one field on HerdGoal; a five-value list of names
 * does not need a store of its own.
 */
export const HerdState = {
    Forage : 0,
    Migrate : 1,
    DefensiveClump : 2,
    DefensiveScatter : 3,
    Sleep : 4
} as const

export type HerdStateValue = typeof HerdState[keyof typeof HerdState]

/**
 * What each state is called, indexed by the state itself. Kept beside HerdState
 * so a new state cannot be added without a name showing up as undefined here.
 */
export const HerdStateNames : readonly string[] = [
    "Forage", "Migrate", "DefensiveClump", "DefensiveScatter", "Sleep"
]

/** What one member is doing this tick, chosen by the member decision tree. */
export const MemberAction = {
    Steer : 0,
    BeginCollecting : 1,
    Collect : 2,
    Rest : 3
} as const

export type MemberActionValue = typeof MemberAction[keyof typeof MemberAction]

export const MemberActionNames : readonly string[] = [
    "Steer", "BeginCollecting", "Collect", "Rest"
]

/** Which appetite a number refers to. Indexes the by-need tables below. */
export const NeedKind = {
    Food : 0,
    Water : 1,
    Sleep : 2
} as const

export type NeedKindValue = typeof NeedKind[keyof typeof NeedKind]

export const NeedKindNames : readonly string[] = ["Food", "Water", "Sleep"]

/****************************************/
//
//     Steering
//
/****************************************/

/**
 * The relative pull of each steering term. Every term arrives as a unit vector
 * except terrain avoidance, so these are the only thing setting their balance.
 */
export interface SteeringWeights {
    readonly separation : number
    readonly alignment : number
    readonly cohesion : number
    readonly goal : number
    readonly terrain : number
}

/**
 * What each herd state means, expressed as steering weights.
 *
 * Forage is the original system's numbers, unchanged, so a herd with nothing
 * wrong with it steers exactly as it did before any of this existed. That is
 * deliberate and load-bearing: it is what lets the existing steering tests keep
 * asserting what they always asserted.
 *
 * Terrain sits above goal in every state. A destination must never win against
 * ground that refuses to be walked on -- the alternative is a herd that marches
 * into a lake because the water it wanted was on the far side.
 */
export const SteeringWeightsByState : Record<HerdStateValue, SteeringWeights> = {
    /**
     * Separation outweighs the rest because it is the only term that can fail
     * visibly: cohesion losing to it slightly means a loose herd, but separation
     * losing means members standing on the same tile, drawn as one animal.
     */
    [HerdState.Forage] : {
        separation : 1.6, alignment : 0.6, cohesion : 0.8, goal : 1.0, terrain : 2.0
    },
    /**
     * Goal dominates and cohesion loosens, so a travelling herd strings out into
     * a column behind its leaders rather than shuffling across the world as a
     * blob. Alignment rises to keep the column pointing one way.
     */
    [HerdState.Migrate] : {
        separation : 1.6, alignment : 0.8, cohesion : 0.6, goal : 2.5, terrain : 3.0
    },
    /**
     * Cohesion beating separation IS this state -- everything else is detail.
     * Separation stays non-zero so a bunched herd still reads as several animals
     * pressed together instead of one animal drawn once.
     */
    [HerdState.DefensiveClump] : {
        separation : 1.0, alignment : 0.6, cohesion : 3.0, goal : 0.0, terrain : 2.0
    },
    /**
     * The mirror image: no cohesion, no alignment, strong separation. Every
     * animal for itself, which is what survives something that can only catch
     * one of them.
     */
    [HerdState.DefensiveScatter] : {
        separation : 3.0, alignment : 0.0, cohesion : 0.0, goal : 0.0, terrain : 2.0
    },
    /**
     * Unreachable while every sleeping member takes the Rest action, which writes
     * no steering at all. Kept sane rather than zeroed so a future "restless
     * sleeper" action inherits numbers instead of a herd that cannot move.
     */
    [HerdState.Sleep] : {
        separation : 1.2, alignment : 0.0, cohesion : 0.4, goal : 0.0, terrain : 2.0
    }
}

/**
 * The pull of shying away from a threat, deliberately larger than the other terms
 * combined.
 *
 * Unlike them it does not arrive as a unit vector: it fades to nothing at the
 * edge of the fear radius and reaches full strength as the threat closes in, so
 * this is the weight at the point of contact rather than everywhere. Anything
 * smaller and the herd's own cohesion would walk it back into the thing it was
 * trying to get away from.
 *
 * Not scaled by threat severity. How frightening a predator is decides which
 * defensive state the herd picks; it does not also decide how hard each animal
 * leans away, because that would make the two tunable numbers fight each other.
 */
export const AvoidThreatWeight = 4.0

/****************************************/
//
//     Threats
//
/****************************************/

/**
 * How far inside its fear radius a threat must come before the herd changes state
 * rather than merely leaning away from it.
 *
 * A fraction rather than an absolute, so a herd tuned with a small FearRadius
 * also panics late. Without this split, anything in sight would flip the herd
 * into a defensive state from any distance and the ordinary "shy away and keep
 * grazing" reading would be gone entirely.
 */
export const PanicRadiusFraction = 0.4

/**
 * How much of its fear radius a herd keeps while it is asleep.
 *
 * A sleeping animal is not a watchful one. Without this a herd either sleeps with its
 * eyes open -- reacting from as far off as it would while grazing, which makes sleep
 * indistinguishable from standing still -- or, if nothing wakes it at all, lets a person
 * walk right up and lean over it. Halving the radius gives the readable middle: you can
 * approach a sleeping herd much closer than a grazing one, and it startles when you
 * finally get there.
 */
export const SleepingFearRadiusFraction = 0.5

/**
 * Severities SUM across every threat inside the panic radius, and the total is
 * what both of these thresholds are read against.
 *
 * The total is what matters, not the worst single threat. One hyena is something
 * an animal survives by running in its own direction; ten hyenas is something a
 * herd survives by presenting a wall. Summing rather than counting also means a
 * wolf can weigh more than a dog without needing a second rule.
 *
 * Below ScatterThreatTotal the herd does not change state at all -- it carries on
 * with what it was doing, leaning away as it goes. That third band matters as much
 * as the other two: without it anything nearby at all would throw the herd into a
 * defensive state, and wary-but-still-grazing -- which is what animals actually do
 * about one person on foot -- would not be expressible.
 */
export const ScatterThreatTotal = 0.5

/** At or above this total, the herd bunches together instead of scattering. */
export const ClumpThreatTotal = 1.5

/**
 * How threatening a person is, absent anything saying otherwise.
 *
 * Startling but not dangerous, and deliberately below ScatterThreatTotal: a lone
 * walker makes a herd edge away while it keeps grazing, two together break it up,
 * and a crowd closing in bunches it.
 *
 * A real predator is expected to weigh more than this -- around
 * ScatterThreatTotal, so that one of them scatters a herd on its own and a pack
 * alarms it.
 */
export const DefaultThreatSeverity = 0.3

/****************************************/
//
//     Needs
//
/****************************************/

// All per second, so they hold at any frame rate.

/** ~125 seconds from full to empty. */
export const FoodDrainPerSecond = 0.008
/** ~83 seconds: thirst is meant to trip before hunger, so water drives most trips. */
export const WaterDrainPerSecond = 0.012
/** ~250 seconds awake. */
export const SleepDrainPerSecond = 0.004
/** ~50 seconds to sleep it off, so a night is much shorter than a day. */
export const SleepRecoveryPerSecond = 0.02

/**
 * Enter and exit thresholds, deliberately far apart.
 *
 * A single threshold makes the state flap: the tick a herd's water crosses the
 * line it stops migrating, immediately drains back below the line, and starts
 * again -- so it stands at the edge of the lake vibrating instead of drinking.
 * The gap between enter and exit is what makes the herd commit to the trip and
 * then commit to having finished it.
 */
export const MigrateEnterThreshold = 0.35
export const MigrateExitThreshold = 0.75

/**
 * Sleep's window sits well below migration's, so a herd that is both exhausted
 * and thirsty deals with the thirst first. Sleep outranking hunger in the
 * decision tree only matters once things are genuinely dire.
 */
export const SleepEnterThreshold = 0.15
export const SleepExitThreshold = 0.85

/** Seconds of standing still one collection costs, indexed by NeedKind. */
export const CollectionSecondsByNeed : readonly number[] = [6, 4, 0]

/**
 * What one completed collection pays, indexed by NeedKind.
 *
 * Well over the migration exit threshold's distance from its enter threshold, so
 * a couple of visits genuinely settles the need instead of leaving the herd
 * hovering at the boundary.
 */
export const CollectionGainByNeed : readonly number[] = [0.5, 0.6, 0]

/****************************************/
//
//     Terrain awareness
//
/****************************************/

/**
 * How many points a herd samples around itself each tick to work out which way
 * the ground is unwalkable.
 *
 * Sampled once per HERD, not once per member. Perlin noise varies gradually, so
 * nine animals standing within a few tiles of each other probing their own
 * surroundings are measuring the same slope nine times. One shared reading also
 * steers better: the herd flows around a mountain range as a body rather than as
 * nine animals each independently discovering it.
 */
export const TerrainSampleCount = 12

/**
 * How far from the centroid those samples are taken.
 *
 * Far enough that the herd notices a range before it is standing on it, close
 * enough that what it notices is relevant to where it is now.
 */
export const TerrainSampleRadiusTiles = 10

// The pull of the sampled terrain is per state, in SteeringWeightsByState.terrain
// above. It does not arrive as a unit vector -- it fades with distance and with how
// much of the sampled ground is unwalkable, so open country contributes nothing.

/****************************************/
//
//     Migration goals
//
/****************************************/

// There is deliberately no minimum migration distance. A hungry herd standing on
// grass is handled by the member tree, which has each animal start grazing where it
// stands -- so a "migration" onto the tile underfoot is the correct answer, not a
// degenerate one, and forcing the destination further away would march a herd off
// the very grass it wanted.

/**
 * Tiles between samples when scanning outward for a resource.
 *
 * Coarse on purpose. The noise field changes gradually, so a step of a few tiles
 * cannot miss a lake -- only its exact edge, which the herd finds by walking.
 */
export const GoalScanStepTiles = 3

/** How far out the scan is willing to look before admitting there is nothing. */
export const GoalScanMaxRadiusTiles = 150

/**
 * A hard ceiling on samples per scan, so a herd deep in a mountain range gives up
 * and retries later rather than stalling a frame every time it gets thirsty.
 */
export const MaxGoalScanProbes = 2000

/**
 * At most this many herds may run an outward scan in one tick.
 *
 * Ten herds re-goaling on the same tick is the difference between a 1.6ms spike
 * and a dropped frame. A herd waiting two or three frames for its destination is
 * invisible; a stutter is not.
 */
export const MaxGoalScansPerTick = 1

/**
 * Seconds before an unreached migration destination is abandoned and re-chosen.
 *
 * Without it a herd that cannot reach its target -- blocked by ground the coarse
 * scan sampled over -- walks at it forever.
 */
export const MigrateGoalExpirySeconds = 45

/**
 * Seconds of getting no closer to a destination before the herd gives up on it and
 * chooses another.
 *
 * The answer to a herd walking into something it cannot walk through. A destination was
 * otherwise only ever replaced on ARRIVAL -- which is precisely the thing that never
 * happens when a mountain is in the way, so a blocked herd stood and waited
 * indefinitely because nothing in the system was ever going to tell it to stop waiting.
 *
 * Deliberately short. This is not a timeout on a leg: a herd making steady progress
 * resets it constantly and never trips it, however long the journey. It is a timeout on
 * getting nowhere, and four seconds of getting nowhere is already long enough for a
 * player to notice the herd looking stupid.
 */
export const StallSecondsMax = 4

/**
 * How much closer the herd must get for it to count as progress.
 *
 * A whole tile rather than any improvement at all. Boids never approach in a straight
 * line -- they weave constantly as they jostle for spacing -- so a herd pinned against a
 * mountain still drifts hundredths of a tile nearer and further every tick. A threshold
 * of zero would read that noise as progress and the stall would never trip.
 */
export const StallProgressTiles = 1

/**
 * How many bearings a foraging herd tries before settling for the best it found.
 *
 * Generous because the test a leg has to pass is strict: destinations must be grass or
 * wadeable water, and hill, mountain and open water together are close to half the
 * world. Four attempts was enough when the only requirement was "walkable"; against a
 * bar that nearly half of all tiles fail, four would settle for the fallback most of the
 * time and the hill rule would be advisory rather than real.
 */
export const WanderAttempts = 8
