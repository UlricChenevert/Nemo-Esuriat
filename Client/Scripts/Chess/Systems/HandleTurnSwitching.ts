import { IsConscious } from "../Contracts/IsConcious.ts";
import { IsCurrentTurn } from "../Contracts/IsCurrentTurn.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleTurnSwitching (registry : IRegistry, eventQueue : IEventQueue) {
    const movementEvent = eventQueue.GetEventsOfType(GameMovementEvent)

    if (movementEvent.length == 0) return
    
    let movedEntity = movementEvent[0]!.ControllingEntity
    registry.RemoveComponent(movedEntity, IsCurrentTurn)

    let hasSwitched = false

    registry.ForEachEntityWith([IsConscious], (entity)=>{
        if (hasSwitched) return
        if (entity === movedEntity) return

        registry.RegisterEntity(entity, IsCurrentTurn, new IsCurrentTurn())
        hasSwitched = true
    })
}