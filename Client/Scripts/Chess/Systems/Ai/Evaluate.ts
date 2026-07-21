import { BishopRepresentationLetter, CavalryRepresentationLetter, KingRepresentationLetter, PawnRepresentationLetter, QueenRepresentationLetter, RookRepresentationLetter } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import type { Entity } from "../../Contracts/Entity.ts";
import { IsChessPiece } from "../../Contracts/IsChessPiece.ts";
import { OwnedBy } from "../../Contracts/OwnedBy.ts";
import { Position } from "../../Contracts/Position.ts";
import { Representation } from "../../Contracts/Representation.ts";
import type { IRegistry } from "../../Interfaces/IRegistry.ts";

/** Centipawn worth of each piece. The king's value only matters as a tie-break floor. */
const PieceValue : Record<string, number> = {
    [PawnRepresentationLetter]: 100,
    [CavalryRepresentationLetter]: 320,
    [BishopRepresentationLetter]: 330,
    [RookRepresentationLetter]: 500,
    [QueenRepresentationLetter]: 900,
    [KingRepresentationLetter]: 20000,
}

const CenterMin = GameWidth / 2 - 1
const CenterMax = GameWidth / 2

/**
 * A static score of the board from `side`'s point of view: positive is good for `side`.
 * Material dominates; a small central-occupation bonus breaks ties toward active pieces
 * without ever outweighing so much as a pawn, so tactics still decide the game.
 */
export function Evaluate (registry : IRegistry, side : Entity) : number {
    let score = 0

    registry.ForEachEntityWith([Position, Representation, IsChessPiece], (piece, position, representation)=>{
        const owner = registry.GetComponent(piece, OwnedBy)?.owner
        if (owner === undefined) return

        const sign = owner === side? 1 : -1
        const material = PieceValue[representation.model] ?? 0

        const central = position.x >= CenterMin && position.x <= CenterMax
            && position.y >= CenterMin && position.y <= CenterMax

        score += sign * (material + (central? 10 : 0))
    })

    return score
}
