import { UndefinedLayer } from "../Configuration/DisplayConstants.ts";
import { HotSeat } from "../Configuration/GameConstants.ts";
import { EntityHandle, type Entity } from "../Contracts/Entity.ts";
import { GameClickEvent } from "../Contracts/GameClickEvent.ts";
import { GameKeyboardEvent } from "../Contracts/KeyBoardEvent.ts";
import { IsCurrentTurn } from "../Contracts/IsCurrentTurn.ts";
import { IsMoveable } from "../Contracts/IsMovable.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { SelectionState } from "../Contracts/IsSelected.ts";
import { IsSelectable } from "../Contracts/IsSelectible.ts";
import { Layer } from "../Contracts/Layer.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Position } from "../Contracts/Position.ts";
import { SelectionUpdateEvent } from "../Contracts/SelectionUpdate.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { IsGameOver } from "../Utilities/GameStateUtilities.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";
import { HasPendingPromotion } from "./HandlePromotionChoice.ts";

export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {
    if (IsGameOver(registry)) return
    // A pawn is waiting on a promotion choice; HandlePromotionChoice owns the clicks.
    if (HasPendingPromotion(registry)) return

    let actingPlayer : Entity | undefined
    registry.ForEachEntityWith([IsCurrentTurn], (playerEntity) => { actingPlayer ??= playerEntity })

    if (actingPlayer === undefined) return
    if (!HotSeat && !registry.GetComponent(actingPlayer, IsPlayer)) return

    if (WasEscapePressed(eventQueue)) DeselectCurrent(actingPlayer, registry, eventQueue)

    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    const selectedEntities : Entity[] = []
    registry.ForEachEntityWith([IsSelectable, Position], (selectedEntity, _, position) => {
        if (clickEvents.some((clickEvent) => isSamePosition(clickEvent.position, position))) {
            selectedEntities.push(selectedEntity)
        }
    })

    let topEntity : Entity | undefined;

    let maxLayer = UndefinedLayer;
    
    for (const targetEntity of selectedEntities) {
        const currentLayer = registry.GetComponent(targetEntity, Layer)?.layerIndex

        if (currentLayer === undefined) throw new Error(`${EntityHandle.ToString(targetEntity)} layer is not defined! Please check over layer registrations!`)

        if (currentLayer > maxLayer) {maxLayer = currentLayer; topEntity = targetEntity}
    }

    // Clicking empty space selects nothing. Passing undefined through here would
    // let the branch below write `destination = undefined`, silently corrupting
    // an in-progress selection.
    if (topEntity === undefined) return

    ToggleSelectedComponent(topEntity, actingPlayer, registry, eventQueue)

}

/** Escape abandons the piece a player is holding, if any, without moving it. */
function WasEscapePressed (eventQueue : IEventQueue) : boolean {
    return eventQueue.GetEventsOfType(GameKeyboardEvent).some((event)=>event.code === "Escape")
}

function DeselectCurrent (player : Entity, registry : IRegistry, eventQueue : IEventQueue) {
    const selection = registry.GetComponent(player, SelectionState)

    if (selection === undefined) return

    // The false SelectionUpdate is what hands the highlight back and clears the hints.
    eventQueue.EnqueueEvent(new SelectionUpdateEvent(selection.source, false))
    registry.RemoveComponent(player, SelectionState)
}

function ToggleSelectedComponent (targetEntity : Entity, player : Entity, registry : IRegistry, eventQueue : IEventQueue) {
    const currentlySelected = registry.GetComponent(player, SelectionState)
    const owner = registry.GetComponent(targetEntity, OwnedBy)

    const hasSelectedState = currentlySelected !== undefined
    const hasSelectedDestination = currentlySelected?.destination !== undefined
    const canMove = registry.GetComponent(targetEntity, IsMoveable)

    // `owner` is the OwnedBy COMPONENT wrapping an entity, not the entity.
    const isOwner = owner?.owner === player

    if (hasSelectedState && hasSelectedDestination) {
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false))

        registry.RemoveComponent(player, SelectionState)
    }
    else if (hasSelectedState && !hasSelectedDestination) {
        // Re-clicking the already-selected piece deselects it, rather than
        // queueing a degenerate self-move. The highlight has to be handed back
        // here too, or every select/deselect cycle lightens the piece again.
        if (targetEntity === currentlySelected.source) {
            eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false))

            registry.RemoveComponent(player, SelectionState)
            return
        }

        currentlySelected.destination = targetEntity
    }
    else if (!hasSelectedState && canMove && isOwner) {
        registry.RegisterEntity(player, SelectionState, new SelectionState(targetEntity))

        eventQueue.EnqueueEvent(new SelectionUpdateEvent(targetEntity, true))
    }
}
