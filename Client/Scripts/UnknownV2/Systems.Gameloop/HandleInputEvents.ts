import { CharacterRepresentation, GameColors, PlayerLayer, UndefinedLayer } from "../Configuration/DisplayConstants.ts";
import { type Entity, EntityHandle } from "../Contracts/Components/Entity.ts";
import { IsSelectable } from "../Contracts/Components/IsSelectible.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import { TargetLocation } from "../Contracts/Components/TargetLocation.ts";
import { GameClickEvent } from "../Contracts/Events/GameClickEvent.ts";
import { SelectionUpdateEvent } from "../Contracts/Events/SelectionUpdateEvent.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";
import { isSameTile } from "../Utilities/PositionUtilities.ts";


export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {
    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    let actingPlayer : Entity | undefined
    registry.ForEachEntityWith([IsPlayer], (playerEntity) => { actingPlayer ??= playerEntity })

    if (!actingPlayer) return

    clickEvents.forEach((event)=>{
        const currentlySelected = registry.GetComponent(actingPlayer!, SelectionState)
        
        if (!currentlySelected) {
            HandleCreatingSelection(registry, eventQueue, event, actingPlayer!)
            return
        }
    
        if (currentlySelected.MovementFlag) {
            ReplaceDestination(registry, eventQueue, event, currentlySelected, actingPlayer!)
            return
        }
    
        CreateNewDestination(registry, eventQueue, event, currentlySelected, actingPlayer!)
    })

}

function RetrieveTopMovableEntityInLocation(registry : IRegistry, clickEvent : GameClickEvent) : Entity | undefined {
    let topEntity : Entity | undefined;
    let maxLayer = UndefinedLayer;

    registry.ForEachEntityWith([IsSelectable, Position, Layer, IsMoveable], (selectedEntity, _, position, currentLayer) => {
        if (!isSameTile(clickEvent.position, position)) return

        if (currentLayer === undefined) throw new Error(`${EntityHandle.ToString(selectedEntity)} layer is not defined! Please check over layer registrations!`)
            
        if (currentLayer.layerIndex <= maxLayer) return

        maxLayer = currentLayer.layerIndex; 
        
        topEntity = selectedEntity
        
    })

    return topEntity
}

function HandleCreatingSelection(registry : IRegistry, eventQueue : IEventQueue, clickEvent : GameClickEvent, actingPlayer : Entity) {
    let topEntity : Entity | undefined = RetrieveTopMovableEntityInLocation(registry, clickEvent);
        
    if (!topEntity) return

    const owner = registry.GetComponent(topEntity, OwnedBy)

    const isOwner = owner?.owner === actingPlayer

    if (!isOwner) return

    registry.RegisterEntity(actingPlayer, SelectionState, new SelectionState(topEntity))

    eventQueue.EnqueueEvent(new SelectionUpdateEvent(topEntity, true))

    return 
}

function ReplaceDestination(registry : IRegistry, eventQueue : IEventQueue, clickEvent : GameClickEvent, selectionState : SelectionState, player : Entity) {
    
    const DestinationLocation = registry.GetComponent(selectionState.MovementFlag!, Position)
    if (!DestinationLocation) throw new Error("Destination location is undefined!")

    const clickedDestinationLocation = isSameTile(clickEvent.position, DestinationLocation)

    registry.DestroyEntity(selectionState.MovementFlag!)
    selectionState.MovementFlag = undefined

    if (clickedDestinationLocation) {
        // Clicking the flag itself cancels the move rather than planting a new flag
        // on the same tile: the character halts where it stands and the selection is
        // dropped, so the next click starts over.
        registry.RemoveComponent(selectionState.source, TargetLocation)
        registry.RemoveComponent(player, SelectionState)

        eventQueue.EnqueueEvent(new SelectionUpdateEvent(selectionState.source, false))

        return
    }

    CreateNewDestination(registry, eventQueue, clickEvent, selectionState, player)
}

function CreateNewDestination(registry : IRegistry, eventQueue : IEventQueue, clickEvent : GameClickEvent, selectionState : SelectionState, player : Entity) {
    // The flag's Position and the source's TargetLocation each get their own copy:
    // HandleMovement mutates Position components in place, so handing the same object
    // to two components -- let alone keeping the click event's own -- invites one
    // system's step from silently moving the other's target.
    const newEntity = new EntityBuilder(registry)
        .AddPosition(new Position(clickEvent.position.x, clickEvent.position.y))
        .AddOwner(player)
        .AddLayer(new Layer(PlayerLayer))
        .AddRepresentation(new Representation(CharacterRepresentation.Shrine, GameColors.Player))
        .AddTags(false, true, false, true)
        .GetEntity()

    registry.RegisterEntity(selectionState.source, TargetLocation, new TargetLocation(new Position(clickEvent.position.x, clickEvent.position.y)))

    selectionState.MovementFlag = newEntity

    eventQueue.EnqueueEvent(new SelectionUpdateEvent(selectionState.source, false))
}