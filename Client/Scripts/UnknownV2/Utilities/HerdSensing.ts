import {
    HerdState, NeedKind, PanicRadiusFraction, SleepingFearRadiusFraction, TerrainSampleCount,
    TerrainSampleRadiusTiles
} from "../Configuration/HerdConstants.ts";
import { CollectingResource } from "../Contracts/Components/CollectingResource.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import type { HerdGoal } from "../Contracts/Components/HerdGoal.ts";
import type { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import type { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { TargetLocation } from "../Contracts/Components/TargetLocation.ts";
import { Vector2D } from "../Contracts/Components/Vector2D.ts";
import { IsPredator } from "../Contracts/Components/IsPredator.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { SpatialHashGrid } from "../Libraries/Spatial/SpatialHashGrid.ts";
import type { HerdMember, ThreatReading } from "./BoidSteering.ts";
import { clampMagnitude, getNormalizedDistanceVector } from "./PositionUtilities.ts";
import { IsDrinkableWater, IsForageGround, IsPassableTerrain } from "./TerrainUtilities.ts";

/**
 * Everything one herd knows about itself and its surroundings this tick, gathered
 * once before any decision is made.
 *
 * Separated from the deciding so that the decision trees are pure functions of a
 * plain object. That is what makes them testable by writing a context by hand,
 * rather than by assembling a registry, a world, a herd and a predator and then
 * hoping the resulting state is the one the branch under test needed.
 */
export interface HerdContext {
    owner : Entity
    herdOwner : HerdOwner
    goal : HerdGoal
    /** What the herd decided last tick, which is what the hysteresis branches read. */
    previousState : number

    members : HerdMember[]
    membersByEntity : Map<Entity, HerdMember>
    distanceQuerier : SpatialHashGrid<Entity>
    centroid : Position

    /**
     * The herd's appetites: the mean of what its members report.
     *
     * A mean rather than the worst member, so one thirsty straggler moves the herd's
     * mind in proportion to being one animal out of nine rather than deciding for
     * everybody.
     *
     * A herd whose members carry no Needs at all reads as fully sated on every axis.
     * That default is deliberate and load-bearing: it is what keeps a herd built
     * without appetites -- by a test, or by anything that predates this system --
     * foraging exactly as it always did instead of setting off for water it has no
     * way of wanting.
     */
    needs : {hungerUnits : number, water : number, sleep : number}

    /** Which of food and water is shortest, as a NeedKind, and how short. */
    scarcestTravelNeed : number
    scarcestTravelLevel : number

    /**
     * Threats close enough to lean away from. Feeds the avoidance steering term and
     * nothing else.
     */
    threatsInRange : ThreatReading[]

    /**
     * Summed severity of threats close enough to panic the herd -- a much tighter
     * radius than threatsInRange.
     *
     * The two radii are what let a herd graze warily with somebody in sight while
     * still bolting from something at arm's length. One radius for both would mean
     * anything visible flipped the herd's state from any distance.
     */
    threatTotal : number

    /**
     * Whether anything at all is close enough to notice.
     *
     * Deliberately a different question from `threatTotal >= ScatterThreatTotal`, and the
     * distinction is what fixes two separate complaints. That threshold answers "should
     * the herd abandon everything and defend itself", which one person on foot should not
     * trigger. This answers "should the herd stop what it is doing and pay attention",
     * which one person on foot absolutely should -- an animal does not carry on drinking,
     * or sleeping, while somebody stands over it.
     *
     * A herd that is disturbed but not threatened goes back to grazing: alert, edging
     * away, not panicking.
     */
    isDisturbed : boolean

    /**
     * Which way the unwalkable ground lies, shared by every member.
     *
     * Zero in open country, so a herd on a plain steers exactly as it would if
     * terrain were not modelled at all.
     */
    terrainAvoidance : Vector2D

    /** The nearest sampled tile of each resource, if the ring happened to cross one. */
    nearestDrinkableWater : Position | undefined
    nearestForage : Position | undefined

    /**
     * Tiles already spoken for this tick, keyed by TileKey.
     *
     * Seeded with where every member is standing and added to as each one is given
     * somewhere to go, so no two animals are ever sent to the same tile and nobody walks
     * into ground already occupied.
     *
     * This exists because the renderer cannot draw two animals on one tile: it keeps one
     * glyph per cell, and resolves a tie between two entities on the same layer by
     * whichever was visited last -- an order IComponentRegistry explicitly leaves
     * unspecified. So a stacked pair does not look like a stacked pair, it looks like an
     * animal blinking in and out of existence.
     */
    claimedTiles : Set<string>
}

/** A tile's identity as a map key. Floored, because positions are continuous mid-step. */
export function TileKey (worldX : number, worldY : number) : string {
    return `${Math.floor(worldX)},${Math.floor(worldY)}`
}

/**
 * Every threat in the world, gathered once for all herds.
 *
 * Kept as a plain array rather than indexed spatially: there are realistically a
 * handful of these, and a grid over a handful of points costs more to build than the
 * scan it would replace.
 */
export function GatherThreats(registry : IRegistry) : ThreatReading[] {
    const threats : ThreatReading[] = []

    registry.ForEachEntityWith([IsPredator, Position], (_, predator, position)=>{
        threats.push({position : position, severity : predator.severity})
    })

    return threats
}

/**
 * Reads one herd, or returns undefined when it has no members worth steering.
 *
 * The gather is the only place that decides what counts as a herd member, which is
 * why it lives here rather than in the system: Owns holds text glyphs and anything
 * else AddOwner attaches, and a rule about that spread across several passes would
 * eventually disagree with itself.
 */
export function SenseHerd(
    registry : IRegistry,
    world : WorldStreamingResources,
    random : IRandomNumberGenerator,
    owner : Entity,
    herdOwner : HerdOwner,
    goal : HerdGoal,
    owns : Owns,
    threats : readonly ThreatReading[]
) : HerdContext | undefined {
    const members : HerdMember[] = []
    const membersByEntity = new Map<Entity, HerdMember>()

    // Cells sized to the query radius, as SpatialHashGrid asks for: smaller and each
    // bubble query walks a block of near-empty cells.
    const distanceQuerier = new SpatialHashGrid<Entity>(Math.max(herdOwner.BubbleRadius, 1))

    const centroid = new Position(0, 0)

    // Where everybody already is. Seeded during the gather rather than in a second pass,
    // so a member deciding where to go this tick can see the ground its neighbours are
    // standing on and route around it instead of into it.
    const occupiedTiles = new Set<string>()

    let totalFood = 0
    let totalWater = 0
    let totalSleep = 0
    let needsContributors = 0

    owns.entities.forEach((entity)=>{
        // Owns is documented as never pruning its entries, so a destroyed member is
        // expected here rather than a broken invariant. It also holds the glyphs of
        // a text label and anything else AddOwner attaches, so a live entry that
        // simply is not a herd animal -- no Position, no IsMoveable -- is normal too.
        if (!registry.IsAlive(entity)) return

        const currentPosition = registry.GetComponent(entity, Position)

        if (!currentPosition) return
        if (!registry.GetComponent(entity, IsMoveable)) return

        const existingTarget = registry.GetComponent(entity, TargetLocation)

        const heading = existingTarget
            ? getNormalizedDistanceVector(currentPosition, existingTarget.TargetLocation)
            : new Vector2D(0, 0)

        centroid.x += currentPosition.x
        centroid.y += currentPosition.y

        distanceQuerier.Insert(entity, currentPosition.x, currentPosition.y)

        occupiedTiles.add(TileKey(currentPosition.x, currentPosition.y))

        const needs = registry.GetComponent(entity, Needs)

        if (needs) {
            // Read through Get rather than off the field, so what a need is CALLED on the
            // component is the component's business.
            totalFood += needs.Get(NeedKind.Food)
            totalWater += needs.water
            totalSleep += needs.sleep
            needsContributors++
        }

        const member : HerdMember = {
            entity : entity,
            position : currentPosition,
            heading : heading,
            needs : needs,
            collecting : registry.GetComponent(entity, CollectingResource)
        }

        members.push(member)
        membersByEntity.set(entity, member)
    })

    if (members.length == 0) return undefined

    centroid.x /= members.length
    centroid.y /= members.length

    // Fully sated when nobody reported, which is what keeps a herd with no appetites
    // on the foraging path rather than the migrating one.
    const herdNeeds = (needsContributors > 0)
        ? {
            hungerUnits : totalFood / needsContributors,
            water : totalWater / needsContributors,
            sleep : totalSleep / needsContributors
        }
        : {hungerUnits : 1, water : 1, sleep : 1}

    const scarcestTravelNeed = (herdNeeds.water <= herdNeeds.hungerUnits) ? NeedKind.Water : NeedKind.Food

    // A sleeping herd is a less watchful one, so the radius it notices anything at all
    // within shrinks. Applied here, once, because the panic radius is derived from the
    // fear radius -- so scaling this scales both how far the herd leans away from
    // something and how close something has to get to wake it.
    const fearRadius = (goal.State === HerdState.Sleep)
        ? herdOwner.FearRadius * SleepingFearRadiusFraction
        : herdOwner.FearRadius

    const {threatsInRange, threatTotal} = ReadThreats(members, threats, fearRadius)
    const terrain = SampleSurroundingTerrain(world, random, centroid)

    return {
        owner : owner,
        herdOwner : herdOwner,
        goal : goal,
        previousState : goal.State,
        members : members,
        membersByEntity : membersByEntity,
        distanceQuerier : distanceQuerier,
        centroid : centroid,
        needs : herdNeeds,
        scarcestTravelNeed : scarcestTravelNeed,
        scarcestTravelLevel : Math.min(herdNeeds.water, herdNeeds.hungerUnits),
        threatsInRange : threatsInRange,
        threatTotal : threatTotal,
        isDisturbed : threatTotal > 0,
        terrainAvoidance : terrain.avoidance,
        nearestDrinkableWater : terrain.nearestDrinkableWater,
        nearestForage : terrain.nearestForage,
        claimedTiles : occupiedTiles
    }
}

/**
 * Which threats the herd can feel, and how alarmed it should be.
 *
 * Both measured from the NEAREST MEMBER rather than from the centroid. A herd is
 * not a point: something standing among the animals on one flank is a crisis for the
 * herd even when the average animal is comfortably far from it, and measuring from
 * the middle would have a large herd notice a predator only once it had walked into
 * the centre of the group.
 */
function ReadThreats(
    members : readonly HerdMember[], threats : readonly ThreatReading[], fearRadius : number
) : {threatsInRange : ThreatReading[], threatTotal : number} {
    const threatsInRange : ThreatReading[] = []
    const panicRadius = fearRadius * PanicRadiusFraction

    let threatTotal = 0

    threats.forEach((threat)=>{
        let nearestDistance = Number.POSITIVE_INFINITY

        members.forEach((member)=>{
            const distance = Math.hypot(
                member.position.x - threat.position.x, member.position.y - threat.position.y
            )

            if (distance < nearestDistance) nearestDistance = distance
        })

        if (nearestDistance < fearRadius) threatsInRange.push(threat)
        if (nearestDistance < panicRadius) threatTotal += threat.severity
    })

    return {threatsInRange : threatsInRange, threatTotal : threatTotal}
}

/**
 * One coarse reading of the ground around the herd: which way it is unwalkable, and
 * whether anything worth stopping for is in sight.
 *
 * Sampled once per HERD rather than once per member, and this is the point of the
 * whole function. Perlin noise varies gradually, so nine animals standing within a
 * few tiles of each other probing their own surroundings would be measuring the same
 * slope nine times over. One shared reading is both an order of magnitude cheaper
 * and the better behaviour: the herd flows around a mountain range as a body instead
 * of as nine animals each independently discovering it.
 *
 * The ring's starting angle is jittered every tick. Without that the herd would
 * re-read the same twelve points forever -- so a gap between two samples would be a
 * permanent blind spot rather than one the next tick covers.
 *
 * Two interleaved radii, alternating between samples, for no extra cost: a single
 * ring cannot tell ground that is unwalkable right here from ground that is
 * unwalkable ten tiles out, and those want different responses.
 */
function SampleSurroundingTerrain(
    world : WorldStreamingResources, random : IRandomNumberGenerator, centroid : Position
) : {avoidance : Vector2D, nearestDrinkableWater : Position | undefined, nearestForage : Position | undefined} {
    const avoidance = new Vector2D(0, 0)
    const startAngle = random.Random() * 2 * Math.PI

    let nearestDrinkableWater : Position | undefined = undefined
    let nearestWaterDistance = Number.POSITIVE_INFINITY
    let nearestForage : Position | undefined = undefined
    let nearestForageDistance = Number.POSITIVE_INFINITY

    for (let sample = 0; sample < TerrainSampleCount; sample++) {
        const angle = startAngle + (sample / TerrainSampleCount) * 2 * Math.PI
        const radius = TerrainSampleRadiusTiles * ((sample % 2 == 0) ? 0.55 : 1)

        const sampleX = Math.floor(centroid.x + Math.cos(angle) * radius)
        const sampleY = Math.floor(centroid.y + Math.sin(angle) * radius)

        if (!IsPassableTerrain(world, sampleX, sampleY)) {
            // Fades with distance for the same reason threat avoidance does: a cliff
            // underfoot is urgent and one on the horizon is a suggestion. Normalizing
            // instead would have the herd swerve as hard from a distant range as from
            // the water at its feet.
            const strength = 1 - radius / TerrainSampleRadiusTiles + 0.15

            avoidance.x += (centroid.x - sampleX) / radius * strength
            avoidance.y += (centroid.y - sampleY) / radius * strength

            // Unwalkable ground is never also a resource, so nothing below applies.
            continue
        }

        if (radius < nearestWaterDistance && IsDrinkableWater(world, sampleX, sampleY)) {
            nearestDrinkableWater = new Position(sampleX, sampleY)
            nearestWaterDistance = radius
        }

        if (radius < nearestForageDistance && IsForageGround(world, sampleX, sampleY)) {
            nearestForage = new Position(sampleX, sampleY)
            nearestForageDistance = radius
        }
    }

    return {
        // Clamped to a unit vector, so the per-state terrain weight is the only thing
        // setting this term's strength.
        //
        // Unclamped, the push scaled with how many of the twelve samples happened to be
        // blocked: a herd facing open country felt a nudge, and a herd facing a mountain
        // range felt six times the weight of every other term combined. That is what
        // pinned herds in place a few tiles short of a mountain -- not a standoff between
        // terrain and the goal, but terrain winning by an order of magnitude and the
        // herd's own steering being unable to slide it sideways along the face.
        avoidance : clampMagnitude(avoidance, 1),
        nearestDrinkableWater : nearestDrinkableWater,
        nearestForage : nearestForage
    }
}
