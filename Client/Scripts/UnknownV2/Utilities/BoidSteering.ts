import type { SteeringWeights } from "../Configuration/HerdConstants.ts";
import { AvoidThreatWeight } from "../Configuration/HerdConstants.ts";
import type { CollectingResource } from "../Contracts/Components/CollectingResource.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import type { Needs } from "../Contracts/Components/Needs.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Vector2D } from "../Contracts/Components/Vector2D.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { SpatialHashGrid } from "../Libraries/Spatial/SpatialHashGrid.ts";
import { clampMagnitude, getNormalizedDistanceVector, magnitude, normalize } from "./PositionUtilities.ts";
import { IsPassableTerrain } from "./TerrainUtilities.ts";

/**
 * The steering maths a herd member is moved by, with the weights left to the
 * caller.
 *
 * Extracted from HandleAIMovement so that each herd state can blend the same terms
 * differently -- bunching up is the separation and cohesion weights trading places,
 * not a second implementation of flocking. The system that used to hold this is
 * now only responsible for deciding WHICH weights, which is the change that makes
 * a new behaviour a table entry instead of another branch in a growing function.
 *
 * Nothing here touches the registry or writes a component. The terms come in, a
 * vector goes out, and the member behaviours decide what to do with it.
 */

/** A live herd member, gathered once so the steering pass does no registry lookups. */
export interface HerdMember {
    entity : Entity
    position : Position
    /** Where it was already headed, as a unit vector. Zero when it has no target. */
    heading : Vector2D
    /** Its appetites, or undefined for a member that has none and contributes none. */
    needs : Needs | undefined
    /** Set while it has stopped to feed or drink. */
    collecting : CollectingResource | undefined
}

/** Something a herd is afraid of, and how much. */
export interface ThreatReading {
    position : Position
    severity : number
}

/**
 * The five steering terms, before weighting.
 *
 * The first four arrive as unit vectors, so the weights alone set their balance.
 * The last two deliberately do not: both fade with distance, so their length
 * carries "how urgent" and weighting them as if they were unit vectors would throw
 * that away.
 */
export interface SteeringTerms {
    separation : Vector2D
    alignment : Vector2D
    cohesion : Vector2D
    goal : Vector2D
    /** Fades to nothing at the fear radius; full strength at contact. */
    threat : Vector2D
    /** Shared by the whole herd. Zero in open country. */
    terrain : Vector2D
}

/**
 * How one member should space itself against its neighbours, and which way they
 * are collectively facing.
 *
 * Both fall out of one pass over the bubble, because they ask about the same set of
 * neighbours and walking it twice would double the only part of the steering that
 * is not O(1).
 */
export function AccumulateNeighbourTerms(
    member : HerdMember,
    distanceQuerier : SpatialHashGrid<Entity>,
    membersByEntity : Map<Entity, HerdMember>,
    bubbleRadius : number
) : {separation : Vector2D, alignment : Vector2D} {
    const separation = new Vector2D(0, 0)
    const alignment = new Vector2D(0, 0)

    let neighbourCount = 0

    distanceQuerier.ForEachInRadius(
        member.position.x, member.position.y, bubbleRadius,
        (otherEntity, otherX, otherY)=>{
            // Every member is inside its own bubble at distance zero. Left in, it
            // would contribute a zero-length push and drag the whole herd's
            // spacing toward nothing.
            if (otherEntity === member.entity) return

            const deltaX = member.position.x - otherX
            const deltaY = member.position.y - otherY
            const distanceSquared = deltaX * deltaX + deltaY * deltaY

            neighbourCount++

            const otherMember = membersByEntity.get(otherEntity)

            if (otherMember) {
                alignment.x += otherMember.heading.x
                alignment.y += otherMember.heading.y
            }

            // Two members on the exact same tile have no direction to push apart
            // along; the next tick's jitter separates them.
            if (distanceSquared == 0) return

            // Divided by the squared distance rather than merely normalized, so a
            // neighbour pressed up against this one shoves far harder than one at
            // the edge of the bubble. Unweighted, every neighbour pushes the same
            // and spacing never settles -- members trade places forever.
            separation.x += deltaX / distanceSquared
            separation.y += deltaY / distanceSquared
        }
    )

    return {
        separation : normalize(separation),
        alignment : (neighbourCount > 0) ? normalize(alignment) : new Vector2D(0, 0)
    }
}

