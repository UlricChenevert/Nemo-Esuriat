import { GameWidth } from "../Configuration/GameConstants.js";
import { HerdOwner } from "../Contracts/Components/HerdOwner.js";
import { Owns } from "../Contracts/Components/Owns.js";
import { Position } from "../Contracts/Components/Position.js";
import { TargetLocation } from "../Contracts/Components/TargetLocation.js";
import { Vector2D } from "../Contracts/Components/Vector2D.js";
import { Human } from "../Contracts/Tags/Human.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.js";
import { SpatialHashGrid } from "../Libraries/Spatial/SpatialHashGrid.js";
import { clampMagnitude, getNormalizedDistanceVector, isNotWithinGameBorder, magnitude, normalize } from "../Utilities/PositionUtilities.js";
/**
 * The relative pull of the four steering terms, each of which arrives as a unit
 * vector so these are the only thing setting their balance.
 *
 * Separation outweighs the rest because it is the only term that can fail
 * visibly: cohesion losing to it slightly means a loose herd, but separation
 * losing means members standing on the same tile, drawn as one animal.
 */
const SeparationWeight = 1.6;
const AlignmentWeight = 0.6;
const CohesionWeight = 0.8;
const GoalWeight = 1.0;
/**
 * The pull of shying away from a person, which is deliberately larger than the
 * other four combined.
 *
 * Unlike them it does not arrive as a unit vector: it fades to nothing at the
 * edge of the fear radius and reaches full strength as the person closes in, so
 * this is the weight at the point of contact rather than everywhere. Anything
 * smaller and the herd's own cohesion would walk it back into the person it was
 * trying to get away from.
 */
const AvoidHumanWeight = 4.0;
/**
 * How many bearings to try before giving up and leaving the herd aimed where it
 * already was. A herd pinned against the border rejects the bearings pointing
 * out of the world, so the sweep below needs enough attempts to come most of the
 * way round; the cap exists only so it cannot spin forever.
 */
const MaxWanderAttempts = 10;
/**
 * How far each rejected bearing rotates the next attempt, in radians.
 *
 * Rejections are swept through consistently rather than re-rolled at random so
 * that a herd walking into the border curves along it. Re-rolling would have it
 * jitter in place at the edge, picking a new direction every tick and averaging
 * out to no travel at all.
 */
const WanderRejectionTurn = Math.PI / 6;
// Shared by every herd. Seeding per-herd from the clock would hand herds created
// in the same tick identical wander paths.
const wanderGenerator = new LinearCongruentialGenerator(Date.now());
/**
 * Steers every herd member as a boid: shy away from people, hold spacing, match
 * the neighbours' heading, stay with the group, and drift toward the herd's
 * wander target.
 *
 * The system writes TargetLocation and nothing else. HandleMovement owns the
 * actual travel, which is why the steering vector is a short offset from the
 * member's current position rather than a velocity -- its length says how far
 * ahead to aim, and IsMoveable.speed says how fast the member gets there.
 */
