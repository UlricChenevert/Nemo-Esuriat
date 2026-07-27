/****************************************/
//
//     SpatialHashGrid
//
/****************************************/

/** An item's last known position, plus the key of the cell it currently sits in. */
interface GridEntry {
    x : number
    y : number
    cellKey : string
}

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
export class SpatialHashGrid<T> {
    private _cells = new Map<string, Set<T>>()
    private _entries = new Map<T, GridEntry>()

    constructor (private _cellSize : number) {
        if (!Number.isFinite(_cellSize) || _cellSize <= 0) {
            throw new RangeError(`Cell size must be a positive finite number, got ${_cellSize}.`)
        }
    }

    /** The edge length of one cell, in world units. */
    get CellSize() : number {
        return this._cellSize
    }

    /** How many items the grid currently holds. */
    get Size() : number {
        return this._entries.size
    }

    /**
     * Adds `item` at (x, y). Re-inserting an item already in the grid moves it
     * instead of duplicating it, since identity is the item's only key.
     */
    Insert(item : T, x : number, y : number) : this {
        return this.Move(item, x, y)
    }

    /**
     * Updates `item`'s position, inserting it if absent. Only touches the cell
     * Sets when the move actually crosses a cell boundary — the common case for
     * a per-frame update is a small step that stays put.
     */
    Move(item : T, x : number, y : number) : this {
        const cellKey = this._CellKey(this._CellIndex(x), this._CellIndex(y))
        const existing = this._entries.get(item)

        if (existing) {
            if (existing.cellKey === cellKey) {
                existing.x = x
                existing.y = y

                return this
            }

            this._DetachFromCell(item, existing.cellKey)
        }

        this._entries.set(item, {x, y, cellKey})
        this._AttachToCell(item, cellKey)

        return this
    }

    /** Removes `item`. Returns false if it was not in the grid. */
    Remove(item : T) : boolean {
        const entry = this._entries.get(item)

        if (!entry) return false

        this._DetachFromCell(item, entry.cellKey)
        this._entries.delete(item)

        return true
    }

    Has(item : T) : boolean {
        return this._entries.has(item)
    }

    /** A copy of `item`'s stored position, so callers cannot corrupt the index by mutating it. */
    GetPosition(item : T) : {x : number, y : number} | undefined {
        const entry = this._entries.get(item)

        return entry ? {x: entry.x, y: entry.y} : undefined
    }

    Clear() : void {
        this._cells.clear()
        this._entries.clear()
    }

    /**
     * Every item whose position falls inside the axis-aligned rectangle,
     * inclusive on all four edges. The corners may be given in any order.
     */
    QueryRectangle(minX : number, minY : number, maxX : number, maxY : number) : T[] {
        const found : T[] = []

        this.ForEachInRectangle(minX, minY, maxX, maxY, (item) => {found.push(item)})

        return found
    }

    /** Every item within `radius` of (x, y), measured exactly rather than by cell overlap. */
    QueryRadius(x : number, y : number, radius : number) : T[] {
        const found : T[] = []

        this.ForEachInRadius(x, y, radius, (item) => {found.push(item)})

        return found
    }

    /**
     * Visits each item inside the rectangle. Prefer QueryRectangle when the body
     * will insert, move, or remove items: this walks the cell Sets live, and
     * mutating the grid mid-traversal can visit an item twice or skip it.
     */
    ForEachInRectangle(
        minX : number, minY : number, maxX : number, maxY : number,
        callback : (item : T, x : number, y : number) => void
    ) : void {
        const lowX = Math.min(minX, maxX)
        const lowY = Math.min(minY, maxY)
        const highX = Math.max(minX, maxX)
        const highY = Math.max(minY, maxY)

        const startCellX = this._CellIndex(lowX)
        const startCellY = this._CellIndex(lowY)
        const endCellX = this._CellIndex(highX)
        const endCellY = this._CellIndex(highY)

        for (let cellX = startCellX; cellX <= endCellX; cellX++) {
            for (let cellY = startCellY; cellY <= endCellY; cellY++) {
                const cell = this._cells.get(this._CellKey(cellX, cellY))

                if (!cell) continue

                // The border cells extend past the rectangle, so every candidate
                // still needs the exact bounds test.
                cell.forEach((item) => {
                    const entry = this._entries.get(item)

                    if (!entry) return
                    if (entry.x < lowX || entry.x > highX || entry.y < lowY || entry.y > highY) return

                    callback(item, entry.x, entry.y)
                })
            }
        }
    }

    /** Visits each item within `radius` of (x, y). Same mutation caveat as ForEachInRectangle. */
    ForEachInRadius(
        x : number, y : number, radius : number,
        callback : (item : T, itemX : number, itemY : number) => void
    ) : void {
        if (!(radius >= 0)) return

        // Compare squared distances so the per-candidate test avoids a sqrt.
        const radiusSquared = radius * radius

        this.ForEachInRectangle(x - radius, y - radius, x + radius, y + radius, (item, itemX, itemY) => {
            const deltaX = itemX - x
            const deltaY = itemY - y

            if (deltaX * deltaX + deltaY * deltaY > radiusSquared) return

            callback(item, itemX, itemY)
        })
    }

    /** Visits every item in the grid, in no particular spatial order. */
    ForEach(callback : (item : T, x : number, y : number) => void) : void {
        this._entries.forEach((entry, item) => {callback(item, entry.x, entry.y)})
    }

    private _CellIndex(value : number) : number {
        return Math.floor(value / this._cellSize)
    }

    private _CellKey(cellX : number, cellY : number) : string {
        return `${cellX},${cellY}`
    }

    private _AttachToCell(item : T, cellKey : string) : void {
        const cell = this._cells.get(cellKey)

        if (cell) {
            cell.add(item)
            return
        }

        this._cells.set(cellKey, new Set<T>([item]))
    }

    private _DetachFromCell(item : T, cellKey : string) : void {
        const cell = this._cells.get(cellKey)

        if (!cell) return

        cell.delete(item)

        // Drop emptied cells, otherwise a herd wandering across the world leaves
        // a permanent trail of empty Sets behind it.
        if (cell.size === 0) this._cells.delete(cellKey)
    }
}
