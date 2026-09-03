import { ChunkGridWidth, ChunkWidth, RecentChunkCacheSize } from "../Configuration/WorldConstants.ts";
import { ChunkCoordinate, ChunkCoordinateKey } from "../Contracts/Components/ChunkCoordinate.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";
import { FindCameraPosition } from "../Utilities/CameraUtilities.ts";
import { GenerateChunk } from "../Utilities/TerrainUtilities.ts";

/** How far the buffer extends from the centre chunk, in chunks. */
const ChunkRadius = Math.floor(ChunkGridWidth / 2)

/**
 * Keeps a square of terrain chunks loaded around the viewport, creating chunks
 * that come into range and destroying those that leave.
 *
 * This reconciles the loaded set against the desired set rather than shifting a
 * grid by one step at a time, which is how the original game did it. That
 * version needed a separate branch per direction plus a fallback for teleports,
 * and its two branches each read from the unshifted buffer, so moving diagonally
 * silently dropped one of the two shifts. Reconciliation has no directional
 * cases at all: startup, a single step, a diagonal step, and a jump across the
 * map are all just "which chunks are missing, and which are no longer wanted".
 *
 * Finds the camera itself rather than being handed one. It runs every frame and
 * the camera is an ordinary entity, so a parameter would only be the same lookup
 * moved to the call site -- and one more thing GameLoop has to thread through.
 */
export function StreamChunks (registry : IRegistry, world : WorldStreamingResources) {
    // Before the early-out, not after: on the frames this system does nothing,
    // it has still loaded no chunks, and leaving the previous tick's list
    // standing would have PopulateHerds populate the same ground again.
    world.chunksLoadedThisTick.length = 0

    // Centred on the viewport rather than the player, because the camera is free
    // to pan away from them. Loading around the player instead would leave the
    // panned-to part of the world blank -- and with a 3x3 buffer of 50-tile
    // chunks against a 100-tile viewport, that shows up within one screen of
    // panning.
    //
    // The camera's position IS the view centre, so there is no half-viewport
    // arithmetic to get wrong here.
    const cameraPosition = FindCameraPosition(registry)

    // No camera means no view to load terrain around. Terrain is regenerated
    // from the seed on demand, so nothing is lost by waiting for one.
    if (cameraPosition === undefined) return

    // Math.floor rather than truncation, so world x = -1 is chunk -1 rather than
    // sharing chunk 0 with x = 1 and making the origin chunk twice as wide.
    const centerChunkX = Math.floor(cameraPosition.x / ChunkWidth)
    const centerChunkY = Math.floor(cameraPosition.y / ChunkWidth)

    // The camera stays inside one chunk for tens of frames at a time, so this
    // early-out is what keeps streaming off the per-frame cost sheet.
    if (centerChunkX === world.lastCenterChunkX && centerChunkY === world.lastCenterChunkY) return

    const liveChunks = new Map<string, Entity>()
    registry.ForEachEntityWith([ChunkCoordinate], (entity, chunkCoordinate) => {
        liveChunks.set(ChunkCoordinateKey(chunkCoordinate.chunkX, chunkCoordinate.chunkY), entity)
    })

    const desiredKeys = new Set<string>()

    for (let offsetY = -ChunkRadius; offsetY <= ChunkRadius; offsetY++) {
        for (let offsetX = -ChunkRadius; offsetX <= ChunkRadius; offsetX++) {
            const chunkX = centerChunkX + offsetX
            const chunkY = centerChunkY + offsetY
            const key = ChunkCoordinateKey(chunkX, chunkY)

            desiredKeys.add(key)

            if (liveChunks.has(key)) continue

            world.chunksLoadedThisTick.push(CreateChunkEntity(registry, world, chunkX, chunkY, key))
        }
    }

    liveChunks.forEach((entity, key) => {
        if (desiredKeys.has(key)) return

        RetireChunkEntity(registry, world, entity, key)
    })

    world.lastCenterChunkX = centerChunkX
    world.lastCenterChunkY = centerChunkY
}

/**
 * Brings one chunk into the world, generating its terrain only if the cache does
 * not already have it.
 *
 * What a chunk entity is made of lives in EntityBuilder.MakeTerrainChunk; this
 * only decides that one should exist and where its tiles come from.
 */
function CreateChunkEntity (registry : IRegistry, world : WorldStreamingResources, chunkX : number, chunkY : number, key : string) : Entity {
    const cached = world.recentChunkCache.get(key)

    if (cached !== undefined) world.recentChunkCache.delete(key)

    const terrain = cached ?? GenerateChunk(chunkX, chunkY, world.noiseGenerator)

    return new EntityBuilder(registry)
        .MakeTerrainChunk(chunkX, chunkY, terrain)
        .GetEntity()
}

function RetireChunkEntity (registry : IRegistry, world : WorldStreamingResources, entity : Entity, key : string) {
    const terrain = registry.GetComponent(entity, MultiTileRepresentation)

    if (terrain !== undefined) CacheChunk(world, key, terrain)

    registry.DestroyEntity(entity)
}

/**
 * Holds a chunk in a bounded cache so re-entering it does not regenerate it.
 *
 * This is what replaces the original game's render-border hysteresis. A player
 * pacing back and forth across a chunk edge would otherwise rebuild three chunks
 * per step; here the return trip is a map lookup. Unlike hysteresis, it also
 * covers walking well away and coming back.
 */
function CacheChunk (world : WorldStreamingResources, key : string, terrain : MultiTileRepresentation) {
    // Re-inserting moves the key to the end, so Map iteration order doubles as
    // least-recently-used order.
    world.recentChunkCache.delete(key)
    world.recentChunkCache.set(key, terrain)

    while (world.recentChunkCache.size > RecentChunkCacheSize) {
        const oldestKey = world.recentChunkCache.keys().next().value

        if (oldestKey === undefined) break

        world.recentChunkCache.delete(oldestKey)
    }
}
