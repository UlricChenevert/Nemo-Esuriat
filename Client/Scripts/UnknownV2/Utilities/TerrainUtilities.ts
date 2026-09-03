import { TerrainBands, TerrainKind, TerrainPalette, TerrainShadeCount, TerrainThresholds } from "../Configuration/DisplayConstants.ts";
import { ChunkWidth } from "../Configuration/WorldConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Position } from "../Contracts/Components/Position.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * The terrain a noise value produces.
 *
 * Comparisons are strictly greater-than, matching the original game: a value of
 * exactly 0.6 is a Hill, not a Mountain. The boundaries are covered by test so
 * this cannot drift silently.
 */
export function BandNoiseToTerrain (noise : number) : number {
    if (noise > TerrainThresholds.Mountain) return TerrainKind.Mountain
    if (noise > TerrainThresholds.Hill) return TerrainKind.Hill
    if (noise > TerrainThresholds.Grassland) return TerrainKind.Grass

    return TerrainKind.Water
}

/**
 * The shaded palette entry a noise value produces: its terrain kind, plus how
 * bright that tile is within the kind's band.
 *
 * This is what keeps the height the noise field already computed instead of
 * discarding everything except which bucket it landed in. A tile near the bottom
 * of its band draws dark and one near the top draws light, so slopes read as
 * slopes rather than as flat colour.
 *
 * The kind still comes from BandNoiseToTerrain, so glyphs and terrain boundaries
 * are unchanged — only the colour within a band is new.
 */
export function ShadeNoiseToPaletteIndex (noise : number) : number {
    const kind = BandNoiseToTerrain(noise)
    const band = TerrainBands[kind]!

    // Clamped rather than trusted: the noise generator promises [0, 1], but a
    // value sitting exactly on a bound (or a fixed-value generator in a test)
    // would otherwise round up into the next band's shades and draw a mountain
    // colour on a hill glyph.
    const position = (noise - band.lowerBound) / (band.upperBound - band.lowerBound)
    const shade = Math.max(0, Math.min(TerrainShadeCount - 1, Math.floor(position * TerrainShadeCount)))

    return kind * TerrainShadeCount + shade
}

/**
 * Builds one chunk of terrain by sampling the noise field.
 *
 * Pure and synchronous: no registry, no storage, no promises. Because it depends
 * only on the chunk coordinate and the noise field, the same inputs always
 * produce the same chunk — which is what lets the world be regenerated on demand
 * instead of stored, and what lets TerrainKindAtWorldTile below answer for
 * ground no chunk currently covers.
 *
 * Taking INoiseGenerator rather than constructing the noise itself is what
 * allows tests to feed exact values and assert the banding directly.
 *
 * A utility rather than a system: it touches no registry and runs on no
 * schedule. StreamChunks decides *when* a chunk exists; this only says what one
 * looks like.
 *
 * The original game wrapped this work in a Promise. That moved nothing off the
 * main thread; it only deferred completion to a microtask, which is why chunks
 * appeared a frame after the player crossed into them. A chunk is a few thousand
 * allocation-free samples, so it runs well inside a frame budget. If that ever
 * stops being true, the fix is to generate a bounded number of chunks per frame,
 * not to make this asynchronous.
 */
export function GenerateChunk (chunkX : number, chunkY : number, noiseGenerator : INoiseGenerator) : MultiTileRepresentation {
    const paletteIndices = new Uint8Array(ChunkWidth * ChunkWidth)

    const worldOriginX = chunkX * ChunkWidth
    const worldOriginY = chunkY * ChunkWidth

    for (let localY = 0; localY < ChunkWidth; localY++) {
        const rowOffset = localY * ChunkWidth

        for (let localX = 0; localX < ChunkWidth; localX++) {
            // Sampling in world space, not chunk-local space, is what makes
            // neighbouring chunks line up with no seam at their shared edge.
            const noise = noiseGenerator.GetNoise(worldOriginX + localX, worldOriginY + localY)

            paletteIndices[rowOffset + localX] = ShadeNoiseToPaletteIndex(noise)
        }
    }

    return new MultiTileRepresentation(ChunkWidth, ChunkWidth, paletteIndices, TerrainPalette)
}

