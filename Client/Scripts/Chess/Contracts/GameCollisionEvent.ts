import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import type { Entity } from "./Entity.ts";

export class GameCollisionEvent implements IGameEvent {
    readonly type = "CollisionEvent";
    constructor(public collidingEntity : Entity, public collidedEntity : Entity) {} 
}