export function HandleAIMovement(registry) {
    // Gathered once for every herd rather than per herd, and kept as a plain
    // array rather than indexed spatially: there is realistically one person in
    // the world, and a grid over a single point costs more to build than the
    // scan it replaces.
    const humanPositions = [];
    registry.ForEachEntityWith([Human, Position], (_, __, humanPosition) => {
        humanPositions.push(humanPosition);
    });
    registry.ForEachEntityWith([HerdOwner, Owns], (_, herdController, owns) => {
        if (owns.entities.length == 0)
            return;
        const members = [];
        const membersByEntity = new Map();
        // Cells sized to the query radius, as SpatialHashGrid asks for: smaller
        // and each bubble query walks a block of near-empty cells.
        const distanceQuerier = new SpatialHashGrid(Math.max(herdController.BubbleRadius, 1));
        const centroid = new Position(0, 0);
        owns.entities.forEach((entity) => {
            // Owns is documented as never pruning its entries, so a destroyed
            // member is expected here rather than a broken invariant. It also
            // holds the glyphs of a text label and anything else AddOwner
            // attaches, so a live entry that simply is not a herd animal -- no
            // Position, no IsMoveable -- is normal too.
            if (!registry.IsAlive(entity))
                return;
            const currentPosition = registry.GetComponent(entity, Position);
            if (!currentPosition)
                return;
            if (!registry.GetComponent(entity, IsMoveable))
                return;
            const existingTarget = registry.GetComponent(entity, TargetLocation);
            const heading = existingTarget
                ? getNormalizedDistanceVector(currentPosition, existingTarget.TargetLocation)
                : new Vector2D(0, 0);
            centroid.x += currentPosition.x;
            centroid.y += currentPosition.y;
            distanceQuerier.Insert(entity, currentPosition.x, currentPosition.y);
            const member = { entity: entity, position: currentPosition, heading: heading };
            members.push(member);
            membersByEntity.set(entity, member);
        });
        if (members.length == 0)
            return;
        centroid.x /= members.length;
        centroid.y /= members.length;
        const wanderTarget = ResolveWanderTarget(herdController, centroid);
        members.forEach((currentMember) => {
            const separation = new Vector2D(0, 0);
            const alignment = new Vector2D(0, 0);
            let neighbourCount = 0;
            distanceQuerier.ForEachInRadius(currentMember.position.x, currentMember.position.y, herdController.BubbleRadius, (otherEntity, otherX, otherY) => {
                // Every member is inside its own bubble at distance zero.
                // Left in, it would contribute a zero-length push and drag
                // the whole herd's spacing toward nothing.
                if (otherEntity === currentMember.entity)
                    return;
                const deltaX = currentMember.position.x - otherX;
                const deltaY = currentMember.position.y - otherY;
                const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                neighbourCount++;
                const otherMember = membersByEntity.get(otherEntity);
                if (otherMember) {
                    alignment.x += otherMember.heading.x;
                    alignment.y += otherMember.heading.y;
                }
                // Two members on the exact same tile have no direction to
                // push apart along; the next tick's jitter separates them.
                if (distanceSquared == 0)
                    return;
                // Divided by the squared distance rather than merely
                // normalized, so a neighbour pressed up against this one
                // shoves far harder than one at the edge of the bubble.
                // Unweighted, every neighbour pushes the same and spacing
                // never settles -- members trade places forever.
                separation.x += deltaX / distanceSquared;
                separation.y += deltaY / distanceSquared;
            });
            const avoidance = AvoidHumans(currentMember.position, humanPositions, herdController.FearRadius);
            const separationDirection = normalize(separation);
            const alignmentDirection = (neighbourCount > 0) ? normalize(alignment) : new Vector2D(0, 0);
            const cohesionDirection = getNormalizedDistanceVector(currentMember.position, centroid);
            const goalDirection = getNormalizedDistanceVector(currentMember.position, wanderTarget);
            const steering = clampMagnitude(new Vector2D(avoidance.x * AvoidHumanWeight
                + separationDirection.x * SeparationWeight
                + alignmentDirection.x * AlignmentWeight
                + cohesionDirection.x * CohesionWeight
                + goalDirection.x * GoalWeight, avoidance.y * AvoidHumanWeight
                + separationDirection.y * SeparationWeight
                + alignmentDirection.y * AlignmentWeight
                + cohesionDirection.y * CohesionWeight
                + goalDirection.y * GoalWeight), herdController.SteeringClamp);
            // A member whose terms cancel out is already where it wants to be.
            // Writing a target equal to its position would only have
            // HandleMovement strip the component again next tick.
            if (magnitude(steering) == 0)
                return;
            const targetX = currentMember.position.x + steering.x;
            const targetY = currentMember.position.y + steering.y;
            const existingTarget = registry.GetComponent(currentMember.entity, TargetLocation);
            if (existingTarget) {
                existingTarget.TargetLocation.x = targetX;
                existingTarget.TargetLocation.y = targetY;
            }
            else {
                registry.RegisterEntity(currentMember.entity, TargetLocation, new TargetLocation(new Position(targetX, targetY)));
            }
        });
    });
}
/**
 * Which way one member should shy, and how hard, given where the people are.
 *
 * Unlike the other steering terms this is not a unit vector. Its length fades
 * linearly from 1 when the person is underfoot to 0 at the edge of the fear
 * radius, so an animal ambles away from someone on the horizon and bolts from
 * someone on top of it. A normalized term would instead have the whole herd
 * flinch the instant a person crossed the radius, from any distance, which reads
 * as the herd being teleported rather than startled.
 *
 * People beyond the radius contribute nothing at all, so a herd with no one near
 * it steers exactly as it would if this system knew nothing about people.
 */
