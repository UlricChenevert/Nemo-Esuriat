import type { IGameEvent } from "../Interfaces/IGameEvent";
import type { Entity } from "./Entity";

export class GameCollisionEvent implements IGameEvent {
    readonly type = "CollisionEvent";
    constructor(public collidingEntity : Entity, public collidedEntity : Entity) {} 
}