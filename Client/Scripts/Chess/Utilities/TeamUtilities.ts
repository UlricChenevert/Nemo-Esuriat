import type { Entity } from "../Contracts/Entity.ts";
import { IsConscious } from "../Contracts/IsConcious.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * Two pieces are teammates when they share an owner. An entity without an OwnedBy is
 * treated as hostile — safer than handing it a free pass.
 */
export function isSameTeam (registry : IRegistry, a : Entity, b : Entity) {
    const ownerOfA = registry.GetComponent(a, OwnedBy)
    const ownerOfB = registry.GetComponent(b, OwnedBy)

    if (ownerOfA === undefined || ownerOfB === undefined) return false

    return ownerOfA.owner === ownerOfB.owner
}

/** The other conscious entity — the side whose pieces threaten `owner`'s king. */
export function GetOpponentOf (owner : Entity, registry : IRegistry) : Entity | undefined {
    let opponent : Entity | undefined

    registry.ForEachEntityWith([IsConscious], (entity)=>{
        if (entity !== owner) opponent ??= entity
    })

    return opponent
}
