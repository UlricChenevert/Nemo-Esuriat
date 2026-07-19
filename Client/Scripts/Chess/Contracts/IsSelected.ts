import type { Entity } from "./Entity";

export class IsSelected {
    constructor(public target : Entity, public source : Entity) {}
}