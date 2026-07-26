/**
 * A rectangle of glyphs drawn by a single entity, anchored at the entity's
 * Position (its world-space top-left corner) and drawn at its Layer.
 *
 * Deliberately not terrain-specific. Anything that occupies a block of tiles and
 * moves as a unit — a building, a UI panel, a sprite — can use it.
 *
 * Tiles are stored as byte indices into a shared palette rather than as
 * Representation objects. A 50x50 chunk holds 2500 tiles, and nine chunks are
 * loaded at once: the object form would allocate tens of thousands of
 * Representation and Color instances to describe a handful of distinct glyphs.
 * The indexed form is one 2500-byte array per chunk plus one shared palette.
 */
export class MultiTileRepresentation {
    width;
    height;
    paletteIndices;
    palette;
    constructor(width, height, 
    /** Row-major, length width * height. Each byte is an index into palette. */
    paletteIndices, 
    /** Shared across every instance using the same tile set. Must not be mutated. */
    palette) {
        this.width = width;
        this.height = height;
        this.paletteIndices = paletteIndices;
        this.palette = palette;
    }
}
//# sourceMappingURL=MultiTileRepresentation.js.map