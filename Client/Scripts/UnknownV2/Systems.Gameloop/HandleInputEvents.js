import { UndefinedLayer } from "../Configuration/DisplayConstants.js";
import { EntityHandle } from "../Contracts/Components/Entity.js";
import { IsSelectable } from "../Contracts/Components/IsSelectible.js";
import { Layer } from "../Contracts/Components/Layer.js";
import { OwnedBy } from "../Contracts/Components/OwnedBy.js";
import { Position } from "../Contracts/Components/Position.js";
import { SelectionState } from "../Contracts/Components/SelectionState.js";
import { GameClickEvent } from "../Contracts/Events/GameClickEvent.js";
import { SelectionUpdateEvent } from "../Contracts/Events/SelectionUpdateEvent.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.js";
import { isSamePosition } from "../Utilities/PositionUtilities.js";
export function HandleInputEvents(registry, eventQueue) {
    let actingPlayer;
    registry.ForEachEntityWith([IsPlayer], (playerEntity) => { actingPlayer ??= playerEntity; });
    if (!actingPlayer)
        return;
    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent);
    if (clickEvents.length == 0)
        return;
    let topEntity;
    let maxLayer = UndefinedLayer;
    registry.ForEachEntityWith([IsSelectable, Position, Layer], (selectedEntity, _, position, currentLayer) => {
        if (clickEvents.some((clickEvent) => isSamePosition(clickEvent.position, position))) {
            if (currentLayer === undefined)
                throw new Error(`${EntityHandle.ToString(selectedEntity)} layer is not defined! Please check over layer registrations!`);
            if (currentLayer.layerIndex > maxLayer) {
                maxLayer = currentLayer.layerIndex;
                topEntity = selectedEntity;
            }
        }
    });
    if (topEntity === undefined)
        return;
    ToggleSelectedComponent(topEntity, actingPlayer, registry, eventQueue);
}
function ToggleSelectedComponent(targetEntity, player, registry, eventQueue) {
    const currentlySelected = registry.GetComponent(player, SelectionState);
    const owner = registry.GetComponent(targetEntity, OwnedBy);
    const hasSelectedState = currentlySelected !== undefined;
    const hasSelectedDestination = currentlySelected?.destination !== undefined;
    const canMove = registry.GetComponent(targetEntity, IsMoveable);
    const selectedSameEntity = targetEntity === currentlySelected?.source;
    const isOwner = owner?.owner === player;
    if (hasSelectedState && hasSelectedDestination) {
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false));
        registry.RemoveComponent(player, SelectionState);
    }
    else if (hasSelectedState && !hasSelectedDestination && selectedSameEntity) {
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(currentlySelected.source, false));
        registry.RemoveComponent(player, SelectionState);
    }
    else if (hasSelectedState && !hasSelectedDestination) {
        currentlySelected.destination = targetEntity;
    }
    else if (!hasSelectedState && canMove && isOwner) {
        registry.RegisterEntity(player, SelectionState, new SelectionState(targetEntity));
        eventQueue.EnqueueEvent(new SelectionUpdateEvent(targetEntity, true));
    }
}
//# sourceMappingURL=HandleInputEvents.js.map