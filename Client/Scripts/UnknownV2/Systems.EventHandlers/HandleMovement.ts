import { Position } from "../Contracts/Components/Position.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import { GameMovementEvent } from "../Contracts/Events/MovementEvent.ts";
import { DecidesMovement } from "../Contracts/Tags/DecidesMovement.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleMovement (registry : IRegistry, eventQueue : IEventQueue) {
    registry.ForEachEntityWith([DecidesMovement], (decidesMovementEntity, _)=>{
        const selectionState = registry.GetComponent(decidesMovementEntity, SelectionState)
        
        if (!selectionState || !selectionState.destination) return

        const target = registry.GetComponent(selectionState.destination, Position)
        const newPosition = registry.GetComponent(selectionState.source, Position)
        
        if (target === undefined || newPosition === undefined) throw new Error("move-to entity or move-from entity's position was undefined?")
        
        const oldPosition = new Position(newPosition.x, newPosition.y)

        newPosition.x = target.x
        newPosition.y = target.y

        registry.RemoveComponent(decidesMovementEntity, SelectionState)
        // `target` is the destination tile's live Position component. Copying it keeps a
        // consumer that mutates NewPosition from silently relocating a board square.
        eventQueue.EnqueueEvent(new GameMovementEvent(decidesMovementEntity, selectionState.source, oldPosition, newPosition))
    })
}