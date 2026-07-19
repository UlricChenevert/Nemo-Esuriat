import { Entity } from "../Contracts/Entity";
import { GameClickEvent } from "../Contracts/GameClickEvent";
import { IsMoveable } from "../Contracts/IsMovable";
import { IsPlayer } from "../Contracts/IsPlayer";
import { IsSelected } from "../Contracts/IsSelected";
import { IsSelectable } from "../Contracts/IsSelectible";
import { GameKeyboardEvent } from "../Contracts/KeyBoardEvent";
import { Position } from "../Contracts/Position";
import type { IEventQueue } from "../Interfaces/IEventQueue";
import type { IRegistry } from "../Interfaces/IRegistry";
import { isSamePosition } from "../Utilities/PositionUtilities";
import { EntityBuilder } from "./EntityBuilder";

export function HandleInputEvents(registry : IRegistry, eventQueue : IEventQueue) {
    // const keyPressEvents = eventQueue.GetEventsOfType(GameKeyboardEvent)

    // End game key

    // Switch seats key

    // 

    const clickEvents = eventQueue.GetEventsOfType(GameClickEvent)

    if (clickEvents.length == 0) return

    registry.ForEachEntityWith([IsSelectable, Position], (targetEntity, __, position)=>{
        const isClicked = clickEvents.some((clickEvent)=>isSamePosition(clickEvent.position, position))
        
        if (!isClicked) return

        ToggleSelectedComponent(targetEntity, registry)
    })
}

function ToggleSelectedComponent (targetEntity : Entity, registry : IRegistry) {
    registry.ForEachEntityWith([IsPlayer], (playerEntity)=>{
        const currentlySelected = registry.GetComponent(targetEntity, IsSelected)

        if (currentlySelected !== undefined) { 
            if (currentlySelected.source !== playerEntity) return // Only can remove if player owns the selection
                
            registry.RemoveComponent(targetEntity, IsSelected)
        }

        let selectedByPlayerCount = 0
        registry.ForEachEntityWith([IsSelected], (_, IsSelected)=>{
            if (IsSelected.source == playerEntity) selectedByPlayerCount++
        })

        if (selectedByPlayerCount > 2) {console.warn("Already selected two!"); return}
    
        new EntityBuilder(registry).AddIsSelected(targetEntity, playerEntity)
        return
        
    })
}