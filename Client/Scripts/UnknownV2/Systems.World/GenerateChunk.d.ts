import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";
/**
 * The terrain a noise value produces.
 *
 * Comparisons are strictly greater-than, matching the original game: a value of
 * exactly 0.6 is a Hill, not a Mountain. The boundaries are covered by test so
 * this cannot drift silently.
 */
export declare function BandNoiseToTerrain(noise: number): number;
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
export declare function GenerateChunk(chunkX: number, chunkY: number, noiseGenerator: INoiseGenerator): MultiTileRepresentation;
//# sourceMappingURL=GenerateChunk.d.ts.map