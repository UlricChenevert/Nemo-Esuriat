import { MaxGoalScansPerTick, StallProgressTiles } from "../Configuration/HerdConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { HerdGoal } from "../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import type { Position } from "../Contracts/Components/Position.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.ts";
import {
    AccumulateNeighbourTerms, AvoidThreats, GoalTerm, ResolveMemberTarget, type SteeringTerms
} from "../Utilities/BoidSteering.ts";
import { EvaluateDecisionTree } from "../Utilities/DecisionTree.ts";
import { HerdBehaviours, HerdDecisionTree } from "../Utilities/HerdGoalDecisions.ts";
import { GatherThreats, SenseHerd, TileKey } from "../Utilities/HerdSensing.ts";
import { MemberBehaviours, MemberDecisionTree } from "../Utilities/MemberActionDecisions.ts";
import { getNormalizedDistanceVector } from "../Utilities/PositionUtilities.ts";

/**
 * Shared by every herd. Seeding per-herd from the clock would hand herds created in
 * the same tick identical wander paths.
 */
const herdWanderGenerator = new LinearCongruentialGenerator(Date.now())

/**
 * Decides what every herd is doing, and tells each of its animals what to do about it.
 *
 * An orchestrator and nothing else. It senses, it asks two decision trees, it looks up
 * two behaviour tables, and it writes nothing itself. Everything that used to be
 * inline -- the steering maths, the wander logic, the choice of weights -- now lives
 * behind one of those seams, which is what makes adding a behaviour an edit to a table
 * rather than another branch in a function that already did five things.
 *
 * The system still writes only TargetLocation and CollectingResource, both by way of
 * the member behaviours. HandleMovement owns the actual travel, which is why steering
 * is a short offset from the member's position rather than a velocity -- its length
 * says how far ahead to aim, and IsMoveable.speed says how fast the member gets there.
 *
 * Takes no clock. Everything time-dependent is in UpdateNeeds, which runs immediately
 * before this; hysteresis here is expressed as what the herd was doing last tick. That
 * is what lets the trees be tested by writing a context rather than by simulating one.
 */
export function HandleAIMovement(
    registry : IRegistry,
    world : WorldStreamingResources,
    random : IRandomNumberGenerator = herdWanderGenerator
) {
    // Gathered once for every herd rather than per herd. Threats are few and herds are
    // many, so scanning the world once and comparing against a small array beats
    // rebuilding an index per herd.
    const threats = GatherThreats(registry)

    // Shared across every herd this tick. An outward scan of the noise field is the
    // one genuinely expensive thing in here, and ten herds getting thirsty on the same
    // tick is the difference between a spike and a dropped frame. A herd that misses
    // its turn keeps whatever destination it had and looks again next frame, which is
    // invisible; a stutter is not.
    const scanBudget = {remaining : MaxGoalScansPerTick}

    registry.ForEachEntityWith([HerdOwner, Owns], (owner, herdOwner, owns)=>{
        if (owns.entities.length == 0) return

        const goal = EnsureHerdGoal(registry, owner)

        const context = SenseHerd(registry, world, random, owner, herdOwner, goal, owns, threats)

        if (context === undefined) return

        const state = EvaluateDecisionTree(HerdDecisionTree, context)
        const behaviour = HerdBehaviours[state]

        // Written before the goal is resolved and before any member is asked, because
        // both read the state back off the goal. Keeping one copy of it -- on the
        // component, not in a local -- is what stops the herd's decision and its
        // members' decisions from ever disagreeing about what tick they are in.
        goal.State = state

        const destination = behaviour.ResolveGoal({
            context : context, world : world, random : random, scanBudget : scanBudget
        })

        RecordProgressTowardDestination(goal, context.centroid, destination)

        // A member that finds every heading refused. One is enough to conclude the herd is
        // aiming somewhere it cannot get to.
        let blockedMembers = 0

        context.members.forEach((member)=>{
            const neighbourTerms = AccumulateNeighbourTerms(
                member, context.distanceQuerier, context.membersByEntity, herdOwner.BubbleRadius
            )

            const terms : SteeringTerms = {
                separation : neighbourTerms.separation,
                alignment : neighbourTerms.alignment,
                cohesion : getNormalizedDistanceVector(member.position, context.centroid),
                goal : GoalTerm(member.position, destination),
                threat : AvoidThreats(member.position, context.threatsInRange, herdOwner.FearRadius),
                terrain : context.terrainAvoidance
            }

            const target = ResolveMemberTarget(
                world, member, behaviour.weights, terms, herdOwner.SteeringClamp,
                // A member's own tile is available to it -- standing still is always a
                // legal outcome, and refusing it would freeze anyone whose neighbours have
                // boxed them in.
                (tileX, tileY)=>{
                    const key = TileKey(tileX, tileY)

                    return key === TileKey(member.position.x, member.position.y)
                        || !context.claimedTiles.has(key)
                }
            )

            if (target === undefined) blockedMembers++
            // Claimed the moment it is won, so the next member in the pass cannot be sent
            // to the same tile. Claiming after the whole pass would let every member pick
            // the same square and only discover the clash next tick.
            else context.claimedTiles.add(TileKey(target.x, target.y))

            const input = {
                registry : registry, world : world, context : context, member : member, target : target
            }

            MemberBehaviours[EvaluateDecisionTree(MemberDecisionTree, input)].Act(input)
        })

        // Read by the goal resolvers on the NEXT tick, which is a frame later than the
        // block was seen but still two orders of magnitude sooner than the stall clock
        // would have got there. Resolving the goal again within this tick would mean
        // steering every member twice for the sake of one that could not move.
        if (blockedMembers > 0) goal.ForcedRetarget = true
    })
}

/**
 * Notes whether the herd is actually getting anywhere, which is what lets a blocked one
 * eventually give up.
 *
 * Measured on the centroid rather than on any one member: a single animal jammed against
 * a rock while the rest of the herd walks on is not a stalled herd, and waiting for
 * every straggler would have the group abandon perfectly good destinations.
 *
 * The stall clock itself is wound by UpdateNeeds. All this does is reset it whenever real
 * ground has been covered, which is why "progress" needs a threshold: a flock weaves as
 * it jostles for spacing, so a herd pinned against a mountain still drifts hundredths of
 * a tile back and forth and any improvement at all would read as progress.
 */
function RecordProgressTowardDestination(
    goal : HerdGoal, centroid : Position, destination : Position | undefined
) {
    if (destination === undefined) {
        // Nowhere to be is not the same as getting nowhere. A fleeing or sleeping herd
        // must not accumulate a stall it will carry into its next journey.
        goal.ResetStall()
        return
    }

    const distance = Math.hypot(destination.x - centroid.x, destination.y - centroid.y)

    if (distance < goal.BestDistanceToDestination - StallProgressTiles) {
        goal.BestDistanceToDestination = distance
        goal.StallSeconds = 0
    }
}

/**
 * The herd's roaming state, created on demand if the owner has none.
 *
 * A herd built by MakeHerd always has one. Created here anyway, because the registry is
 * an open world: PopulateHerds, a test, or anything else may assemble a herd owner by
 * hand, and a herd that silently refused to move because one of its two components was
 * missing would be a genuinely baffling bug to chase.
 */
function EnsureHerdGoal(registry : IRegistry, owner : Entity) : HerdGoal {
    const existing = registry.GetComponent(owner, HerdGoal)

    if (existing) return existing

    const created = new HerdGoal()

    registry.RegisterEntity(owner, HerdGoal, created)

    return created
}
