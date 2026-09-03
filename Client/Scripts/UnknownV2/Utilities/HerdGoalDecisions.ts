import {
    ClumpThreatTotal, GoalScanMaxRadiusTiles, GoalScanStepTiles, HerdState, MaxGoalScanProbes,
    MigrateEnterThreshold, MigrateExitThreshold, MigrateGoalExpirySeconds, NeedKind, ScatterThreatTotal,
    SleepEnterThreshold, SleepExitThreshold, StallSecondsMax, SteeringWeightsByState, WanderAttempts,
    type HerdStateValue, type SteeringWeights
} from "../Configuration/HerdConstants.ts";
import { Position } from "../Contracts/Components/Position.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";
import { Branch, Leaf, type DecisionNode } from "./DecisionTree.ts";
import type { HerdContext } from "./HerdSensing.ts";
import { magnitude } from "./PositionUtilities.ts";
import {
    FindNearestTile, IsDrinkableWater, IsForageGround, IsHerdDestination, IsPassableTerrain
} from "./TerrainUtilities.ts";

/**
 * What a herd decides to do, and what each of those decisions means.
 *
 * The tree and the table live in one file on purpose. Split by kind -- all trees in
 * one place, all behaviours in another -- adding a state would mean editing two
 * files that only ever change together. Split by LEVEL, as here, it is one file:
 * add a value to HerdState, add a leaf, add a row. The Record type makes the third
 * step a compile error rather than a thing to remember, which is the whole reason
 * the table is a table.
 *
 * The tree decides WHICH state; the table decides what that state does. Neither
 * knows anything about the other's contents.
 */

/**
 * The order of the branches below IS the priority order of the herd's concerns.
 *
 * Reading downward: nothing outranks being about to be eaten; then exhaustion, which
 * a herd cannot postpone forever; then whichever of thirst and hunger is worse; and
 * failing all of that, grazing, which is what a herd does when nothing is wrong.
 * Changing what outranks what means moving a line.
 */
export const HerdDecisionTree : DecisionNode<HerdContext, HerdStateValue> = Branch(
    "IsThreatening", (context)=>context.threatTotal >= ScatterThreatTotal,
    /**
     * Which defence depends on how much threat there is in total, not on how fast any
     * one of them moves. Numbers are what change the answer: one of a thing is
     * survived by running in your own direction, ten of it by presenting a wall.
     */
    Branch(
        "IsHerdAlarmed", (context)=>context.threatTotal >= ClumpThreatTotal,
        Leaf(HerdState.DefensiveClump, "Clump"),
        Leaf(HerdState.DefensiveScatter, "Scatter")
    ),
    /**
     * Hysteresis is expressed as a pair of branches on what the herd was doing last
     * tick, rather than as a dwell timer.
     *
     * That is what keeps this tree a pure function of its context -- no clock, no
     * elapsed time, nothing that has to be advanced before it can be asked. It is
     * also why HandleAIMovement needs no TimeResources at all.
     *
     * The verbosity is the price. Four of the branches here exist only to ask "and
     * which way was it going", and each is individually legible and individually
     * testable, which is worth more than being shorter.
     */
    Branch(
        "WasSleeping", (context)=>context.previousState === HerdState.Sleep,
        Branch(
            /**
             * Two ways to stop sleeping: having slept enough, or being woken.
             *
             * The disturbance half is not the same question as the threat branch above.
             * That one asks whether the herd should abandon what it is doing and defend
             * itself, which takes enough summed severity to matter. This asks only
             * whether something is close enough to notice, and one person leaning over a
             * sleeping herd is plainly that -- even though a lone person is nowhere near
             * frightening enough to make a herd scatter.
             *
             * Waking to Forage rather than to a defensive state is the point: the herd
             * gets up, edges away, and carries on. That is what an animal does about
             * somebody walking past.
             */
            "IsRestedOrWoken",
            (context)=>context.needs.sleep >= SleepExitThreshold || context.isDisturbed,
            NeedsSubtree(), Leaf(HerdState.Sleep, "StaysAsleep")
        ),
        Branch(
            "IsExhausted", (context)=>context.needs.sleep <= SleepEnterThreshold,
            Leaf(HerdState.Sleep, "FallsAsleep"), NeedsSubtree()
        )
    )
)

