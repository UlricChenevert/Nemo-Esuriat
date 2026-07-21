import { KingRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { MovementRules } from "../Contracts/MovementRules.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { GetOpponentOf } from "../Utilities/TeamUtilities.ts";
import { IsSquareAttacked } from "./GetAttackedSquares.ts";
import { GetOccupancy, OccupiedSquares, WithSimulatedMove, type Occupancy } from "./GetOccupancy.ts";

function FindKing (owner : Entity, registry : IRegistry, occupancy : Occupancy) : Position | undefined {
    return OccupiedSquares(occupancy).find(({ entity })=>
        registry.GetComponent(entity, OwnedBy)?.owner === owner
        && registry.GetComponent(entity, Representation)?.model === KingRepresentationLetter
    )?.position
}

/** Whether `owner`'s king is currently under attack. */
export function IsInCheck (owner : Entity, registry : IRegistry, occupancy = GetOccupancy(registry)) : boolean {
    const king = FindKing(owner, registry, occupancy)
    const opponent = GetOpponentOf(owner, registry)

    if (king === undefined || opponent === undefined) return false

    return IsSquareAttacked(king, opponent, registry, occupancy)
}

/**
 * The piece's pseudo-legal moves minus any that would leave its own king attacked.
 * Each candidate is evaluated against a modified copy of the occupancy map, so the
 * registry is never mutated to answer the question.
 */
export function GetLegalMoves (entity : Entity, registry : IRegistry) : Position[] {
    const rules = registry.GetComponent(entity, MovementRules)
    const from = registry.GetComponent(entity, Position)
    const owner = registry.GetComponent(entity, OwnedBy)?.owner

    if (rules === undefined || from === undefined) return []

    const occupancy = GetOccupancy(registry)
    const candidates = rules.generateValidMoves(from, entity, registry, occupancy)

    const opponent = owner === undefined? undefined : GetOpponentOf(owner, registry)

    // Boards without a king or an opponent (unit-test fixtures) have nothing to protect.
    if (owner === undefined || opponent === undefined || FindKing(owner, registry, occupancy) === undefined) return candidates

    const isKing = registry.GetComponent(entity, Representation)?.model === KingRepresentationLetter

    return candidates.filter((destination)=>{
        const simulated = WithSimulatedMove(occupancy, entity, from, destination)
        const king = isKing? destination : FindKing(owner, registry, simulated)

        if (king === undefined) return true

        return !IsSquareAttacked(king, opponent, registry, simulated)
    })
}
