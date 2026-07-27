/**
 * The owner's side of the ownership relation, mirroring OwnedBy on each child.
 * One owner may own many entities (a herd, the glyphs of a text label), so this
 * holds an array rather than a single handle.
 *
 * Entries are NOT pruned when a child is destroyed; consumers must treat the
 * contents as potentially stale and guard with IRegistry.IsAlive.
 */
export class Owns {
    entities;
    constructor(...entities) {
        this.entities = entities;
    }
    Add(entity) {
        this.entities.push(entity);
        return this;
    }
}
//# sourceMappingURL=Owns.js.map