function AvoidHumans(position, humanPositions, fearRadius) {
    const avoidance = new Vector2D(0, 0);
    if (!(fearRadius > 0))
        return avoidance;
    humanPositions.forEach((humanPosition) => {
        const deltaX = position.x - humanPosition.x;
        const deltaY = position.y - humanPosition.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance >= fearRadius)
            return;
        // Standing on the same tile leaves no direction to flee along. The
        // member's other terms move it off the spot, and the next tick has one.
        if (distance == 0)
            return;
        const strength = 1 - distance / fearRadius;
        avoidance.x += (deltaX / distance) * strength;
        avoidance.y += (deltaY / distance) * strength;
    });
    return avoidance;
}
/**
 * The herd's current destination, replaced once the group has arrived.
 *
 * Arrival is judged against the centroid rather than any one member: waiting for
 * every straggler would leave a herd whose separation keeps one member circling
 * stuck on the same target indefinitely.
 *
 * The new destination is a bend off the herd's current bearing rather than a
 * fresh point somewhere around it, which is what keeps the change of direction
 * gradual -- see HerdOwner.MaxTurn.
 */
function ResolveWanderTarget(herdController, centroid) {
    const existing = herdController.WanderTarget;
    if (existing) {
        const deltaX = existing.x - centroid.x;
        const deltaY = existing.y - centroid.y;
        if (Math.hypot(deltaX, deltaY) > herdController.ArrivalRadius)
            return existing;
    }
    // A herd that has never roamed has no bearing to bend away from, so its
    // first leg is the one and only free choice of direction.
    const currentBearing = herdController.WanderBearing ?? wanderGenerator.Random() * 2 * Math.PI;
    const turn = (wanderGenerator.Random() * 2 - 1) * herdController.MaxTurn;
    // Sweep rejected bearings the same way the herd was already turning, so
    // being turned aside by the border continues the curve instead of undoing it.
    const sweepDirection = (turn < 0) ? -1 : 1;
    for (let attempt = 0; attempt < MaxWanderAttempts; attempt++) {
        const bearing = currentBearing + turn + sweepDirection * attempt * WanderRejectionTurn;
        const candidate = new Position(centroid.x + Math.cos(bearing) * herdController.WanderRadius, centroid.y + Math.sin(bearing) * herdController.WanderRadius);
        if (isNotWithinGameBorder(candidate))
            continue;
        herdController.WanderBearing = bearing;
        herdController.WanderTarget = candidate;
        return candidate;
    }
    // Every bearing left the world, which takes a WanderRadius wider than the
    // world itself. Aim at the middle: always inside the border, and it walks
    // the herd back off whatever edge it is stuck against.
    const fallback = new Position(GameWidth / 2, GameWidth / 2);
    herdController.WanderBearing = Math.atan2(fallback.y - centroid.y, fallback.x - centroid.x);
    herdController.WanderTarget = fallback;
    return fallback;
}
//# sourceMappingURL=HandleAIMovement.js.map