/**
 * The TerrainKind at a world tile.
 *
 * Sampled from the noise field rather than read out of a loaded chunk, so it is
 * defined everywhere. Only a 5x5 square of chunks is resident at a time and
 * herds deliberately outlive the ground they were spawned on, so an entity
 * asking what it is standing on is routinely standing on terrain no chunk
 * covers — a chunk lookup would have to answer "unknown" for exactly the
 * entities most likely to ask.
 *
 * It runs through the same BandNoiseToTerrain that GenerateChunk bands with, so
 * this can never disagree with what was drawn.
 */
export function TerrainKindAtWorldTile (world : WorldStreamingResources, worldX : number, worldY : number) : number {
    return BandNoiseToTerrain(TerrainNoiseAtWorldTile(world, worldX, worldY))
}

/**
 * The raw noise height at a world tile, on [0, 1].
 *
 * The primitive underneath every other question about a tile. Exposed because the
 * terrain rules the herd AI cares about are not all band boundaries -- how deep
 * water is, for one, is a threshold inside a band -- and a caller that had to go
 * through TerrainKindAtWorldTile would be handed an answer with the height
 * already thrown away.
 *
 * Floored to match GenerateChunk, which samples on whole world coordinates.
 * Positions are continuous once an entity is mid-step, and sampling at x = 10.4
 * returns a different noise value than the tile drawn at x = 10 -- so an animal
 * could read "water" while standing on a grass glyph.
 */
export function TerrainNoiseAtWorldTile (world : WorldStreamingResources, worldX : number, worldY : number) : number {
    return world.noiseGenerator.GetNoise(Math.floor(worldX), Math.floor(worldY))
}

/**
 * The TerrainKind under an entity, or undefined when it has no Position.
 *
 * The answer to "what am I standing on" for any entity in the world, whether or
 * not its ground is loaded and whether or not it is on screen.
 */
export function TerrainKindOfEntity (registry : IRegistry, world : WorldStreamingResources, entity : Entity) : number | undefined {
    const position = registry.GetComponent(entity, Position)

    if (position === undefined) return undefined

    return TerrainKindAtWorldTile(world, position.x, position.y)
}

/****************************************/
//
//     What ground an animal can use
//
/****************************************/

/**
 * Whether a land animal can stand on a world tile.
 *
 * Mountains are too steep and open water is too deep; everything between is fair
 * ground, INCLUDING the shallow water at the top of the water band. That
 * inclusion is deliberate rather than incidental -- an animal drinks by standing
 * in water, so a rule that made all water impassable would make drinking
 * impossible.
 *
 * Expressed against TerrainThresholds rather than against the drawn palette. The
 * thresholds are already the single source of truth for where terrain changes, and
 * deriving passability from a colour would mean every retint of the world silently
 * redrew the map of where animals may walk.
 */
export function IsPassableTerrain (world : WorldStreamingResources, worldX : number, worldY : number) : boolean {
    const noise = TerrainNoiseAtWorldTile(world, worldX, worldY)

    return noise > TerrainThresholds.Ocean && noise <= TerrainThresholds.Mountain
}

/**
 * Whether a world tile holds water shallow enough to drink from.
 *
 * The wadeable shore between the ocean floor and the grass line. Both bounds
 * matter: without the lower one a thirsty herd walks into the deep and drowns its
 * way across an ocean, and without the upper one it stops to drink on dry land.
 */
export function IsDrinkableWater (world : WorldStreamingResources, worldX : number, worldY : number) : boolean {
    const noise = TerrainNoiseAtWorldTile(world, worldX, worldY)

    return noise > TerrainThresholds.Ocean && noise <= TerrainThresholds.Grassland
}

