import { UndefinedLayer } from "../Configuration/DisplayConstants.ts";
import { Entity } from "../Contracts/Entity.ts";
import { GameClickEvent } from "../Contracts/GameClickEvent.ts";
import { IsMoveable } from "../Contracts/IsMovable.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { SelectionState } from "../Contracts/IsSelected.ts";
import { IsSelectable } from "../Contracts/IsSelectible.ts";
import { Layer } from "../Contracts/Layer.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";

export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {
    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    let actingPlayer : Entity | undefined
    registry.ForEachEntityWith([IsPlayer], (playerEntity) => { actingPlayer ??= playerEntity })

    if (actingPlayer === undefined) return

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

        if (currentLayer === undefined) throw new Error(`${targetEntity} layer is not defined! Please check over layer registrations!`)
            
        if (currentLayer > maxLayer) {maxLayer = currentLayer; topEntity = targetEntity}
    }

    ToggleSelectedComponent(topEntity!, actingPlayer, registry)
    
}

function ToggleSelectedComponent (targetEntity : Entity, player : Entity, registry : IRegistry) {
    console.log("Is in selection toggling!")
    const currentlySelected = registry.GetComponent(player, SelectionState)

    const hasSelectedState = currentlySelected !== undefined
    const hasSelectedDestination = currentlySelected?.destination !== undefined

    if (hasSelectedState && hasSelectedDestination) {
        registry.RemoveComponent(player, SelectionState)
    }
    else if (hasSelectedState && !hasSelectedDestination) {
        currentlySelected.destination = targetEntity
    }
    else if (!hasSelectedState && !hasSelectedDestination && registry.GetComponent(targetEntity, IsMoveable)) {
        registry.RegisterEntity(player, SelectionState, new SelectionState(targetEntity))
    }
}
