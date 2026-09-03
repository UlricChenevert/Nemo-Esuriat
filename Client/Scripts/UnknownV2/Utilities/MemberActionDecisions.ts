import {
    CollectionSecondsByNeed, HerdState, MemberAction, NeedKind, type MemberActionValue
} from "../Configuration/HerdConstants.ts";
import { CollectingResource } from "../Contracts/Components/CollectingResource.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { TargetLocation } from "../Contracts/Components/TargetLocation.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { Branch, Leaf, type DecisionNode } from "./DecisionTree.ts";
import type { HerdMember } from "./BoidSteering.ts";
import type { HerdContext } from "./HerdSensing.ts";
import { IsDrinkableWater, IsForageGround } from "./TerrainUtilities.ts";
import { isSameTile } from "./PositionUtilities.ts";

/**
 * What one animal does about what its herd decided, and how it does it.
 *
 * This is where an animal is allowed to stop being a boid. A herd that has walked to
 * water has not drunk anything -- somebody has to stand still in it -- and the flock
 * steering has no way to express standing still, because a boid always has somewhere
 * it is being pulled. So the break is a separate decision, made per member, on top of
 * the herd's.
 *
 * INVARIANT: HandleMovement throws if a TargetLocation exists on an entity with no
 * Position or no IsMoveable. The gather pass in HerdSensing already excludes such
 * entities from being members at all, and nothing here writes a target to anything
 * that is not a member -- the collect path only ever REMOVES one.
 */

/** What a member behaviour is allowed to look at. */
export interface MemberActionInput {
    readonly registry : IRegistry
    readonly world : WorldStreamingResources
    readonly context : HerdContext
    readonly member : HerdMember
    /**
     * Where the boid pass says this member should walk, already weighted, clamped and
     * checked against unwalkable ground. Undefined when it should be told nothing.
     *
     * Computed for every member including the ones about to ignore it. That is a few
     * flops wasted on an animal that turns out to be drinking, against a steering
     * pass that stays one shape rather than growing a branch for each action.
     */
    readonly target : Position | undefined
}

export interface MemberBehaviour {
    /**
     * The only place a herd member's TargetLocation or CollectingResource is written.
     */
    Act(input : MemberActionInput) : void
}

/**
 * Whether the ground under a world tile answers a particular need.
 *
 * The bridge between "what the herd came here for" and "what is actually underfoot",
 * so neither the tree nor the behaviours carry a switch over need kinds.
 */
export function IsResourceGround(
    world : WorldStreamingResources, worldX : number, worldY : number, need : number
) : boolean {
    if (need === NeedKind.Water) return IsDrinkableWater(world, worldX, worldY)
    if (need === NeedKind.Food) return IsForageGround(world, worldX, worldY)

    // Sleep is not something the ground provides.
    return false
}

function HerdIsDefending(context : HerdContext) : boolean {
    return context.goal.State === HerdState.DefensiveClump
        || context.goal.State === HerdState.DefensiveScatter
}

/**
 * Order is priority, as with the herd tree.
 *
 * Fleeing outranks everything, so a predator interrupts a drink. Being already
 * committed to a drink outranks deciding to start one, so a member mid-collection is
 * not re-asked the question every tick. Everything else falls through to ordinary
 * flocking.
 */
export const MemberDecisionTree : DecisionNode<MemberActionInput, MemberActionValue> = Branch(
    "HerdIsDefending", (input)=>HerdIsDefending(input.context),
    // Steer cancels any collection in progress, which is what makes this branch an
    // interruption rather than merely a change of mind.
    Leaf(MemberAction.Steer, "Flees"),
    Branch(
        /**
         * Anything nearby at all stops the animal doing what it was doing.
         *
         * Above IsCollecting on purpose, and separate from HerdIsDefending on purpose. A
         * lone person is not frightening enough to scatter a herd -- that needs the
         * severity total -- but an animal quite obviously does not carry on drinking with
         * somebody standing next to it. Without this branch a drinking herd ignored people
         * entirely, because the only interrupt was the defensive states and one person
         * never reached them.
         */
        "IsDisturbed", (input)=>input.context.isDisturbed,
        Leaf(MemberAction.Steer, "Startled"),
        Branch(
            "IsCollecting", (input)=>input.member.collecting !== undefined,
            Branch(
                /**
                 * The escape hatch for having been shoved off the puddle. Separation from
                 * the animals crowding in behind can move a member off the tile it was
                 * drinking from, and without this it would stand on dry land running down
                 * a timer for water it is no longer touching.
                 */
                "IsStillOnResource",
                (input)=>IsResourceGround(
                    input.world, input.member.position.x, input.member.position.y,
                    input.member.collecting!.need
                ),
                Leaf(MemberAction.Collect, "KeepsCollecting"),
                Leaf(MemberAction.Steer, "LostTheResource")
            ),
            Branch(
                "HerdWantsResource",
                (input)=>input.context.goal.State === HerdState.Migrate
                    && input.context.goal.DestinationNeed !== undefined,
                Branch(
                    /**
                     * A terrain probe UNDER the member, deliberately -- not its distance
                     * from the herd's destination.
                     *
                     * Steering is clamped to about a tile per tick, so a member converges
                     * on a lake over several ticks and gets its feet wet well before it
                     * reaches the exact coordinate the herd was aiming at. That is the
                     * moment it should start drinking. It is also why a coarsely-scanned
                     * destination costs nothing in accuracy: the destination only has to
                     * get the animal to the water, and the water decides the rest.
                     */
                    "IsStandingOnResource",
                    (input)=>IsResourceGround(
                        input.world, input.member.position.x, input.member.position.y,
                        input.context.goal.DestinationNeed!
                    ),
                    Branch(
                        /**
                         * Somebody else is already drinking on this exact tile.
                         *
                         * A collecting member writes no steering at all, so it is the one
                         * kind of animal separation cannot push apart -- which made a
                         * waterhole the one place in the game where a whole herd reliably
                         * stacked onto a single tile and drew as one blinking animal. This
                         * sends the late arrival on to find its own patch of shore instead.
                         */
                        "IsResourceTileTaken", IsResourceTileTaken,
                        Leaf(MemberAction.Steer, "FindsItsOwnSpot"),
                        Leaf(MemberAction.BeginCollecting, "Arrives")
                    ),
                    Leaf(MemberAction.Steer, "StillTravelling")
                ),
                Branch(
                    "HerdIsSleeping", (input)=>input.context.goal.State === HerdState.Sleep,
                    Leaf(MemberAction.Rest, "Sleeps"),
                    Leaf(MemberAction.Steer, "Flocks")
                )
            )
        )
    )
)