/**
 * Whether a world tile holds something worth grazing.
 *
 * Grass only. Hills are passable but bare -- a herd crosses them to get
 * somewhere, it does not feed on them.
 */
export function IsForageGround (world : WorldStreamingResources, worldX : number, worldY : number) : boolean {
    const noise = TerrainNoiseAtWorldTile(world, worldX, worldY)

    return noise > TerrainThresholds.Grassland && noise <= TerrainThresholds.Hill
}

/**
 * Whether a world tile is somewhere a herd should aim FOR, as opposed to somewhere
 * it merely can walk.
 *
 * Grass and wadeable water only. Hills are deliberately excluded even though they
 * are perfectly walkable, and that gap between "can cross" and "worth going to" is
 * the whole point of having a second predicate.
 *
 * A hill is bare ground with nothing on it to want -- no grazing, no water -- so a
 * destination on one is a journey to nowhere. Worse, hills are what surround
 * mountains: the noise field bands outward from a peak, so a target picked on a
 * hillside is usually a target picked against a mountain, and a herd that keeps
 * choosing those spends its life walking up to rock and turning around. Aiming only
 * at ground with a reason to be there routes herds along the valleys instead.
 */
export function IsHerdDestination (world : WorldStreamingResources, worldX : number, worldY : number) : boolean {
    return IsForageGround(world, worldX, worldY) || IsDrinkableWater(world, worldX, worldY)
}

/**
 * The nearest world tile satisfying `Matches`, searched outward in rings, or
 * undefined if the budget ran out first.
 *
 * Rings rather than a filled square so the first hit really is the nearest one and
 * the scan can stop the moment it finds anything. On a world that is roughly 15%
 * water, a herd looking for a drink typically finds one within a couple of rings --
 * tens of samples, not the thousands the maximum radius would suggest.
 *
 * Stepped coarsely on purpose. The noise field varies gradually, so a stride of a
 * few tiles cannot step over a lake; the most it can miss is the exact edge of
 * one, which the herd then walks to on its own.
 *
 * Two budgets, because they fail differently. `maxRadiusTiles` bounds how far the
 * herd is willing to believe a resource is worth walking to; `maxProbes` bounds
 * what the search may cost this frame regardless. A herd deep inside a mountain
 * range hits the second and gives up for now, which is the behaviour that keeps it
 * from stalling a frame every time it gets thirsty.
 */
export function FindNearestTile (
    world : WorldStreamingResources,
    fromX : number,
    fromY : number,
    Matches : (world : WorldStreamingResources, worldX : number, worldY : number) => boolean,
    stepTiles : number,
    maxRadiusTiles : number,
    maxProbes : number
) : Position | undefined {
    const originX = Math.floor(fromX)
    const originY = Math.floor(fromY)
    const step = Math.max(1, Math.floor(stepTiles))

    let probes = 0

    // The tile underfoot is ring zero, and it is checked first: a herd standing in
    // the water it wants has already arrived and must not be sent looking.
    if (Matches(world, originX, originY)) return new Position(originX, originY)

    probes++

    for (let radius = step; radius <= maxRadiusTiles; radius += step) {
        // Walking the ring's perimeter rather than its area is what makes this a
        // ring search. Stepping the offset by `step` keeps the sample spacing
        // along the perimeter the same as the spacing between rings, so the scan
        // has no direction it is blind in.
        for (let offset = -radius; offset <= radius; offset += step) {
            const candidates : [number, number][] = [
                [originX + offset, originY - radius],   // top edge
                [originX + offset, originY + radius],   // bottom edge
                [originX - radius, originY + offset],   // left edge
                [originX + radius, originY + offset]    // right edge
            ]

            for (const candidate of candidates) {
                const [candidateX, candidateY] = candidate

                if (probes >= maxProbes) return undefined

                probes++

                if (Matches(world, candidateX, candidateY)) return new Position(candidateX, candidateY)
            }
        }
    }

    return undefined
}
