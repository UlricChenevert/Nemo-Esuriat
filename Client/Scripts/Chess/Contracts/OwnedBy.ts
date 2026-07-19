import type { Entity } from "./Entity.ts";

export class OwnedBy {
    constructor (public owner : Entity) {}
}