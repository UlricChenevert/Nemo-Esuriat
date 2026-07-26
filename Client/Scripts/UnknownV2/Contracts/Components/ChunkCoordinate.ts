/**
 * Which terrain chunk an entity is, in chunk space rather than tile space.
 *
 * Doubles as the marker identifying an entity as a terrain chunk, so the
 * streaming system can find exactly the chunks without sweeping up every other
 * entity that happens to carry a MultiTileRepresentation.
 */
export class ChunkCoordinate {
    constructor (public chunkX : number, public chunkY : number) {}
}

/** Stable string form of a chunk coordinate, for use as a map or storage key. */
export function ChunkCoordinateKey (chunkX : number, chunkY : number) : string {
    // Comma-separated rather than hyphen-separated so negative coordinates stay
    // unambiguous: "-1,-1" parses cleanly where "-1--1" does not.
    return `${chunkX},${chunkY}`
}
