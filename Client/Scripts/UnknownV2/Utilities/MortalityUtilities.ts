import { AnimalLayer, CharacterRepresentation, GameColors } from "../Configuration/DisplayConstants.ts";
import { Consumable } from "../Contracts/Components/Consumable.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { EntityDiedEvent } from "../Contracts/Events/EntityDiedEvent.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";

/**
 * Kills `entity`, leaves its body where it fell, and announces it. Returns the
 * corpse, or undefined if there was nothing to kill.
 *
 * The only path from alive to dead. That is the whole point of it being here
 * rather than inline in the two systems that need it: starvation and being hunted
 * must produce the same corpse, or "eat what killed itself" and "eat what you
 * killed" become two mechanics that drift apart. It is also what makes a player
 * dying uniform with anything else dying -- there is no branch to forget.
 *
 * Bodiless entities are killed without leaving anything. A herd owner has no
 * Position of the kind a corpse could occupy, and a corpse of it would be a body
 * that never existed.
 */
export function KillEntity (registry : IRegistry, eventQueue : IEventQueue, entity : Entity) : Entity | undefined {
    if (!registry.IsAlive(entity)) return undefined

    const position = registry.GetComponent(entity, Position)
    const consumable = registry.GetComponent(entity, Consumable)

    // Read before the destroy, not after: every component goes with the entity,
    // so the corpse has to be built from what was copied out first.
    const restingPlace = position?.Copy()

    registry.DestroyEntity(entity)

    if (restingPlace === undefined) return undefined

    // Unowned on purpose. Corpses are not herd members -- SenseHerd decides
    // membership on IsMoveable, which a body does not have -- so a dead animal
    // neither drags its herd's centroid back to where it died nor counts toward
    // the herd being alive at all.
    const corpse = new EntityBuilder(registry)
        .AddPosition(restingPlace)
        .AddRepresentation(new Representation(CharacterRepresentation.DeadAnimal, GameColors.Carcass))
        .AddLayer(new Layer(AnimalLayer))
        .AddCarcass()
        // Whatever the living thing was worth, inherited rather than re-decided.
        // Nothing edible means a corpse worth nothing, which is still a corpse.
        .AddConsumable(consumable?.hungerUnits ?? 0)
        .GetEntity()

    eventQueue.EnqueueEvent(new EntityDiedEvent(entity, corpse))

    return corpse
}
