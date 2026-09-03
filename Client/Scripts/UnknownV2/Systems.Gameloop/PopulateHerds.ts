import { CharacterRepresentation, TerrainKind, TerrainKindOfPaletteIndex } from "../Configuration/DisplayConstants.ts";
import {
    HerdPlacementAttempts, HerdSpawnChancePerChunk, MaxHerdSize, MaxLiveHerds, MinHerdSize
} from "../Configuration/WorldConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";
import { FindCameraPosition, ScreenTileOfWorldTile } from "../Utilities/CameraUtilities.ts";
import { IsOutsideViewport } from "../Utilities/PositionUtilities.ts";

/**
 * Populates freshly streamed terrain with herds of animals, and retires the
 * herds furthest from the viewport to keep the population bounded.
 *
 * Runs off StreamChunks' record of what it just loaded rather than scanning for
 * unpopulated chunks itself. That record is the only thing that distinguishes
 * ground the player has never seen from ground they are standing on: a chunk
 * entity carries no memory of having been rolled for, and re-deriving one would
 * mean tracking every chunk ever visited for the lifetime of the session.
 *
 * The herds it creates are ordinary herd owners, indistinguishable from one
 * placed by hand in Initialization. Nothing marks them as spawned, so nothing
 * needs to special-case them.
 */
export function PopulateHerds (
    registry : IRegistry, world : WorldStreamingResources, random : IRandomNumberGenerator
) {
    if (world.chunksLoadedThisTick.length == 0) return

    // StreamChunks only loads chunks when there is a camera, so an empty list is
    // the usual way this system sees a camera-less world. Checked anyway, since
    // nothing stops another system from filling that list.
    const cameraPosition = FindCameraPosition(registry)

    if (cameraPosition === undefined) return

    world.chunksLoadedThisTick.forEach((chunk)=>{
        if (random.Random() >= HerdSpawnChancePerChunk) return

        TrySpawnHerdInChunk(registry, chunk, cameraPosition, random)
    })

    // The camera's position IS the view centre, so distances are measured
    // straight from it.
    RetireDistantHerds(registry, cameraPosition.x, cameraPosition.y)
}

/**
 * Places one herd somewhere in `chunk`, or gives up.
 *
 * Giving up quietly is the normal case, not a failure: a chunk of open ocean has
 * nowhere for a land animal to stand, and one that scrolled onto the screen the
 * moment it loaded has nowhere a herd could appear without the player watching
 * it wink into existence.
 */
function TrySpawnHerdInChunk (registry : IRegistry, chunk : Entity, cameraPosition : Position, random : IRandomNumberGenerator) {
    const origin = registry.GetComponent(chunk, Position)
    const terrain = registry.GetComponent(chunk, MultiTileRepresentation)

    if (!origin || !terrain) return

    const spawn = FindLandTile(origin, terrain, random)

    if (!spawn) return
    if (IsWithinViewport(spawn, cameraPosition)) return

    const size = MinHerdSize + Math.floor(random.Random() * (MaxHerdSize - MinHerdSize + 1))

    new EntityBuilder(registry)
        // The owner is bodiless -- no Layer, no Representation, so nothing draws
        // it -- but it carries a Position anyway, as the anchor RetireDistantHerds
        // falls back to once a herd has lost every member.
        .AddPosition(spawn.Copy())
        .MakeHerd(spawn, size, CharacterRepresentation.Animal, random)
}

/**
 * A random tile in the chunk that is not water, or undefined if the sampling
 * budget ran out before finding one.
 *
 * Samples at random rather than scanning: on the ordinary chunk with a bit of
 * everything on it, the first or second try lands on land, and the scan would be
 * 2500 tiles of work to arrive at the same answer.
 *
 * Reads the chunk's own bytes rather than re-sampling the noise through
 * TerrainKindAtWorldTile. It is already holding the tile buffer, so the buffer
 * is the cheaper answer -- and both routes band the same noise, so they agree.
 */
function FindLandTile (origin : Position, terrain : MultiTileRepresentation, random : IRandomNumberGenerator) {
    for (let attempt = 0; attempt < HerdPlacementAttempts; attempt++) {
        const localX = Math.floor(random.Random() * terrain.width)
        const localY = Math.floor(random.Random() * terrain.height)

        const paletteIndex = terrain.paletteIndices[localY * terrain.width + localX]

        if (paletteIndex === undefined) continue

        // The palette packs a terrain kind and a brightness into one byte, so
        // the kind is what survives dividing the shades back out.
        if (TerrainKindOfPaletteIndex(paletteIndex) === TerrainKind.Water) continue

        return new Position(origin.x + localX, origin.y + localY)
    }

    return undefined
}

function IsWithinViewport (position : Position, cameraPosition : Position) {
    const { screenX, screenY } = ScreenTileOfWorldTile(cameraPosition, position.x, position.y)

    return !IsOutsideViewport(screenX, screenY)
}

/**
 * Destroys the herds furthest from the viewport until MaxLiveHerds remain.
 *
 * Distance decides it because the alternative -- retiring the oldest -- deletes
 * the herd the player has been following while leaving untouched ones they have
 * walked away from and will never see again.
 *
 * Unlike chunks, herds are not retired when the ground under them unloads. A
 * herd is a handful of entities where a chunk is 2500 tiles, and keeping them
 * lets the player walk back to animals they saw a moment ago rather than
 * finding freshly rolled ones. What bounds them is this cap, not the terrain.
 */
function RetireDistantHerds (registry : IRegistry, viewCenterX : number, viewCenterY : number) {
    const herds : {owner : Entity, distanceSquared : number}[] = []

    registry.ForEachEntityWith([HerdOwner, Owns], (owner, _, owns)=>{
        const anchor = HerdAnchor(registry, owner, owns)

        if (!anchor) return

        const deltaX = anchor.x - viewCenterX
        const deltaY = anchor.y - viewCenterY

        herds.push({owner: owner, distanceSquared: deltaX * deltaX + deltaY * deltaY})
    })

    if (herds.length <= MaxLiveHerds) return

    herds.sort((a, b) => b.distanceSquared - a.distanceSquared)

    // Destroying the owner takes its animals with it: DestroyEntity cascades
    // through Owns.
    herds.slice(0, herds.length - MaxLiveHerds).forEach((herd)=>{registry.DestroyEntity(herd.owner)})
}

/**
 * Where a herd currently is: the centroid of its live animals, falling back to
 * the owner's own Position.
 *
 * The centroid rather than the spawn anchor, because a herd roams a long way
 * from where it was placed and would otherwise be judged on ground it left
 * minutes ago.
 */
function HerdAnchor (registry : IRegistry, owner : Entity, owns : Owns) : Position | undefined {
    let totalX = 0
    let totalY = 0
    let count = 0

    owns.entities.forEach((member)=>{
        if (!registry.IsAlive(member)) return

        const position = registry.GetComponent(member, Position)

        if (!position) return

        totalX += position.x
        totalY += position.y
        count++
    })

    if (count == 0) return registry.GetComponent(owner, Position)

    return new Position(totalX / count, totalY / count)
}
