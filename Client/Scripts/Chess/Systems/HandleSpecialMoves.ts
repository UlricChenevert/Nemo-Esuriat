import { KingRepresentationLetter, PawnRepresentationLetter, QueenRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { HasMoved } from "../Contracts/HasMoved.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { JustDoubleStepped } from "../Contracts/JustDoubleStepped.ts";
import { GameMovementEvent } from "../Contracts/MovementEvent.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { PendingPromotion } from "../Contracts/PendingPromotion.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import { UnitDestroyedEvent } from "../Contracts/UnitDestroyedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { GetOccupancy, OccupantAt } from "./GetOccupancy.ts";
import { ApplyPromotion } from "./HandlePromotionChoice.ts";

/**
 * The three moves whose effect reaches beyond the moving piece's own square:
 * castling also relocates a rook, en passant captures a pawn the mover does not land
 * on, and promotion changes what the mover is. HandleMovement has already committed
 * the mover's new position by the time this runs; these are the consequences.
 */
export function HandleSpecialMoves (registry : IRegistry, eventQueue : IEventQueue) {
    const movements = eventQueue.GetEventsOfType(GameMovementEvent)

    if (movements.length == 0) return

    for (const movement of movements) {
        const model = registry.GetComponent(movement.MovingEntity, Representation)?.model

        // Order matters: the en passant capture below reads the tag that grants it, so
        // rights are consumed only after the move that used them has been resolved.
        if (model === PawnRepresentationLetter) CaptureEnPassantVictim(registry, eventQueue, movement)

        registry.ForEachEntityWith([JustDoubleStepped], (entity)=>{
            registry.RemoveComponent(entity, JustDoubleStepped)
        })

        if (model === PawnRepresentationLetter) {
            const advance = Math.abs(movement.NewPosition.y - movement.OldPosition.y)

            if (advance === 2) registry.RegisterEntity(movement.MovingEntity, JustDoubleStepped, new JustDoubleStepped())

            PromoteIfLastRank(registry, movement)
        }

        // A king that travelled two files can only have got there by castling.
        if (model === KingRepresentationLetter
            && Math.abs(movement.NewPosition.x - movement.OldPosition.x) === 2) {
            RelocateCastledRook(registry, movement)
        }
    }
}

/** The rook jumps to the square the king crossed. */
function RelocateCastledRook (registry : IRegistry, movement : GameMovementEvent) {
    const rank = movement.NewPosition.y
    const towardRook = Math.sign(movement.NewPosition.x - movement.OldPosition.x)
    const rookFile = towardRook > 0? GameWidth - 1 : 0

    const occupancy = GetOccupancy(registry)
    const rook = OccupantAt(occupancy, new Position(rookFile, rank))

    if (rook === undefined) return

    const rookPosition = registry.GetComponent(rook, Position)

    if (rookPosition === undefined) return

    rookPosition.x = movement.OldPosition.x + towardRook
    rookPosition.y = rank

    registry.RegisterEntity(rook, HasMoved, new HasMoved())
}

/**
 * A pawn that changed file onto an empty square captured in passing. The victim sits
 * beside the origin rather than under the destination, so HandleChessCollision — which
 * only ever sees two pieces sharing a square — cannot find it.
 */
function CaptureEnPassantVictim (registry : IRegistry, eventQueue : IEventQueue, movement : GameMovementEvent) {
    const mover = movement.MovingEntity
    const from = movement.OldPosition
    const to = movement.NewPosition

    if (from.x === to.x) return

    const victim = OccupantAt(GetOccupancy(registry), new Position(to.x, from.y))

    if (victim === undefined
        || victim === mover
        || registry.GetComponent(victim, Representation)?.model !== PawnRepresentationLetter
        || registry.GetComponent(victim, OwnedBy)?.owner === registry.GetComponent(mover, OwnedBy)?.owner
        || registry.GetComponent(victim, JustDoubleStepped) === undefined) return

    const victimRepresentation = registry.GetComponent(victim, Representation)!

    eventQueue.EnqueueEvent(new UnitDestroyedEvent(victimRepresentation.model, victimRepresentation.color))
    registry.DestroyEntity(victim)
}

/**
 * A pawn on the last rank must become something else. A human is asked which — the pawn
 * is tagged and play suspends until HandlePromotionChoice resolves it — but a side with
 * nobody at the controls would deadlock on that prompt, so it takes the queen.
 */
function PromoteIfLastRank (registry : IRegistry, movement : GameMovementEvent) {
    const rank = movement.NewPosition.y

    if (rank !== 0 && rank !== GameWidth - 1) return

    const owner = registry.GetComponent(movement.MovingEntity, OwnedBy)?.owner
    const isHuman = owner !== undefined && registry.GetComponent(owner, IsPlayer) !== undefined

    if (!isHuman) {
        ApplyPromotion(registry, movement.MovingEntity, QueenRepresentationLetter)
        return
    }

    registry.RegisterEntity(movement.MovingEntity, PendingPromotion, new PendingPromotion())
}