/**
 * Which way one member should shy, and how hard, given where the threats are.
 *
 * Unlike the unit terms this fades linearly from 1 when the threat is underfoot to
 * 0 at the edge of the fear radius, so an animal ambles away from something on the
 * horizon and bolts from something on top of it. A normalized term would instead
 * have the whole herd flinch the instant anything crossed the radius, from any
 * distance, which reads as the herd being teleported rather than startled.
 *
 * Threats beyond the radius contribute nothing at all, so a herd with nothing near
 * it steers exactly as it would if this function knew of no threats whatsoever.
 *
 * Not scaled by severity. Severity decides which defensive state the herd picks;
 * having it also set how hard each animal leans would make two tuning numbers fight
 * over one behaviour.
 */
export function AvoidThreats(position : Position, threats : readonly ThreatReading[], fearRadius : number) : Vector2D {
    const avoidance = new Vector2D(0, 0)

    if (!(fearRadius > 0)) return avoidance

    threats.forEach((threat)=>{
        const deltaX = position.x - threat.position.x
        const deltaY = position.y - threat.position.y
        const distance = Math.hypot(deltaX, deltaY)

        if (distance >= fearRadius) return

        // Standing on the same tile leaves no direction to flee along. The member's
        // other terms move it off the spot, and the next tick has one.
        if (distance == 0) return

        const strength = 1 - distance / fearRadius

        avoidance.x += (deltaX / distance) * strength
        avoidance.y += (deltaY / distance) * strength
    })

    return avoidance
}

/** The unit pull toward a destination, or nothing when the herd has none. */
export function GoalTerm(position : Position, goalPosition : Position | undefined) : Vector2D {
    if (goalPosition === undefined) return new Vector2D(0, 0)

    return getNormalizedDistanceVector(position, goalPosition)
}

/**
 * The weighted sum of every term, bounded to `steeringClamp`.
 *
 * Clamped by magnitude rather than per axis. Clamping each axis with Math.min, as
 * an early version did, leaves large negative components completely unbounded and
 * also bends the direction the member was steering in.
 */
export function CombineSteering(weights : SteeringWeights, terms : SteeringTerms, steeringClamp : number) : Vector2D {
    return clampMagnitude(new Vector2D(
        terms.threat.x * AvoidThreatWeight
            + terms.terrain.x * weights.terrain
            + terms.separation.x * weights.separation
            + terms.alignment.x * weights.alignment
            + terms.cohesion.x * weights.cohesion
            + terms.goal.x * weights.goal,
        terms.threat.y * AvoidThreatWeight
            + terms.terrain.y * weights.terrain
            + terms.separation.y * weights.separation
            + terms.alignment.y * weights.alignment
            + terms.cohesion.y * weights.cohesion
            + terms.goal.y * weights.goal
    ), steeringClamp)
}

