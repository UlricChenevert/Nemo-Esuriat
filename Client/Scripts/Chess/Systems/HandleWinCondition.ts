import { KingRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { Position } from "../Contracts/Position.ts";
import { UnitDestroyedEvent } from "../Contracts/UnitDestroyedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "./EntityBuilder.ts";

export function HandleWinCondition(registry : IRegistry, eventQueue : IEventQueue) {
    const kingsDestroyedEvent = eventQueue.GetEventsOfType(UnitDestroyedEvent).filter((events)=>events.UnitType == KingRepresentationLetter)

    if (kingsDestroyedEvent.length == 0) return

    // kingsDestroyedEvent[0]  
    
    new EntityBuilder(registry)
        .AddText("Game\nOver", new Position(Math.floor(GameWidth / 4), Math.floor(GameWidth / 2) - 1))

}