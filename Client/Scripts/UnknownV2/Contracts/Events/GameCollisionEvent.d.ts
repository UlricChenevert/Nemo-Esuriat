import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import type { Entity } from "../Components/Entity.ts";
export declare class GameCollisionEvent implements IGameEvent {
    collidingEntity: Entity;
    collidedEntity: Entity;
    readonly type = "CollisionEvent";
    constructor(collidingEntity: Entity, collidedEntity: Entity);
}
//# sourceMappingURL=GameCollisionEvent.d.ts.map