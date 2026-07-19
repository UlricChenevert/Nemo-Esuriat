import type { Entity } from "./Entity.ts";

// Attached directly to the entity that is selected. `source` is the player that
// made the selection (only that player may deselect it).
export class IsSelected {
    constructor(public source : Entity) {}
}