import type { Entity } from "../Contracts/Entity.ts";
import { Position } from "../Contracts/Position.ts";
import { Vector2D } from "../Contracts/Vector.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.ts";
import { isSameTeam } from "../Utilities/TeamUtilities.ts";
import { OccupantAt, type Occupancy } from "./GetOccupancy.ts";

export const Orthogonal = [
    new Vector2D(0, 1), new Vector2D(0, -1), new Vector2D(1, 0), new Vector2D(-1, 0)
]

export const Diagonal = [
    new Vector2D(1, 1), new Vector2D(1, -1), new Vector2D(-1, 1), new Vector2D(-1, -1)
]

export const Omni = [...Orthogonal, ...Diagonal]

export const CavalryOffsets = [
    new Vector2D(1, 2), new Vector2D(2, 1), new Vector2D(2, -1), new Vector2D(1, -2),
    new Vector2D(-1, -2), new Vector2D(-2, -1), new Vector2D(-2, 1), new Vector2D(-1, 2)
]

/**
 * "moves" yields squares the piece may legally move to; "attacks" yields squares it
 * controls. They differ on occupied squares: a piece defending a friendly square
 * cannot move there, but an enemy king may not capture there either — so the square
 * counts as attacked. Aliasing the two lets a king capture defended pieces.
 */
export type GenerationMode = "moves" | "attacks"

function isReachable (mode : GenerationMode, occupant : Entity | undefined, mover : Entity, registry : IRegistry) {
    if (occupant === undefined) return true
    if (mode === "attacks") return true

    return !isSameTeam(registry, mover, occupant)
}

/** Walks each direction outward, stopping at the board edge and at the first occupied square. */
export function GetSlidingMoves (
    from : Position,
    directions : Vector2D[],
    maxScale : number,
    mover : Entity,
    registry : IRegistry,
    occupancy : Occupancy,
    mode : GenerationMode = "moves"
) : Position[] {
    const possibleLocations : Position[] = []

    for (const direction of directions) {
        for (let scale = 1; scale <= maxScale; scale++) {
            const candidate = new Position(from.x + direction.x * scale, from.y + direction.y * scale)

            if (isNotWithinGameBorder(candidate)) break

            const occupant = OccupantAt(occupancy, candidate)

            if (isReachable(mode, occupant, mover, registry)) possibleLocations.push(candidate)

            // The ray is blocked from here on regardless of whose piece it is.
            if (occupant !== undefined) break
        }
    }

    return possibleLocations
}

/** Fixed offsets that ignore anything in between — the cavalry jumps. */
export function GetSteppingMoves (
    from : Position,
    offsets : Vector2D[],
    mover : Entity,
    registry : IRegistry,
    occupancy : Occupancy,
    mode : GenerationMode = "moves"
) : Position[] {
    const possibleLocations : Position[] = []

    for (const offset of offsets) {
        const candidate = new Position(from.x + offset.x, from.y + offset.y)

        if (isNotWithinGameBorder(candidate)) continue

        if (isReachable(mode, OccupantAt(occupancy, candidate), mover, registry)) possibleLocations.push(candidate)
    }

    return possibleLocations
}
