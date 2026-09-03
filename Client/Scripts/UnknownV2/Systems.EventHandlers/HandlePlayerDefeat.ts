import { OpenDeathMenu } from "../Configuration/Menus.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import { EntityDiedEvent } from "../Contracts/Events/EntityDiedEvent.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { FindActingPlayer, FindPlayerHumans } from "../Utilities/PlayerUtilities.ts";

/**
 * Reacts to a death on the player's side: drops a selection that died with it, and
 * ends the game once there is nobody left to control.
 *
 * Driven off EntityDiedEvent rather than checking every frame, because "has the
 * player run out of humans" is only worth asking on the frames where the answer
 * can have changed -- and the same events are what tell it whether the thing it
 * was pointing at is still there.
 *
 * Defeat is deliberately not "the player's body died". The player is a bodiless
 * controller that may own several humans, so losing one is a setback and losing the
 * last is the end. Written against the count for exactly that reason: identifying
 * the player with one particular body would make the first death final and the
 * others invisible.
 */
export function HandlePlayerDefeat (context : ISystemContext) {
    const { registry, eventQueue } = context

    const deaths = eventQueue.GetEventsOfType(EntityDiedEvent)

    if (deaths.length == 0) return

    const player = FindActingPlayer(registry)

    if (player === undefined) return

    DropDeadSelection(registry, player)

    if (FindPlayerHumans(registry, player).length > 0) return

    OpenDeathMenu(context)
}

/**
 * Clears the selection if what was selected has died.
 *
 * Nothing else notices: SelectionState holds a raw handle, and DestroyEntity has no
 * way to reach into a component on another entity to blank it. Left alone, the next
 * click would hand a TargetLocation to a destroyed entity and the readout would go
 * on reporting the appetites of something that no longer exists.
 *
 * The movement flag goes with it. It is owned by the player rather than by the
 * body, so it survives the death it was pointing the way for and would otherwise
 * sit on the map as a marker for a journey nobody is making.
 */
function DropDeadSelection (registry : IRegistry, player : Entity) {
    const selection = registry.GetComponent(player, SelectionState)

    if (selection === undefined) return
    if (registry.IsAlive(selection.source)) return

    if (selection.MovementFlag !== undefined) registry.DestroyEntity(selection.MovementFlag)

    registry.RemoveComponent(player, SelectionState)
}
