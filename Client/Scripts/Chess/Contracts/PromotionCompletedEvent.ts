import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import type { Entity } from "./Entity.ts";

/**
 * A held-up move finally finishing. A promotion suspends the turn until its owner picks
 * a piece, by which time the GameMovementEvent that started it is long cleared — so the
 * systems that close out a move (turn switching, win detection) need this to fire.
 */
export class PromotionCompletedEvent implements IGameEvent {
    type = "PromotionCompleted" as const

    constructor (public ControllingEntity : Entity, public PromotedEntity : Entity) {}
}
