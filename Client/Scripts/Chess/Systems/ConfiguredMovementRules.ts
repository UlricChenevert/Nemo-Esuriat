import { BishopRepresentationLetter, CavalryRepresentationLetter, KingRepresentationLetter, PawnRepresentationLetter, QueenRepresentationLetter, RookRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { HasMoved } from "../Contracts/HasMoved.ts";
import { IsGoingDown } from "../Contracts/IsGoingDown.ts";
import { JustDoubleStepped } from "../Contracts/JustDoubleStepped.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IGenerateValidMoves } from "../Interfaces/IGenerateValidMoves.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.ts";
import { GetOpponentOf, isSameTeam } from "../Utilities/TeamUtilities.ts";
import { IsSquareAttacked } from "./GetAttackedSquares.ts";
import { GetOccupancy, OccupantAt, type Occupancy } from "./GetOccupancy.ts";
import { CavalryOffsets, Diagonal, GetSlidingMoves, GetSteppingMoves, Omni, Orthogonal } from "./MoveGeneration.ts";

/**
 * Each piece exposes the squares it may move to and the squares it controls. The two
 * differ — see the note on GenerationMode in MoveGeneration.ts — and conflating them
 * breaks king safety, so every piece must supply both.
 */
export interface PieceRules {
    moves : IGenerateValidMoves
    attacks : IGenerateValidMoves
}

/** Which way this piece's side advances. Pawns are the only asymmetric piece. */
function forwardFor (registry : Parameters<IGenerateValidMoves>[2], entity : Parameters<IGenerateValidMoves>[1]) {
    return registry.GetComponent(entity, IsGoingDown)? 1 : -1
}

/**
 * A pawn's move classes each carry their own legality condition — a plain advance
 * needs an empty square, a diagonal needs an enemy on it, and the opening double-step
 * needs an untouched pawn with both squares clear. They are built separately rather
 * than filtered out of one shared candidate list.
 */
const PawnMoves : IGenerateValidMoves = (currentPosition, currentEntity, registry, occupancy) => {
    occupancy ??= GetOccupancy(registry)

    const forward = forwardFor(registry, currentEntity)
    const possibleLocations : Position[] = []

    const oneStep = new Position(currentPosition.x, currentPosition.y + forward)
    const oneStepIsClear = !isNotWithinGameBorder(oneStep) && OccupantAt(occupancy, oneStep) === undefined

    if (oneStepIsClear) possibleLocations.push(oneStep)

    const twoStep = new Position(currentPosition.x, currentPosition.y + 2 * forward)

    if (oneStepIsClear
        && registry.GetComponent(currentEntity, HasMoved) === undefined
        && !isNotWithinGameBorder(twoStep)
        && OccupantAt(occupancy, twoStep) === undefined) possibleLocations.push(twoStep)

    for (const sideways of [-1, 1]) {
        const diagonal = new Position(currentPosition.x + sideways, currentPosition.y + forward)

        if (isNotWithinGameBorder(diagonal)) continue

        const occupant = OccupantAt(occupancy, diagonal)

        if (occupant !== undefined) {
            if (!isSameTeam(registry, currentEntity, occupant)) possibleLocations.push(diagonal)
            continue
        }

        // En passant: the diagonal is empty, but an enemy pawn just double-stepped
        // alongside us and may be taken as though it had only advanced one square.
        const passed = OccupantAt(occupancy, new Position(currentPosition.x + sideways, currentPosition.y))

        if (passed !== undefined
            && !isSameTeam(registry, currentEntity, passed)
            && registry.GetComponent(passed, Representation)?.model === PawnRepresentationLetter
            && registry.GetComponent(passed, JustDoubleStepped) !== undefined) possibleLocations.push(diagonal)
    }

    return possibleLocations
}

/**
 * A pawn controls both forward diagonals whether or not anything stands there — an
 * enemy king may not step onto an empty square a pawn covers.
 */
const PawnAttacks : IGenerateValidMoves = (currentPosition, currentEntity, registry) => {
    const forward = forwardFor(registry, currentEntity)

    return [-1, 1]
        .map((sideways)=>new Position(currentPosition.x + sideways, currentPosition.y + forward))
        .filter((diagonal)=>!isNotWithinGameBorder(diagonal))
}

export const PawnRules : PieceRules = { moves: PawnMoves, attacks: PawnAttacks }

/** Sliders and steppers differ from their attack maps only by generation mode. */
function slidingPiece (directions : typeof Omni, maxScale : number) : PieceRules {
    return {
        moves: (from, mover, registry, occupancy) =>
            GetSlidingMoves(from, directions, maxScale, mover, registry, occupancy ?? GetOccupancy(registry), "moves"),
        attacks: (from, mover, registry, occupancy) =>
            GetSlidingMoves(from, directions, maxScale, mover, registry, occupancy ?? GetOccupancy(registry), "attacks"),
    }
}

export const RookRules = slidingPiece(Orthogonal, GameWidth)
export const BishopRules = slidingPiece(Diagonal, GameWidth)
export const QueenRules = slidingPiece(Omni, GameWidth)

export const CavalryRules : PieceRules = {
    moves: (from, mover, registry, occupancy) =>
        GetSteppingMoves(from, CavalryOffsets, mover, registry, occupancy ?? GetOccupancy(registry), "moves"),
    attacks: (from, mover, registry, occupancy) =>
        GetSteppingMoves(from, CavalryOffsets, mover, registry, occupancy ?? GetOccupancy(registry), "attacks"),
}

const KingSteps = slidingPiece(Omni, 1)

/** Files a rook starts on. Castling is only ever toward one of these. */
const RookHomeFiles = [0, GameWidth - 1]

/**
 * Castling destinations, as the king's two-square hop. The rook's relocation is a
 * consequence handled by HandleSpecialMoves — move generation only has to decide
 * whether the hop is legal.
 */
function CastlingDestinations (from : Position, king : Entity, registry : IRegistry, occupancy : Occupancy) : Position[] {
    if (registry.GetComponent(king, HasMoved) !== undefined) return []

    const owner = registry.GetComponent(king, OwnedBy)?.owner
    const opponent = owner === undefined? undefined : GetOpponentOf(owner, registry)

    if (owner === undefined || opponent === undefined) return []

    // Castling out of check is illegal, so this is worth paying for once up front.
    if (IsSquareAttacked(from, opponent, registry, occupancy)) return []

    const destinations : Position[] = []

    for (const rookFile of RookHomeFiles) {
        const rook = OccupantAt(occupancy, new Position(rookFile, from.y))

        if (rook === undefined
            || registry.GetComponent(rook, Representation)?.model !== RookRepresentationLetter
            || registry.GetComponent(rook, OwnedBy)?.owner !== owner
            || registry.GetComponent(rook, HasMoved) !== undefined) continue

        const towardRook = Math.sign(rookFile - from.x)

        // Every square strictly between king and rook must be vacant.
        let pathIsClear = true
        for (let file = from.x + towardRook; file !== rookFile; file += towardRook) {
            if (OccupantAt(occupancy, new Position(file, from.y)) !== undefined) { pathIsClear = false; break }
        }
        if (!pathIsClear) continue

        const crossed = new Position(from.x + towardRook, from.y)
        const destination = new Position(from.x + 2 * towardRook, from.y)

        // The king may not pass through or land on an attacked square.
        if (IsSquareAttacked(crossed, opponent, registry, occupancy)) continue
        if (IsSquareAttacked(destination, opponent, registry, occupancy)) continue

        destinations.push(destination)
    }

    return destinations
}

export const KingRules : PieceRules = {
    moves: (from, mover, registry, occupancy) => {
        occupancy ??= GetOccupancy(registry)

        return [...KingSteps.moves(from, mover, registry, occupancy), ...CastlingDestinations(from, mover, registry, occupancy)]
    },
    // Castling never captures, so it contributes nothing to the squares a king controls.
    attacks: KingSteps.attacks,
}

/**
 * Piece identity resolved from its Representation letter. Attack scanning needs the
 * attack generator for an arbitrary enemy piece, and the MovementRules component
 * stores only the move generator, so this is the one place the mapping lives.
 */
export const RulesByRepresentation : Record<string, PieceRules> = {
    [PawnRepresentationLetter]: PawnRules,
    [RookRepresentationLetter]: RookRules,
    [BishopRepresentationLetter]: BishopRules,
    [QueenRepresentationLetter]: QueenRules,
    [CavalryRepresentationLetter]: CavalryRules,
    [KingRepresentationLetter]: KingRules,
}
