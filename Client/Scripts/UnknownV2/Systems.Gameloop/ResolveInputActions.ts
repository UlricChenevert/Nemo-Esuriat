import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { GameKeyboardEvent } from "../Contracts/Events/KeyBoardEvent.ts";
import type { InputResources } from "../Contracts/SystemResources.ts";
import type { GameAction } from "../Contracts/Actions/GameActions.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { PruneDeadLayers, ResolveTopClaimingLayer } from "../Systems.Framework/InputLayerStack.ts";

/**
 * The whole key-to-listener pipeline, in one place: keys become actions, actions
 * are routed to exactly one layer, and that layer's listeners get them.
 *
 * Routing is per action rather than per layer. A layer intercepts only what its
 * listeners claim and everything else falls through, which is what lets a
 * submenu take Up/Down/Confirm while leaving the rest of the stack's bindings
 * untouched for when it pops. Where that is too permissive -- the seam between
 * menus and the running game -- a blackout layer claims everything and drops it.
 *
 * Delivery goes into components rather than onto the event queue because the
 * consumers are entities: the camera reads its own listener, a menu reads its
 * own, and neither has to scan a queue and work out whether an event was meant
 * for it. The queue is still where keys arrive from.
 */
export function ResolveInputActions (registry : IRegistry, eventQueue : IEventQueue, input : InputResources) {
    // A menu destroyed last frame took its layers with it, and a dead layer at
    // the top of the stack would swallow input for the rest of the session.
    PruneDeadLayers(registry, input)

    const pressedThisFrame = DrainKeyboardEvents(eventQueue, input)

    // Grouped once so routing a hundred actions does not walk every listener a
    // hundred times.
    const listenersByLayer = new Map<Entity, ActionListener[]>()

    registry.ForEachEntityWith([ActionListener], (_entity, listener) => {
        // Cleared here rather than in a separate pass: every listener is visited
        // exactly once anyway, and a listener whose layer has been popped still
        // gets emptied, so it does not hold last frame's actions forever.
        listener.triggered.clear()
        listener.held.clear()

        const existing = listenersByLayer.get(listener.layer)

        if (existing) existing.push(listener)
        else listenersByLayer.set(listener.layer, [listener])
    })

    /**
     * The listeners that should receive `action`, or undefined if nothing hears
     * it -- including the case where a blackout layer deliberately eats it.
     *
     * The walk itself lives in InputLayerStack, shared with the click resolver: keys and
     * clicks are different kinds of input asking the same question of the same stack, and
     * two copies of it would be two places for the blackout rule to drift.
     */
    const ResolveAction = (action : GameAction) : ActionListener[] | undefined =>
        ResolveTopClaimingLayer(registry, input, listenersByLayer, (listener)=>listener.actions.has(action))

    // Rebuilt from the held set every frame rather than tracked incrementally,
    // so a layer pushed while a key is down stops the old listener on the very
    // next frame instead of leaving the camera scrolling until release.
    for (const heldCode of input.heldKeyCodes) {
        const action = input.bindings.ActionForCode(heldCode)

        if (action === undefined) continue

        for (const listener of ResolveAction(action) ?? []) listener.held.add(action)
    }

    for (const action of pressedThisFrame) {
        for (const listener of ResolveAction(action) ?? []) listener.triggered.add(action)
    }
}

/**
 * Folds this frame's key events into the held set and returns the actions that
 * saw a press edge.
 *
 * The rules here are the ones PanCamera used to own, kept verbatim because each
 * was a bug once: a release lifts the key whatever modifiers are down, so
 * holding W and tapping ctrl cannot stick the camera scrolling; a modified press
 * belongs to a browser or OS shortcut and is not the game's to take; shift alone
 * is not a modifier for this purpose and still counts as a press.
 */
function DrainKeyboardEvents (eventQueue : IEventQueue, input : InputResources) : Set<GameAction> {
    const pressed = new Set<GameAction>()

    for (const keyboardEvent of eventQueue.GetEventsOfType(GameKeyboardEvent)) {
        const action = input.bindings.ActionForCode(keyboardEvent.code)

        if (action === undefined) continue

        if (!keyboardEvent.isPressed) {
            input.heldKeyCodes.delete(keyboardEvent.code)
            continue
        }

        if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) continue

        // The browser repeats a held key, and every repeat is another keydown.
        // Only the first is an edge: without this, holding Confirm on a menu
        // would re-invoke the selected item at the OS repeat rate.
        if (!input.heldKeyCodes.has(keyboardEvent.code)) pressed.add(action)

        input.heldKeyCodes.add(keyboardEvent.code)
    }

    return pressed
}
