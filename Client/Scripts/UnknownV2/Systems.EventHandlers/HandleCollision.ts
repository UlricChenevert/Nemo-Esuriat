import type { Entity } from "../Contracts/Components/Entity.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleCollision(registry : IRegistry, eventQueue : IEventQueue) {
    const collisions = eventQueue.GetEventsOfType(GameCollisionEvent)

    if (collisions.length == 0) return

    collisions.forEach((collision)=>{
        TryRemoveMovementFlag(registry, collision.collidingEntity, collision.collidedEntity)
        TryRemoveMovementFlag(registry, collision.collidedEntity, collision.collidingEntity)
    })
}

function TryRemoveMovementFlag(registry : IRegistry, flag : Entity, movingEntity : Entity) {
    if (registry.GetComponent(flag, MovementFlag)) {
        if (!registry.GetComponent(movingEntity, IsMoveable)) throw new Error("Unexpected state!")
        
        const owner = registry.GetComponent(movingEntity, OwnedBy)

        if (!owner?.owner) throw new Error("Weird state!")

        const selectionState = registry.GetComponent(owner.owner, SelectionState)

        if (!selectionState?.MovementFlag) throw new Error("Weird state!")
        
        selectionState.MovementFlag = undefined 
        registry.DestroyEntity(flag)
    }
}