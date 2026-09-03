import type { Entity } from "../Components/Entity.ts";
import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";

/**
 * Something died, and this is what it left behind.
 *
 * Published by KillEntity, which is the only path from alive to dead. An event
 * rather than a direct call because who cares about a death is not knowable from
 * where it happens: starvation and hunting both produce one, and what reacts --
 * the defeat check today, a scavenger or a score tomorrow -- has nothing to say
 * to either of them.
 *
 * `entity` is already destroyed by the time this is read, so it is an identity to
 * compare against and not a handle to query. Anything a consumer needs about the
 * deceased has to come off `corpse`, which is why the corpse inherits its
 * position and its Consumable.
 */
export class EntityDiedEvent implements IGameEvent {
    readonly type = "EntityDied";

    constructor (public entity : Entity, public corpse : Entity) {}
}
