
import { IsConscious } from "../Contracts/IsConcious.ts";
import { SelectionState } from "../Contracts/IsSelected.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleMovement (registry : IRegistry, eventQueue : IEventQueue) {

    // Add validation logic
    registry.ForEachEntityWith([IsConscious], (consciousnessEntity, _)=>{
        const selectionState = registry.GetComponent(consciousnessEntity, SelectionState)
        
        if (!selectionState || !selectionState.destination) return

        const target = registry.GetComponent(selectionState.destination, Position)
        const positionToEdit = registry.GetComponent(selectionState.source, Position)

        if (target === undefined || positionToEdit === undefined) throw new Error("move-to entity or move-from entity's position was undefined?")

        positionToEdit.x = target.x 
        positionToEdit.y = target.y

        registry.RemoveComponent(consciousnessEntity, SelectionState)
    })
}