
import { HasMoved } from "../Contracts/HasMoved.ts";
import { IsConscious } from "../Contracts/IsConcious.ts";
import { SelectionState } from "../Contracts/IsSelected.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import { Position } from "../Contracts/Position.ts";
import { SelectionUpdateEvent } from "../Contracts/SelectionUpdate.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { IsGameOver } from "../Utilities/GameStateUtilities.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";
import { GetLegalMoves } from "./GetLegalMoves.ts";

export function HandleMovement (registry : IRegistry, eventQueue : IEventQueue) {
    if (IsGameOver(registry)) return

    registry.ForEachEntityWith([IsConscious], (consciousnessEntity, _)=>{
        const selectionState = registry.GetComponent(consciousnessEntity, SelectionState)
        
        if (!selectionState || !selectionState.destination) return

        const target = registry.GetComponent(selectionState.destination, Position)
        const positionToEdit = registry.GetComponent(selectionState.source, Position)

        const oldPosition = new Position(positionToEdit!.x, positionToEdit!.y)

        if (target === undefined || positionToEdit === undefined) throw new Error("move-to entity or move-from entity's position was undefined?")

        // GetLegalMoves, not the raw rule: a move that exposes its own king is rejected here.
        const isValid = GetLegalMoves(selectionState.source, registry).some((position)=>isSamePosition(position, target))

        if (!isValid) {
            selectionState.destination = undefined
            return
        }

        positionToEdit.x = target.x
        positionToEdit.y = target.y

        registry.RegisterEntity(selectionState.source, HasMoved, new HasMoved())

        registry.RemoveComponent(consciousnessEntity, SelectionState)
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(selectionState.source, false))
        // `target` is the destination tile's live Position component. Copying it keeps a
        // consumer that mutates NewPosition from silently relocating a board square.
        eventQueue.EnqueueEvent(new GameMovementEvent(consciousnessEntity, selectionState.source, oldPosition, new Position(target.x, target.y)))
    })
}