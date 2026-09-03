import type { Entity } from "../Contracts/Components/Entity.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { KillEntity } from "../Utilities/MortalityUtilities.ts";

/**
 * Kills whatever has run out of what it needed, and leaves the body.
 *
 * The consequence of UpdateNeeds, split from it deliberately. UpdateNeeds is the
 * one place that knows what a second is; this knows nothing about time and only
 * about the state that draining leaves behind, so it takes no clock and can be
 * driven directly from a hand-written Needs component in a test.
 *
 * Hunger and thirst kill. Sleep does not, and that is a rule rather than an
 * oversight: sleep only recovers while an animal's HERD is asleep, so nothing
 * outside a herd has any way to service it, and a lethal sleep need would kill
 * every lone animal and every person on a fixed timer with no counterplay.
 */
export function HandleNeedsDecay (registry : IRegistry, eventQueue : IEventQueue, random : IRandomNumberGenerator) {
    // Collected before anything dies. ForEachEntityWith iterates whichever queried
    // store is smallest and only promises that removing the CURRENTLY VISITED
    // entity's component is safe -- and killing does considerably more than that,
    // since it destroys one entity and creates another with a Needs-adjacent
    // component. PopulateHerds.RetireDistantHerds collects first for the same
    // reason.
    const loners : Entity[] = []
    const starvingByHerd = new Map<Entity, Entity[]>()

    registry.ForEachEntityWith([Needs], (entity, needs)=>{
        if (!IsStarving(needs)) return

        const herd = OwningHerd(registry, entity)

        if (herd === undefined) { loners.push(entity); return }

        const herdmates = starvingByHerd.get(herd)

        if (herdmates) herdmates.push(entity)
        else starvingByHerd.set(herd, [entity])
    })

    loners.forEach((entity)=>{KillEntity(registry, eventQueue, entity)})

    // One per herd per tick, chosen at random. Every member drains at the same
    // rate, so a herd arrives at zero all together -- killing everything that
    // qualifies would delete a herd of nine between one frame and the next. Losing
    // one animal a tick reads as a herd starving; losing all of them reads as a
    // bug. Random rather than first-found so it is not always the same member of
    // the list, which is the order they were spawned in.
    starvingByHerd.forEach((starving)=>{
        const unlucky = starving[Math.floor(random.Random() * starving.length)]

        if (unlucky !== undefined) KillEntity(registry, eventQueue, unlucky)
    })
}

/**
 * Whether these appetites have run out.
 *
 * Zero rather than below it, because Needs.Add clamps onto [0, 1] -- nothing can
 * ever hold a negative need, so testing for one would be testing for a state the
 * component makes unreachable.
 */
function IsStarving (needs : Needs) : boolean {
    return needs.hungerUnits <= 0 || needs.water <= 0
}

/**
 * The herd owning `entity`, or undefined if it belongs to no herd.
 *
 * Asked through OwnedBy rather than by looking for animals, because what makes a
 * death staggered is being part of a group that dies together -- and that is
 * exactly what having a herd owner means. Anything else, a person or a lone
 * animal, dies on its own account.
 */
function OwningHerd (registry : IRegistry, entity : Entity) : Entity | undefined {
    const ownedBy = registry.GetComponent(entity, OwnedBy)

    if (!ownedBy) return undefined
    if (!registry.IsAlive(ownedBy.owner)) return undefined

    return registry.GetComponent(ownedBy.owner, HerdOwner) ? ownedBy.owner : undefined
}
