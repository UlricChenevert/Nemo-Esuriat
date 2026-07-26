/**
 * Which terrain chunk an entity is, in chunk space rather than tile space.
 *
 * Doubles as the marker identifying an entity as a terrain chunk, so the
 * streaming system can find exactly the chunks without sweeping up every other
 * entity that happens to carry a MultiTileRepresentation.
 */
export declare class ChunkCoordinate {
    chunkX: number;
    chunkY: number;
    constructor(chunkX: number, chunkY: number);
}
/** Stable string form of a chunk coordinate, for use as a map or storage key. */
export declare function ChunkCoordinateKey(chunkX: number, chunkY: number): string;
//# sourceMappingURL=ChunkCoordinate.d.ts.map