/**
 * Thirst and hunger, once nothing more urgent is happening.
 *
 * A function rather than a shared constant because the same shape appears on both
 * sides of the sleep branches and a tree is a graph the moment two parents point at
 * one child -- harmless today, but the depth guard in EvaluateDecisionTree exists
 * precisely because that is how a cyclic tree gets built by accident.
 */
function NeedsSubtree() : DecisionNode<HerdContext, HerdStateValue> {
    return Branch(
        "WasMigrating", (context)=>context.previousState === HerdState.Migrate,
        Branch(
            "IsToppedUp", (context)=>context.scarcestTravelLevel >= MigrateExitThreshold,
            Leaf(HerdState.Forage, "SettlesDown"), Leaf(HerdState.Migrate, "KeepsGoing")
        ),
        Branch(
            "IsNeedUrgent", (context)=>context.scarcestTravelLevel <= MigrateEnterThreshold,
            Leaf(HerdState.Migrate, "SetsOff"), Leaf(HerdState.Forage, "Grazes")
        )
    )
}

/** What resolving a goal is allowed to look at, and to spend. */
export interface HerdGoalInput {
    readonly context : HerdContext
    readonly world : WorldStreamingResources
    readonly random : IRandomNumberGenerator
    /**
     * How many outward scans are still affordable this tick, shared across every
     * herd. Ten herds getting thirsty on the same tick is the difference between a
     * spike and a dropped frame.
     */
    readonly scanBudget : {remaining : number}
}

export interface HerdBehaviour {
    readonly weights : SteeringWeights
    /**
     * Where the herd is trying to get to, or undefined when it has nowhere in
     * particular to be and the goal steering term should contribute nothing.
     */
    ResolveGoal(input : HerdGoalInput) : Position | undefined
}

/**
 * The maintained table of what each herd state DOES.
 *
 * Record<HerdStateValue, HerdBehaviour> rather than a plain object: adding a value to
 * HerdState without adding a row here fails to compile, which is the entire reason
 * this is a table and not a switch.
 */
export const HerdBehaviours : Record<HerdStateValue, HerdBehaviour> = {
    [HerdState.Forage] : {
        weights : SteeringWeightsByState[HerdState.Forage],
        ResolveGoal : ResolveWanderTarget
    },
    [HerdState.Migrate] : {
        weights : SteeringWeightsByState[HerdState.Migrate],
        ResolveGoal : ResolveMigrationTarget
    },
    [HerdState.DefensiveClump] : {
        weights : SteeringWeightsByState[HerdState.DefensiveClump],
        ResolveGoal : NoDestination
    },
    [HerdState.DefensiveScatter] : {
        weights : SteeringWeightsByState[HerdState.DefensiveScatter],
        ResolveGoal : NoDestination
    },
    [HerdState.Sleep] : {
        weights : SteeringWeightsByState[HerdState.Sleep],
        ResolveGoal : NoDestination
    }
}

/**
 * A herd with nowhere to be.
 *
 * Deliberately leaves goal.Destination standing rather than clearing it. A herd
 * interrupted mid-migration by a predator should resume the trip once the predator
 * leaves, not re-scan the world for the lake it was already walking to.
 */
function NoDestination() : Position | undefined {
    return undefined
}

/**
 * The herd's current drift, replaced once the group has arrived.
 *
 * Arrival is judged against the centroid rather than any one member: waiting for
 * every straggler would leave a herd whose separation keeps one member circling
 * stuck on the same target indefinitely.
 *
 * The new destination is a bend off the herd's current bearing rather than a fresh
 * point somewhere around it, which is what keeps the change of direction gradual --
 * see HerdOwner.MaxTurn.
 */