/** Whether another member is already collecting on this member's tile. */
function IsResourceTileTaken(input : MemberActionInput) : boolean {
    return input.context.members.some((other)=>
        other.entity !== input.member.entity
            && other.collecting !== undefined
            && isSameTile(other.position, input.member.position)
    )
}

/**
 * The maintained table of what each member action does.
 *
 * Record<MemberActionValue, MemberBehaviour>, so adding an action without giving it a
 * behaviour is a compile error rather than a silent no-op at runtime.
 */
export const MemberBehaviours : Record<MemberActionValue, MemberBehaviour> = {
    [MemberAction.Steer] : {Act : ActSteer},
    [MemberAction.BeginCollecting] : {Act : ActBeginCollecting},
    /**
     * Deliberately empty.
     *
     * Standing still is the ABSENCE of a TargetLocation, not a target equal to the
     * member's own position -- HandleMovement strips a target it has arrived at, so
     * the latter would have the animal flicker between moving and not, one tick on
     * and one tick off, for as long as it was drinking.
     */
    [MemberAction.Collect] : {Act : ()=>{}},
    [MemberAction.Rest] : {Act : ActRest}
}

/**
 * Walk where the flock says, and stop collecting anything.
 *
 * The removal is unconditional and untested-for: RemoveComponent returns false when
 * there was nothing there, so a member that was not collecting pays one map lookup.
 * Every path that abandons a collection -- fleeing, and losing the ground underfoot --
 * routes through here, so abandonment happens in exactly one place.
 */
function ActSteer(input : MemberActionInput) : void {
    const {registry, member, target} = input

    registry.RemoveComponent(member.entity, CollectingResource)

    if (target === undefined) {
        // Drop the old target rather than leaving it standing.
        //
        // Leaving it was a genuine hole in the terrain guarantee: a target vetoed THIS
        // tick still had last tick's target sitting on the entity, and HandleMovement
        // walks whatever is there. So a member that had been refused every heading
        // carried on strolling toward a stale aim point, straight into the rock the veto
        // had just turned it away from.
        registry.RemoveComponent(member.entity, TargetLocation)
        return
    }

    const existingTarget = registry.GetComponent(member.entity, TargetLocation)

    if (existingTarget) {
        existingTarget.TargetLocation.x = target.x
        existingTarget.TargetLocation.y = target.y
    } else {
        registry.RegisterEntity(member.entity, TargetLocation, new TargetLocation(target))
    }
}

/**
 * Stop, and start taking something in.
 *
 * Removing the TargetLocation IS the break from the flock: with nothing to walk
 * toward, HandleMovement never touches this entity again until it is steering once
 * more. Nothing else needs to know that the animal has stopped.
 */
function ActBeginCollecting(input : MemberActionInput) : void {
    const {registry, member, context} = input

    const need = context.goal.DestinationNeed

    if (need === undefined) return

    registry.RemoveComponent(member.entity, TargetLocation)

    registry.RegisterEntity(
        member.entity, CollectingResource,
        new CollectingResource(need, CollectionSecondsByNeed[need] ?? 0)
    )
}

/** Stand still and sleep. Same mechanism as collecting: no target, no movement. */
function ActRest(input : MemberActionInput) : void {
    input.registry.RemoveComponent(input.member.entity, TargetLocation)
}
