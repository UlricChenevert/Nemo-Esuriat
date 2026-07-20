import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import type { Entity } from "./Entity.ts";
import type { Position } from "./Position.ts";

export class GameMovementEvent implements IGameEvent {
    readonly type = "MovementEvent"

    constructor (public ControllingEntity : Entity, public MovingEntity : Entity, public OldPosition : Position, public NewPosition : Position) {}
    
}