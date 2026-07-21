import type { Entity } from "../../Contracts/Entity.ts";
import { HasMoved } from "../../Contracts/HasMoved.ts";
import { IsChessPiece } from "../../Contracts/IsChessPiece.ts";
import { OwnedBy } from "../../Contracts/OwnedBy.ts";
import { Position } from "../../Contracts/Position.ts";
import { GameMovementEvent } from "../../Contracts/MovementEvent.ts";
import type { IRegistry } from "../../Interfaces/IRegistry.ts";
import { EventQueue } from "../EventQueue.ts";
import { LinkedList } from "../../libraries/FastList/FastList.ts";
import { GetLegalMoves } from "../GetLegalMoves.ts";
import { HandleChessCollision } from "../HandleChessCollision.ts";
import { HandleCollision } from "../HandleCollision.ts";
import { HandleSpecialMoves } from "../HandleSpecialMoves.ts";

/** One candidate: which piece moves, from where, to where. */
export interface CandidateMove {
    piece : Entity
    from : Position
    to : Position
}

/** Every legal move available to `side` on the given board. */
export function EnumerateMoves (registry : IRegistry, side : Entity) : CandidateMove[] {
    const moves : CandidateMove[] = []

    registry.ForEachEntityWith([Position, IsChessPiece], (piece, position)=>{
        if (registry.GetComponent(piece, OwnedBy)?.owner !== side) return

        const from = new Position(position.x, position.y)

        for (const to of GetLegalMoves(piece, registry)) moves.push({ piece, from, to })
    })

    return moves
}

/**
 * Plays `move` on a throwaway clone, in place.
 *
 * The board-visible half of a move — write the new position, stamp HasMoved, announce it
 * — is HandleMovement's job, minus the selection plumbing that does not exist here. The
 * *consequences* (en passant, promotion, castling, and capturing whatever the mover
 * landed on) are then delegated to the very systems the live game runs, in the very same
 * order, so the search can never reach a position the real rules would not permit.
 */
export function ApplyMove (registry : IRegistry, move : CandidateMove) {
    const controller = registry.GetComponent(move.piece, OwnedBy)?.owner ?? move.piece
    const position = registry.GetComponent(move.piece, Position)

    if (position === undefined) return

    const from = new Position(position.x, position.y)

    position.x = move.to.x
    position.y = move.to.y

    registry.RegisterEntity(move.piece, HasMoved, new HasMoved())

    const eventQueue = new EventQueue(new LinkedList())
    eventQueue.EnqueueEvent(new GameMovementEvent(controller, move.piece, from, new Position(move.to.x, move.to.y)))

    HandleSpecialMoves(registry, eventQueue)
    HandleCollision(registry, eventQueue)
    HandleChessCollision(registry, eventQueue)
}
