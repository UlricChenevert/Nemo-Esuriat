/**
 * Which terrain chunk an entity is, in chunk space rather than tile space.
 *
 * Doubles as the marker identifying an entity as a terrain chunk, so the
 * streaming system can find exactly the chunks without sweeping up every other
 * entity that happens to carry a MultiTileRepresentation.
 */
export class ChunkCoordinate {
    chunkX;
    chunkY;
    constructor(chunkX, chunkY) {
        this.chunkX = chunkX;
        this.chunkY = chunkY;
    }
}
/** Stable string form of a chunk coordinate, for use as a map or storage key. */
export function ChunkCoordinateKey(chunkX, chunkY) {
    // Comma-separated rather than hyphen-separated so negative coordinates stay
    // unambiguous: "-1,-1" parses cleanly where "-1--1" does not.
    return `${chunkX},${chunkY}`;
}
//# sourceMappingURL=ChunkCoordinate.js.map