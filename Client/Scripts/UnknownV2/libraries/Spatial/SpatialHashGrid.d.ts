/****************************************/
/****************************************/
/**
 * A uniform spatial hash: buckets points into fixed-size square cells so that
 * "what is near here" costs O(cells overlapped) instead of O(all items).
 *
 * The grid is sparse — only non-empty cells exist as Map entries — so the world
 * does not need finite bounds and negative coordinates cost nothing. Cell keys
 * are strings rather than packed integers because a packed key would have to cap
 * the coordinate range, and the world is streamed in chunks without a fixed extent.
 *
 * Items are keyed by identity (Map/Set semantics), so T must be a primitive or a
 * stable object reference. Entity handles are plain numbers, which satisfies this.
 *
 * Positions are stored alongside each item, which is what lets Move relocate an
 * item without the caller re-supplying its old position, and lets QueryRadius
 * return an exact circle rather than the overlapped cells' bounding box.
 *
 * Choosing _cellSize: aim for roughly the typical query radius. Much smaller and
 * a query walks many near-empty cells; much larger and each cell holds items far
 * outside the query that must be distance-tested and discarded.
 */
export declare class SpatialHashGrid<T> {
    private _cellSize;
    private _cells;
    private _entries;
    constructor(_cellSize: number);
    /** The edge length of one cell, in world units. */
    get CellSize(): number;
    /** How many items the grid currently holds. */
    get Size(): number;
    /**
     * Adds `item` at (x, y). Re-inserting an item already in the grid moves it
     * instead of duplicating it, since identity is the item's only key.
     */
    Insert(item: T, x: number, y: number): this;
    /**
     * Updates `item`'s position, inserting it if absent. Only touches the cell
     * Sets when the move actually crosses a cell boundary — the common case for
     * a per-frame update is a small step that stays put.
     */
    Move(item: T, x: number, y: number): this;
    /** Removes `item`. Returns false if it was not in the grid. */
    Remove(item: T): boolean;
    Has(item: T): boolean;
    /** A copy of `item`'s stored position, so callers cannot corrupt the index by mutating it. */
    GetPosition(item: T): {
        x: number;
        y: number;
    } | undefined;
    Clear(): void;
    /**
     * Every item whose position falls inside the axis-aligned rectangle,
     * inclusive on all four edges. The corners may be given in any order.
     */
    QueryRectangle(minX: number, minY: number, maxX: number, maxY: number): T[];
    /** Every item within `radius` of (x, y), measured exactly rather than by cell overlap. */
    QueryRadius(x: number, y: number, radius: number): T[];
    /**
     * Visits each item inside the rectangle. Prefer QueryRectangle when the body
     * will insert, move, or remove items: this walks the cell Sets live, and
     * mutating the grid mid-traversal can visit an item twice or skip it.
     */
    ForEachInRectangle(minX: number, minY: number, maxX: number, maxY: number, callback: (item: T, x: number, y: number) => void): void;
    /** Visits each item within `radius` of (x, y). Same mutation caveat as ForEachInRectangle. */
    ForEachInRadius(x: number, y: number, radius: number, callback: (item: T, itemX: number, itemY: number) => void): void;
    /** Visits every item in the grid, in no particular spatial order. */
    ForEach(callback: (item: T, x: number, y: number) => void): void;
    private _CellIndex;
    private _CellKey;
    private _AttachToCell;
    private _DetachFromCell;
}
//# sourceMappingURL=SpatialHashGrid.d.ts.map