function ResolveWanderTarget(input : HerdGoalInput) : Position | undefined {
    const {context, world, random} = input
    const {goal, herdOwner, centroid} = context

    const existing = goal.WanderTarget

    // Three ways a leg can end, and only the first was ever there.
    //
    // Getting nowhere for long enough ends it as arriving does: without that, a herd
    // whose target sits behind a mountain has no route back into this branch at all and
    // stands there for good.
    //
    // A member reporting that it could not move AT ALL ends it immediately. Waiting out
    // the stall means several seconds of a deer standing still against rock before
    // anything reconsiders, which is exactly what that looks like from outside.
    const stalled = goal.StallSeconds >= StallSecondsMax || goal.ForcedRetarget

    // Consumed here whether or not it changes the outcome, so one blocked frame cannot
    // keep re-rolling the leg for the rest of the herd's life.
    goal.ForcedRetarget = false

    if (existing) {
        const deltaX = existing.x - centroid.x
        const deltaY = existing.y - centroid.y

        const arrived = Math.hypot(deltaX, deltaY) <= herdOwner.ArrivalRadius

        if (!arrived && !stalled) return existing
    }

    // A herd that has never roamed has no bearing to bend away from, so its first leg
    // is the one and only free choice of direction.
    const currentBearing = goal.WanderBearing ?? random.Random() * 2 * Math.PI

    // Which way to head, and how far the herd may swing off it.
    //
    // Arriving somewhere is a course correction, so it bends gently off the current
    // bearing -- that gentleness is the whole point of MaxTurn, and what makes roaming
    // read as an animal wandering rather than a flock being teleported about.
    //
    // Being STUCK is not a course correction. Bending gently off a bearing that has just
    // failed picks another direction into the same mountain, and at a fifth of a turn per
    // attempt a herd facing a range needs several stalls in a row before it is pointed
    // anywhere useful -- which is exactly the "stands about for ten or fifteen seconds
    // and then finally leaves" this is here to stop. So a stalled herd turns decisively,
    // and turns AWAY: the terrain reading it already has says which way the ground it
    // could not cross lies, and the opposite of that is the one direction guaranteed to
    // be worth trying.
    const escape = context.terrainAvoidance
    const blocked = stalled && magnitude(escape) > 0

    const baseBearing = blocked ? Math.atan2(escape.y, escape.x) : currentBearing

    // How wide a choice to make, which matters as much as which way.
    //
    // A blocked herd gets a NARROW spread about the escape bearing, not a free one. That
    // looks backwards and is the crux of it: given a free choice the herd re-rolls a
    // fresh direction every time it stalls, and since half of those point back at the
    // obstacle it spends its life turning around. Committing to roughly-away-from-the-rock
    // is what actually gets it out.
    //
    // A stall with no terrain to blame -- hemmed in by its own flock, or a destination
    // that cannot be approached for some other reason -- has no better direction to
    // prefer, so there a free choice really is the best available.
    const spread = blocked ? Math.PI / 4 : (stalled ? Math.PI : herdOwner.MaxTurn)

    // Nothing bounds where a herd may roam. The world is streamed in chunks around
    // the camera and has no extent to be outside of, so there is no edge to hold them
    // inside -- and the obvious candidate for one, GameWidth, is the width of the
    // viewport, not of the world. Rejecting targets against it sent every herd
    // standing beyond the first hundred tiles to the same fallback point, where they
    // converged into one enormous herd.
    //
    // What the ground has to be for a leg to be worth taking, and the one thing a new
    // leg is checked against. Several bends are tried before settling, rather than one:
    // a herd on a coast has most of its options in the sea, and re-rolling until
    // something sticks is what keeps it walking along the shore instead of into it.
    //
    // Judged on IsHerdDestination, not merely on being walkable, so hills are refused
    // as well as rock and open water. A hill has nothing on it to want, and because the
    // noise field bands outward from a peak, a hillside target is usually a target
    // pointed at the mountain behind it.
    //
    // Nearly half the world fails that test, so the attempt count has to be generous
    // where four was enough for "walkable". A second pass then settles for merely
    // walkable, because a herd deep in hill country would otherwise never find a legal
    // leg at all and the fallback would be an arbitrary one.
    let bearing = currentBearing
    let target = centroid
    let walkableTarget : Position | undefined = undefined
    let walkableBearing = currentBearing

    for (let attempt = 0; attempt < WanderAttempts; attempt++) {
        bearing = baseBearing + (random.Random() * 2 - 1) * spread

        target = new Position(
            centroid.x + Math.cos(bearing) * herdOwner.WanderRadius,
            centroid.y + Math.sin(bearing) * herdOwner.WanderRadius
        )

        if (IsHerdDestination(world, target.x, target.y)) break

        // Remembered in case nothing better turns up. Aiming at a hill is a poor leg;
        // aiming into a mountain is a broken one.
        if (walkableTarget === undefined && IsPassableTerrain(world, target.x, target.y)) {
            walkableTarget = target
            walkableBearing = bearing
        }
    }

    if (!IsHerdDestination(world, target.x, target.y) && walkableTarget !== undefined) {
        target = walkableTarget
        bearing = walkableBearing
    }

    // Accepted even if every bend landed badly. The target is only a pull, and the
    // terrain term plus the per-member veto are what actually stop anybody walking
    // into it -- refusing to have a destination at all would leave the herd milling.
    goal.WanderBearing = bearing
    goal.WanderTarget = target

    // A fresh leg has to be judged on its own approach, not on how the last one went.
    goal.ResetStall()

    return target
}

