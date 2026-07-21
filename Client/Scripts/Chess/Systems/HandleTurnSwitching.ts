import type { Entity } from "../Contracts/Entity.ts";
import { IsConscious } from "../Contracts/IsConcious.ts";
import { IsCurrentTurn } from "../Contracts/IsCurrentTurn.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import { PromotionCompletedEvent } from "../Contracts/PromotionCompletedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { HasPendingPromotion } from "./HandlePromotionChoice.ts";

export function HandleTurnSwitching (registry : IRegistry, eventQueue : IEventQueue) {
    // A promotion suspends the move mid-flight; the turn passes once it is answered.
    if (HasPendingPromotion(registry)) return

    const movedEntity = WhoJustFinishedMoving(eventQueue)

    if (movedEntity === undefined) return

    registry.RemoveComponent(movedEntity, IsCurrentTurn)

    let hasSwitched = false

    registry.ForEachEntityWith([IsConscious], (entity)=>{
        if (hasSwitched) return
        if (entity === movedEntity) return

        registry.RegisterEntity(entity, IsCurrentTurn, new IsCurrentTurn())
        hasSwitched = true
    })
}

/**
 * A move normally ends on the frame it lands, but one held up by a promotion prompt
 * ends when the choice comes in — frames later, with its movement event long gone.
 */
function WhoJustFinishedMoving (eventQueue : IEventQueue) : Entity | undefined {
    const movements = eventQueue.GetEventsOfType(GameMovementEvent)

    if (movements.length > 0) return movements[0]!.ControllingEntity

    const promotions = eventQueue.GetEventsOfType(PromotionCompletedEvent)

    if (promotions.length > 0) return promotions[0]!.ControllingEntity

    return undefined
}