/**
 * Where a member should be told to walk to, or undefined if it should be told
 * nothing this tick.
 *
 * The last line of defence for "herds do not walk into mountains or open water".
 * The terrain term steers around unwalkable ground, but it is sampled coarsely and
 * shared across the herd, so it nudges rather than guarantees -- a strong enough
 * flee or cohesion pull can still point a member at a cliff. This refuses to write
 * that target at all.
 *
 * The first retry drops the goal term specifically, because a destination is the one
 * term that routinely points somewhere the member cannot follow: the water a thirsty
 * herd wants is on the far side of the lake it must not swim across. Everything else
 * -- spacing, fleeing, staying with the group -- is local and rarely the culprit.
 *
 * Failing that it SLIDES: the same vector is tried rotated further and further off its
 * original heading until one lands on walkable ground. That fallback matters more than
 * it looks. Refusing to write a target at all leaves the animal standing perfectly
 * still, and a herd that walked up to a mountain would stop dead a few tiles short of
 * it -- twitching whenever the jittered terrain sampling happened to produce a vector
 * that passed, and otherwise frozen. Sliding turns that into an animal following the
 * face of the range around, which is both what one would do and what makes the herd
 * eventually get somewhere.
 *
 * Angles are tried in increasing order so the least deflection that works is the one
 * taken, and in both directions at each magnitude so a member is never biased into
 * turning the same way along every obstacle.
 *
 * A member ALREADY standing on unwalkable ground is exempt from all of this and may
 * move anywhere. Herds are scattered across a radius when they spawn and the world
 * streams in under them, so an animal on a peak or in the sea is a normal situation to
 * recover from; vetoing its moves would freeze it there permanently.
 */
const SlideAngles : readonly number[] = [
    Math.PI / 6, -Math.PI / 6,
    Math.PI / 3, -Math.PI / 3,
    Math.PI / 2, -Math.PI / 2,
    (2 * Math.PI) / 3, -(2 * Math.PI) / 3,
    (5 * Math.PI) / 6, -(5 * Math.PI) / 6,
    Math.PI
]

export function ResolveMemberTarget(
    world : WorldStreamingResources,
    member : HerdMember,
    weights : SteeringWeights,
    terms : SteeringTerms,
    steeringClamp : number,
    /**
     * Whether a tile is free for this member to move onto -- false for one another
     * member is standing on or has already been sent to this tick.
     *
     * Passed in rather than consulted here, because who is where is the herd's business
     * and this function knows only about one animal and the ground.
     */
    IsTileAvailable : (worldX : number, worldY : number) => boolean
) : Position | undefined {
    const steering = CombineSteering(weights, terms, steeringClamp)

    // A member whose terms cancel out is already where it wants to be. Writing a
    // target equal to its position would only have HandleMovement strip the
    // component again next tick.
    if (magnitude(steering) == 0) return undefined

    // Exempt: recovering from bad ground has to be possible.
    if (!IsPassableTerrain(world, member.position.x, member.position.y)) {
        return new Position(member.position.x + steering.x, member.position.y + steering.y)
    }

    const withoutGoal = CombineSteering(weights, {...terms, goal : new Vector2D(0, 0)}, steeringClamp)

    // Slide along whatever is in the way. Rotating the goal-less vector rather than the
    // original, so the deflection is measured off where the animal's local pressures
    // point rather than off a destination it has already been refused.
    const slideBase = (magnitude(withoutGoal) > 0) ? withoutGoal : steering

    const candidates = [steering, withoutGoal, ...SlideAngles.map((angle)=>RotateVector(slideBase, angle))]

    // First pass demands walkable AND unoccupied ground.
    for (const candidate of candidates) {
        const target = TargetIfPassable(world, member.position, candidate)

        if (target && IsTileAvailable(target.x, target.y)) return target
    }

    // Second pass drops the occupancy requirement.
    //
    // Sharing a tile is a drawing problem; being unable to move is a gameplay one. A herd
    // packed into a gap between two rocks would otherwise have its inner members refused
    // every heading and freeze -- which is the exact failure this whole round exists to
    // remove, reintroduced by a cosmetic rule. So occupancy is a strong preference, never
    // a hard constraint.
    for (const candidate of candidates) {
        const target = TargetIfPassable(world, member.position, candidate)

        if (target) return target
    }

    // Walled in on every heading there is -- a one-tile pocket. Standing still is the
    // only honest answer, and it is now genuinely rare rather than the common case.
    return undefined
}

