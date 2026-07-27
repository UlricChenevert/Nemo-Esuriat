import { BackgroundLayer } from "../Configuration/DisplayConstants.js";
import { ChunkGridWidth, ChunkWidth, RecentChunkCacheSize } from "../Configuration/WorldConstants.js";
import { ChunkCoordinate, ChunkCoordinateKey } from "../Contracts/Components/ChunkCoordinate.js";
import { Layer } from "../Contracts/Components/Layer.js";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.js";
import { Position } from "../Contracts/Components/Position.js";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.js";
import { GenerateChunk } from "./GenerateChunk.js";
import { GameWidth } from "../Configuration/GameConstants.js";
/** How far the buffer extends from the centre chunk, in chunks. */
const ChunkRadius = Math.floor(ChunkGridWidth / 2);
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
 */
export function StreamChunks(registry, world, camera) {
    // Centred on the viewport rather than the player, because the camera is free
    // to pan away from them. Loading around the player instead would leave the
    // panned-to part of the world blank -- and with a 3x3 buffer of 50-tile
    // chunks against a 100-tile viewport, that shows up within one screen of
    // panning.
    const centerX = camera.worldOriginX + GameWidth / 2;
    const centerY = camera.worldOriginY + GameWidth / 2;
    // Math.floor rather than truncation, so world x = -1 is chunk -1 rather than
    // sharing chunk 0 with x = 1 and making the origin chunk twice as wide.
    const centerChunkX = Math.floor(centerX / ChunkWidth);
    const centerChunkY = Math.floor(centerY / ChunkWidth);
    // The camera stays inside one chunk for tens of frames at a time, so this
    // early-out is what keeps streaming off the per-frame cost sheet.
    if (centerChunkX === world.lastCenterChunkX && centerChunkY === world.lastCenterChunkY)
        return;
    const liveChunks = new Map();
    registry.ForEachEntityWith([ChunkCoordinate], (entity, chunkCoordinate) => {
        liveChunks.set(ChunkCoordinateKey(chunkCoordinate.chunkX, chunkCoordinate.chunkY), entity);
    });
    const desiredKeys = new Set();
    for (let offsetY = -ChunkRadius; offsetY <= ChunkRadius; offsetY++) {
        for (let offsetX = -ChunkRadius; offsetX <= ChunkRadius; offsetX++) {
            const chunkX = centerChunkX + offsetX;
            const chunkY = centerChunkY + offsetY;
            const key = ChunkCoordinateKey(chunkX, chunkY);
            desiredKeys.add(key);
            if (liveChunks.has(key))
                continue;
            CreateChunkEntity(registry, world, chunkX, chunkY, key);
        }
    }
    liveChunks.forEach((entity, key) => {
        if (desiredKeys.has(key))
            return;
        RetireChunkEntity(registry, world, entity, key);
    });
    world.lastCenterChunkX = centerChunkX;
    world.lastCenterChunkY = centerChunkY;
}
function CreateChunkEntity(registry, world, chunkX, chunkY, key) {
    const cached = world.recentChunkCache.get(key);
    if (cached !== undefined)
        world.recentChunkCache.delete(key);
    const terrain = cached ?? GenerateChunk(chunkX, chunkY, world.noiseGenerator);
    new EntityBuilder(registry)
        .AddPosition(new Position(chunkX * ChunkWidth, chunkY * ChunkWidth))
        .AddLayer(new Layer(BackgroundLayer))
        .AddMultiTileRepresentation(terrain)
        .AddChunkCoordinate(new ChunkCoordinate(chunkX, chunkY));
}
function RetireChunkEntity(registry, world, entity, key) {
    const terrain = registry.GetComponent(entity, MultiTileRepresentation);
    if (terrain !== undefined)
        CacheChunk(world, key, terrain);
    registry.DestroyEntity(entity);
}
/**
 * Holds a chunk in a bounded cache so re-entering it does not regenerate it.
 *
 * This is what replaces the original game's render-border hysteresis. A player
 * pacing back and forth across a chunk edge would otherwise rebuild three chunks
 * per step; here the return trip is a map lookup. Unlike hysteresis, it also
 * covers walking well away and coming back.
 */
function CacheChunk(world, key, terrain) {
    // Re-inserting moves the key to the end, so Map iteration order doubles as
    // least-recently-used order.
    world.recentChunkCache.delete(key);
    world.recentChunkCache.set(key, terrain);
    while (world.recentChunkCache.size > RecentChunkCacheSize) {
        const oldestKey = world.recentChunkCache.keys().next().value;
        if (oldestKey === undefined)
            break;
        world.recentChunkCache.delete(oldestKey);
    }
}
//# sourceMappingURL=StreamChunks.js.map