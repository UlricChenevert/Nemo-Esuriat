import { ClickGesture, type ClickGestureValue } from "../Contracts/Actions/GameActions.ts";
import { ClickListener } from "../Contracts/Components/ClickListener.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { GameClickEvent } from "../Contracts/Events/GameClickEvent.ts";
import type { InputResources } from "../Contracts/SystemResources.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { ResolveTopClaimingLayer } from "../Systems.Framework/InputLayerStack.ts";

/**
 * Routes this frame's clicks to exactly one layer each, the way ResolveInputActions
 * routes keys.
 *
 * Clicks used to bypass the layer stack altogether: HandleInputEvents pulled them
 * straight off the event queue, and since GetEventsOfType is a non-destructive filter
 * with no notion of consumption, a pushed layer had no way to intercept one. Anything
 * wanting to claim a click had to special-case itself inside whichever gameplay system
 * read it first -- which is the arrangement the layer stack exists to make unnecessary.
 *
 * Delivery goes into components rather than back onto the queue for the same reason the
 * action pipeline does it: the consumers are entities, and an entity reading its own
 * mailbox never has to work out whether an event was meant for it.
 *
 * Runs immediately after ResolveInputActions, which has already pruned dead layers this
 * frame -- so this can trust the stack it walks.
 */
export function ResolveClickTargets (registry : IRegistry, eventQueue : IEventQueue, input : InputResources) {
    const listenersByLayer = new Map<Entity, ClickListener[]>()

    registry.ForEachEntityWith([ClickListener], (_entity, listener) => {
        // Emptied here rather than in a separate pass: every listener is visited exactly
        // once anyway, and a listener whose layer has been buried still gets cleared, so
        // it does not hold last frame's clicks forever.
        listener.clicks.length = 0

        const existing = listenersByLayer.get(listener.layer)

        if (existing) existing.push(listener)
        else listenersByLayer.set(listener.layer, [listener])
    })

    for (const clickEvent of eventQueue.GetEventsOfType(GameClickEvent)) {
        const gesture = GestureOf(clickEvent)

        const claimants = ResolveTopClaimingLayer(
            registry, input, listenersByLayer, (listener)=>listener.gesture === gesture
        )

        for (const listener of claimants ?? []) listener.clicks.push(clickEvent)
    }
}

/**
 * Which gesture a click is.
 *
 * The one place in the game that looks at a modifier key on a click. Everything
 * downstream asks about the gesture instead, so "which button and which modifier mean
 * inspect" is a single decision rather than a condition repeated at each consumer.
 */
function GestureOf (clickEvent : GameClickEvent) : ClickGestureValue {
    return clickEvent.ctrlKey ? ClickGesture.Control : ClickGesture.Plain
}
