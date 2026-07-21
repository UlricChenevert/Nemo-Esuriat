import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { IsChessPiece } from "../Contracts/IsChessPiece.ts";
import { IsCurrentTurn } from "../Contracts/IsCurrentTurn.ts";
import { GameOver } from "../Contracts/GameOver.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { IsGameOver } from "../Utilities/GameStateUtilities.ts";
import { EntityBuilder } from "./EntityBuilder.ts";
import { GetLegalMoves, IsInCheck } from "./GetLegalMoves.ts";
import { HasPendingPromotion } from "./HandlePromotionChoice.ts";
import { PromotionCompletedEvent } from "../Contracts/PromotionCompletedEvent.ts";

export type GameEnding = "checkmate" | "stalemate" | undefined

/**
 * Whether the side to move has run out of legal replies, and if so which ending it is.
 *
 * Kings can no longer be captured — GetLegalMoves rejects any move that leaves one
 * attacked — so the game ends the way real chess does. Pure: decides nothing, writes
 * nothing, which is what makes it directly testable without staging an event.
 */
export function EvaluateGameEnding (registry : IRegistry) : GameEnding {
    let sideToMove : Entity | undefined
    registry.ForEachEntityWith([IsCurrentTurn], (entity)=>{ sideToMove ??= entity })

    if (sideToMove === undefined) return undefined

    let hasAnyLegalMove = false
    registry.ForEachEntityWith([IsChessPiece, Position], (piece)=>{
        if (hasAnyLegalMove) return
        if (registry.GetComponent(piece, OwnedBy)?.owner !== sideToMove) return

        if (GetLegalMoves(piece, registry).length > 0) hasAnyLegalMove = true
    })

    if (hasAnyLegalMove) return undefined

    return IsInCheck(sideToMove, registry)? "checkmate" : "stalemate"
}

/**
 * Ends the game when the side to move has no legal reply.
 *
 * Gated on a move having just landed: nothing else can change the answer, and the scan
 * costs a full legal-move generation for one whole side. Runs after HandleTurnSwitching
 * so `IsCurrentTurn` already names the side that has to find the reply.
 */
export function HandleWinCondition (registry : IRegistry, eventQueue : IEventQueue) {
    if (IsGameOver(registry)) return
    if (HasPendingPromotion(registry)) return

    const moveLanded = eventQueue.GetEventsOfType(GameMovementEvent).length > 0
    const promotionAnswered = eventQueue.GetEventsOfType(PromotionCompletedEvent).length > 0

    if (!moveLanded && !promotionAnswered) return

    const ending = EvaluateGameEnding(registry)

    if (ending === undefined) return

    const message = ending === "checkmate"? "Check\nmate" : "Stale\nmate"

    new EntityBuilder(registry)
        .AddText(message, new Position(Math.floor(GameWidth / 4), Math.floor(GameWidth / 2) - 1))
        .GetEntity()

    registry.ForEachEntityWith([IsCurrentTurn], (entity)=>{
        registry.RegisterEntity(entity, GameOver, new GameOver())
    })
}