/**
 * A cap on how many tile boundaries one move may cross before the walk gives up and
 * calls the path clear.
 *
 * Steering is bounded by SteeringClamp -- about a tile -- so a real move crosses two or
 * three. The cap exists only so that a degenerate offset cannot spin here forever.
 */
const MaxPathTileCrossings = 16

/**
 * The target `offset` aims at, if the member can actually get there.
 *
 * Checks the ground along the way as well as at the end. HandleMovement walks the
 * straight LINE to a target a fraction of a tile at a time, so a destination that is
 * itself walkable says nothing about what lies between -- and on a fractal noise field a
 * one-tile ridge or inlet lying across the path is common enough that herds were
 * reliably found standing on rock they had walked straight over.
 */
function TargetIfPassable(
    world : WorldStreamingResources, from : Position, offset : Vector2D
) : Position | undefined {
    if (magnitude(offset) == 0) return undefined
    if (!IsPathWalkable(world, from, offset)) return undefined

    return new Position(from.x + offset.x, from.y + offset.y)
}

/**
 * Whether every tile the move passes through can be walked on.
 *
 * Walks the TILES the segment crosses rather than sampling points along it. That
 * distinction is the whole function, and sampling was wrong in a way that looked right:
 * a member stepping from x = 387.11 toward x = 386.54 crosses tile 387 in the first few
 * percent of its journey, but every sample taken at a fraction of the way along -- even
 * at a quarter-tile spacing -- landed in tile 386 and skipped 387 entirely. An animal
 * duly walked onto a mountain that had been checked four times and never once looked at.
 *
 * A boundary walk cannot skip a tile by construction, and it is CHEAPER than the
 * sampling it replaces: two or three probes for a one-tile move rather than five, since
 * it stops at boundaries instead of at arbitrary points that often share a tile.
 *
 * The starting tile is not re-checked. Either it is walkable, or the member is stranded
 * and ResolveMemberTarget has already exempted it from all of this so that it can get
 * out.
 */
function IsPathWalkable(world : WorldStreamingResources, from : Position, offset : Vector2D) : boolean {
    const endX = from.x + offset.x
    const endY = from.y + offset.y

    let tileX = Math.floor(from.x)
    let tileY = Math.floor(from.y)

    const endTileX = Math.floor(endX)
    const endTileY = Math.floor(endY)

    const stepX = (offset.x > 0) ? 1 : ((offset.x < 0) ? -1 : 0)
    const stepY = (offset.y > 0) ? 1 : ((offset.y < 0) ? -1 : 0)

    // How far along the move, as a fraction of it, the next boundary on each axis lies --
    // and how much further apart successive boundaries on that axis are. Infinite for an
    // axis the move does not travel along, so it is simply never chosen.
    let nextX = (stepX === 0) ? Number.POSITIVE_INFINITY
        : ((stepX > 0 ? (tileX + 1 - from.x) : (from.x - tileX)) / Math.abs(offset.x))
    let nextY = (stepY === 0) ? Number.POSITIVE_INFINITY
        : ((stepY > 0 ? (tileY + 1 - from.y) : (from.y - tileY)) / Math.abs(offset.y))

    const spanX = (stepX === 0) ? Number.POSITIVE_INFINITY : 1 / Math.abs(offset.x)
    const spanY = (stepY === 0) ? Number.POSITIVE_INFINITY : 1 / Math.abs(offset.y)

    for (let crossing = 0; crossing < MaxPathTileCrossings; crossing++) {
        if (tileX === endTileX && tileY === endTileY) return true

        // Cross whichever boundary comes first.
        if (nextX <= nextY) {
            tileX += stepX
            nextX += spanX
        } else {
            tileY += stepY
            nextY += spanY
        }

        if (!IsPassableTerrain(world, tileX, tileY)) return false
    }

    return true
}

function RotateVector(vector : Vector2D, radians : number) : Vector2D {
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    return new Vector2D(vector.x * cos - vector.y * sin, vector.x * sin + vector.y * cos)
}
