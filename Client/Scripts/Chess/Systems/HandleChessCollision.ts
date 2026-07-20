import { GameCollisionEvent } from "../Contracts/GameCollisionEvent.ts";
import { IsChessPiece } from "../Contracts/IsChessPiece.ts";
import { Representation } from "../Contracts/Representation.ts";
import { UnitDestroyedEvent } from "../Contracts/UnitDestroyedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleChessCollision (registry : IRegistry, eventQueue : IEventQueue) {
    const collisions = eventQueue.GetEventsOfType(GameCollisionEvent)

    if (collisions.length == 0) return

    collisions.forEach((collision)=>{
        if (!registry.GetComponent(collision.collidedEntity, IsChessPiece) && !registry.GetComponent(collision.collidingEntity, IsChessPiece)) return
        
        const unitType = registry.GetComponent(collision.collidedEntity, Representation)
        if (!unitType) throw new Error(`Representation is undefined!`)

        eventQueue.EnqueueEvent(new UnitDestroyedEvent(unitType.model, unitType.color))
        registry.DestroyEntity(collision.collidedEntity)
    })
}