/**
 * Where a herd goes to fix whichever need is worst, found once and then remembered.
 *
 * Three sources, cheapest first, and the ordering is the entire performance story of
 * this system:
 *
 *   1. The destination already on the goal, if it has not expired and still answers
 *      the need the herd now has. Costs nothing.
 *   2. The herd's own terrain ring, which was sampled this tick anyway. Also free.
 *   3. An outward scan of the noise field, which is the only expensive option -- and
 *      therefore rationed, both by a shared per-tick budget and by its own probe cap.
 *
 * A herd standing on what it wants resolves through (2) to the tile underfoot, which
 * is the correct answer rather than a degenerate one: the member tree has each animal
 * begin feeding where it stands, so a "migration" of zero distance is simply a herd
 * settling down to graze.
 */
function ResolveMigrationTarget(input : HerdGoalInput) : Position | undefined {
    const {context, world, scanBudget} = input
    const {goal} = context

    const abandoned = goal.StallSeconds >= StallSecondsMax || goal.ForcedRetarget

    goal.ForcedRetarget = false

    // Which need this trip is for. The herd COMMITS to it until it is actually met,
    // rather than re-reading whichever need is scarcest right now.
    //
    // Re-reading it every tick is a feedback loop with a visible symptom. A thirsty herd
    // reaches water and starts drinking; three mouthfuls later its water has risen above
    // its food, so the scarcest need flips to Food, the destination is re-chosen as
    // grass, and the members still standing in the shallows are pulled out of the water
    // they came for. Food then drains back below water and it flips again. What the
    // player sees is a herd twitching in and out of a lake it never finishes drinking
    // from.
    const committedNeed = goal.DestinationNeed
    const needStillWanting = committedNeed !== undefined
        && NeedLevel(context, committedNeed) < MigrateExitThreshold

    const need = (needStillWanting && committedNeed !== undefined)
        ? committedNeed
        : context.scarcestTravelNeed

    const stillGood = goal.Destination !== undefined
        && goal.DestinationNeed === need
        && goal.DestinationSecondsRemaining > 0
        && !abandoned

    if (stillGood) return goal.Destination

    // Anything past here is choosing afresh, so what was learned about approaching the
    // old destination has to go with it.
    if (abandoned) goal.ClearDestination()

    const local = (need === NeedKind.Water) ? context.nearestDrinkableWater : context.nearestForage

    if (local) return RecordDestination(goal, local, need)

    if (scanBudget.remaining <= 0) {
        // Out of budget this tick. Keeping any stale destination rather than clearing
        // it means the herd carries on toward what it last knew about instead of
        // stopping dead while it waits for a turn to look.
        return goal.Destination
    }

    scanBudget.remaining--

    const found = FindNearestTile(
        world, context.centroid.x, context.centroid.y,
        (need === NeedKind.Water) ? IsDrinkableWater : IsForageGround,
        GoalScanStepTiles, GoalScanMaxRadiusTiles, MaxGoalScanProbes
    )

    if (!found) return undefined

    return RecordDestination(goal, found, need)
}

/** The herd's level for one NeedKind, so the commitment check needs no switch. */
function NeedLevel(context : HerdContext, need : number) : number {
    if (need === NeedKind.Water) return context.needs.water
    if (need === NeedKind.Sleep) return context.needs.sleep

    return context.needs.hungerUnits
}

function RecordDestination(
    goal : HerdContext["goal"], destination : Position, need : number
) : Position {
    goal.Destination = destination
    goal.DestinationNeed = need
    goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds

    // A new destination is judged on its own approach. Carrying the old best distance
    // over would have the herd abandon this one the instant it was chosen.
    goal.ResetStall()

    return destination
}
