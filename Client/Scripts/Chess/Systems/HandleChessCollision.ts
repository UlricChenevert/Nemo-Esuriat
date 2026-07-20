import { GameCollisionEvent } from "../Contracts/GameCollisionEvent.ts";
import { IsChessPiece } from "../Contracts/IsChessPiece.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import { Representation } from "../Contracts/Representation.ts";
import { UnitDestroyedEvent } from "../Contracts/UnitDestroyedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleChessCollision (registry : IRegistry, eventQueue : IEventQueue) {
    const collisions = eventQueue.GetEventsOfType(GameCollisionEvent)

    if (collisions.length == 0) return

    // A collision event's colliding/collided naming follows registry iteration order,
    // not who moved. The mover is the capturer, so identify it from this frame's
    // movement events instead.
    const movedEntities = new Set(eventQueue.GetEventsOfType(GameMovementEvent).map((movement)=>movement.MovingEntity))

    collisions.forEach((collision)=>{
        if (!registry.GetComponent(collision.collidedEntity, IsChessPiece) || !registry.GetComponent(collision.collidingEntity, IsChessPiece)) return

        const collidedMoved = movedEntities.has(collision.collidedEntity)
        const collidingMoved = movedEntities.has(collision.collidingEntity)

        // Neither moved, or both did: no unambiguous capturer, so leave the board alone.
        if (collidedMoved == collidingMoved) return

        const capturedEntity = collidedMoved ? collision.collidingEntity : collision.collidedEntity

        const unitType = registry.GetComponent(capturedEntity, Representation)
        if (!unitType) throw new Error(`Representation is undefined!`)

        eventQueue.EnqueueEvent(new UnitDestroyedEvent(unitType.model, unitType.color))
        registry.DestroyEntity(capturedEntity)
    })
}