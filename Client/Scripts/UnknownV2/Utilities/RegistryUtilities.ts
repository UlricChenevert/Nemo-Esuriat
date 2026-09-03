import { type Entity, EntityHandle } from "../Contracts/Components/Entity.ts";
import type { ComponentInstances } from "../Interfaces/ComponentInstances.ts";
import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * The one entity carrying all of `components`, or undefined when there is none.
 *
 * Throws if a second one exists. Written once here rather than per consumer,
 * because "there is exactly one of these" is a rule about the world and every
 * system that reads such an entity has to agree on it — five systems each
 * keeping their own first-match-wins loop is five places for that rule to drift.
 *
 * `label` names the thing in the error, so the message says which singleton was
 * duplicated rather than listing component classes.
 *
 * Throwing rather than picking the first: a duplicate singleton is a bug at the
 * point of creation, but a silent first-wins only shows up much later as
 * behaviour that depends on the iteration order of a hash map.
 *
 * The scan itself is not a cost worth avoiding. ForEachEntityWith walks the
 * smallest matching component store, and a singleton's marker store holds one
 * entry — so resolving this per system per frame is one iteration, which is what
 * makes querying for it cheaper than caching a handle that could go stale.
 */
export function FindUniqueEntityWith<const T extends readonly IClassConstructor<unknown>[]>(
    registry : IRegistry, components : [...T], label : string
) : Entity | undefined {
    let foundEntity : Entity | undefined

    // The rest parameter is only here to match ForEachEntityWith's callback
    // shape; which components the singleton carries is the caller's business,
    // not this function's.
    registry.ForEachEntityWith(components, (entity : Entity, ..._components : ComponentInstances<T>) => {
        if (foundEntity !== undefined) {
            throw new Error(
                `More than one ${label} exists: ${EntityHandle.ToString(foundEntity)} and ${EntityHandle.ToString(entity)}. ` +
                `Exactly one entity may carry this component set.`
            )
        }

        foundEntity = entity
    })

    return foundEntity
}
