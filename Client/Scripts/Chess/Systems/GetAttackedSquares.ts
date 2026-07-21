import type { Entity } from "../Contracts/Entity.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";
import { RulesByRepresentation } from "./ConfiguredMovementRules.ts";
import { OccupiedSquares, type Occupancy } from "./GetOccupancy.ts";

/**
 * Whether any piece belonging to `attacker` controls `square` on the given board.
 *
 * Deliberately uses each piece's *attack* generator, not its move generator: a square
 * occupied by one of the attacker's own pieces still counts, otherwise an enemy king
 * could capture a defended piece. Equally deliberately, this never filters for check —
 * that would recurse forever, and a pinned piece still guards the squares it covers.
 */
export function IsSquareAttacked (square : Position, attacker : Entity, registry : IRegistry, occupancy : Occupancy) : boolean {
    return OccupiedSquares(occupancy).some(({ position, entity })=>{
        if (registry.GetComponent(entity, OwnedBy)?.owner !== attacker) return false

        const model = registry.GetComponent(entity, Representation)?.model
        const rules = model === undefined? undefined : RulesByRepresentation[model]

        if (rules === undefined) return false

        return rules.attacks(position, entity, registry, occupancy).some((attacked)=>isSamePosition(attacked, square))
    })
}
