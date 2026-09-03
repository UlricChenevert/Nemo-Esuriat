import type { IEventQueue } from "../Interfaces/IEventQueue.ts";

/**
 * Prints this frame's events.
 *
 * This used to live inside EventQueue.Clear, which meant the queue logged every event of
 * every frame unconditionally and from inside a data structure -- noise nobody asked for,
 * in release, drowning anything else anyone was trying to read.
 *
 * As a system it is somebody's decision instead: scheduled last in a layer when
 * GameConstants.Debug is set, and simply absent otherwise. Last is what makes it see the
 * whole frame -- GameLoop clears the queue after the active layer's systems have run, so
 * "last in the layer" already means "everything that happened, just before it is thrown
 * away", with no new ordering machinery to arrange it.
 */
export function LogEventQueue (eventQueue : IEventQueue) {
    const events = eventQueue.GetAllEvents()

    if (events.length == 0) return

    console.debug(`[events] ${events.length}`, events)
}
