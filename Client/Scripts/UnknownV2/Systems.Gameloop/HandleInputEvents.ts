import { UndefinedLayer } from "../Configuration/DisplayConstants.ts";
import { type Entity, EntityHandle } from "../Contracts/Components/Entity.ts";
import { IsSelectable } from "../Contracts/Components/IsSelectible.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import { GameClickEvent } from "../Contracts/Events/GameClickEvent.ts";
import { SelectionUpdateEvent } from "../Contracts/Events/SelectionUpdateEvent.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";


export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {

    let actingPlayer : Entity | undefined
    registry.ForEachEntityWith([IsPlayer], (playerEntity) => { actingPlayer ??= playerEntity })

    if (!actingPlayer) return

    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    let topEntity : Entity | undefined;
    let maxLayer = UndefinedLayer;

    registry.ForEachEntityWith([IsSelectable, Position, Layer], (selectedEntity, _, position, currentLayer) => {
        if (clickEvents.some((clickEvent) => isSamePosition(clickEvent.position, position))) {
            if (currentLayer === undefined) throw new Error(`${EntityHandle.ToString(selectedEntity)} layer is not defined! Please check over layer registrations!`)

            if (currentLayer.layerIndex > maxLayer) {maxLayer = currentLayer.layerIndex; topEntity = selectedEntity}
        }
    })

    if (topEntity === undefined) return

    ToggleSelectedComponent(topEntity, actingPlayer, registry, eventQueue)

}

function ToggleSelectedComponent (targetEntity : Entity, player : Entity, registry : IRegistry, eventQueue : IEventQueue) {
    const currentlySelected = registry.GetComponent(player, SelectionState)
    const owner = registry.GetComponent(targetEntity, OwnedBy)

    const hasSelectedState = currentlySelected !== undefined
    const hasSelectedDestination = currentlySelected?.destination !== undefined
    const canMove = registry.GetComponent(targetEntity, IsMoveable)
    const selectedSameEntity = targetEntity === currentlySelected?.source

    const isOwner = owner?.owner === player

    if (hasSelectedState && hasSelectedDestination) {
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false))

        registry.RemoveComponent(player, SelectionState)
    }
    else if (hasSelectedState && !hasSelectedDestination && selectedSameEntity) {
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false))

        registry.RemoveComponent(player, SelectionState)

    } else if (hasSelectedState && !hasSelectedDestination) {

        currentlySelected.destination = targetEntity

    }
    else if (!hasSelectedState && canMove && isOwner) {
        registry.RegisterEntity(player, SelectionState, new SelectionState(targetEntity))

        eventQueue.EnqueueEvent(new SelectionUpdateEvent(targetEntity, true))
    }
}
