import { TerrainBands, TerrainKind, TerrainPalette, TerrainShadeCount, TerrainThresholds } from "../Configuration/DisplayConstants.ts";
import { ChunkWidth } from "../Configuration/WorldConstants.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";

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
 * instead of stored.
 *
 * Taking INoiseGenerator rather than constructing the noise itself is what
 * allows tests to feed exact values and assert the banding directly.
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
