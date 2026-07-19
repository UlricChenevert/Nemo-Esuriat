import { Entity } from "../Contracts/Entity.ts";
import { GameClickEvent } from "../Contracts/GameClickEvent.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { IsSelected } from "../Contracts/IsSelected.ts";
import { IsSelectable } from "../Contracts/IsSelectible.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";

const MaxSelectionsPerPlayer = 2

export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {
    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    // The acting player. For now there is a single local player; turn ownership
    // (whose click this is) is not yet modelled — see review note #8.
    let actingPlayer : Entity | undefined
    registry.ForEachEntityWith([IsPlayer], (playerEntity) => { actingPlayer ??= playerEntity })

    if (actingPlayer === undefined) return

    // Collect first, mutate after: RegisterEntity/RemoveComponent below structurally
    // change the registries we would otherwise be iterating (see review note #7).
    const clickedEntities : Entity[] = []
    registry.ForEachEntityWith([IsSelectable, Position], (targetEntity, _, position) => {
        if (clickEvents.some((clickEvent) => isSamePosition(clickEvent.position, position))) {
            clickedEntities.push(targetEntity)
        }
    })

    for (const targetEntity of clickedEntities) {
        ToggleSelectedComponent(targetEntity, actingPlayer, registry)
    }
}

function ToggleSelectedComponent (targetEntity : Entity, player : Entity, registry : IRegistry) {
    const currentlySelected = registry.GetComponent(targetEntity, IsSelected)

    if (currentlySelected !== undefined) {
        if (currentlySelected.source !== player) return // Only the owner can deselect

        registry.RemoveComponent(targetEntity, IsSelected)
        return
    }

    let selectedByPlayerCount = 0
    registry.ForEachEntityWith([IsSelected], (_, isSelected) => {
        if (isSelected.source === player) selectedByPlayerCount++
    })

    if (selectedByPlayerCount >= MaxSelectionsPerPlayer) { console.warn("Already selected two!"); return }

    registry.RegisterEntity(targetEntity, IsSelected, new IsSelected(player))
}
