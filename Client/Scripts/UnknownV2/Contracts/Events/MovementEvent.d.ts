import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import type { Entity } from "./../Components/Entity.ts";
import type { Position } from "../Components/Position.ts";
export declare class GameMovementEvent implements IGameEvent {
    ControllingEntity: Entity;
    MovingEntity: Entity;
    OldPosition: Position;
    NewPosition: Position;
    readonly type = "MovementEvent";
    constructor(ControllingEntity: Entity, MovingEntity: Entity, OldPosition: Position, NewPosition: Position);
}
//# sourceMappingURL=MovementEvent.d.ts.map