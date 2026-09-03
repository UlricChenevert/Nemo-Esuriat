import { GameLoopChangedEvent } from "../Contracts/Events/GameLoopChangedEvent.ts";
import type { GameLoopLayer, ScheduleResources } from "../Contracts/Schedule.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";

/**
 * Every way the set of running systems can change, and the one place that
 * announces it.
 *
 * Free functions rather than methods on ScheduleResources so the resource stays
 * data -- the announcement needs the event queue, and a resource that reached
 * for the queue would be a resource that could not be constructed without one.
 */

export function PushLoopLayer (schedule : ScheduleResources, eventQueue : IEventQueue, layer : GameLoopLayer) : GameLoopLayer {
    schedule.stack.push(layer)
    PublishScheduleChange(schedule, eventQueue)

    return layer
}

export function PopLoopLayer (schedule : ScheduleResources, eventQueue : IEventQueue) : GameLoopLayer | undefined {
    const popped = schedule.stack.pop()

    if (popped === undefined) return undefined

    PublishScheduleChange(schedule, eventQueue)

    return popped
}

/**
 * Removes a specific layer wherever it sits, not just the top one.
 *
 * Menus close in stack order almost always, but a menu whose owner is destroyed
 * out from under it -- the player dying with a screen open -- would otherwise
 * leave its layer stranded above the gameplay layer forever.
 */
export function RemoveLoopLayer (schedule : ScheduleResources, eventQueue : IEventQueue, layer : GameLoopLayer) : boolean {
    const index = schedule.stack.indexOf(layer)

    if (index === -1) return false

    schedule.stack.splice(index, 1)
    PublishScheduleChange(schedule, eventQueue)

    return true
}

/**
 * Turns one system in one layer on or off.
 *
 * The finer-grained half of the same idea as pushing a layer: a mode that is
 * almost gameplay -- a cutscene that still streams terrain but takes no input --
 * is a couple of these rather than a whole layer duplicating eight entries.
 */
export function SetSystemEnabled (
    schedule : ScheduleResources,
    eventQueue : IEventQueue,
    layerName : string,
    systemName : string,
    enabled : boolean
) : boolean {
    const layer = schedule.stack.find((each)=>each.name === layerName)
    const system = layer?.Find(systemName)

    if (system === undefined) return false
    if (system.enabled === enabled) return false

    system.enabled = enabled

    // Only the top layer's contents describe what will actually run, so a change
    // to a dormant layer is real but not a change to the loop.
    if (layer === schedule.ActiveLayer()) PublishScheduleChange(schedule, eventQueue)

    return true
}

/**
 * Announces the new schedule, deferred by one frame.
 *
 * placeNext because these all happen mid-frame, from inside a system, and
 * GameLoop clears the queue at the end of that same frame -- an event enqueued
 * normally would be swept away before the frame the new layer actually runs on.
 * Deferring lands it on exactly the frame it describes.
 */
function PublishScheduleChange (schedule : ScheduleResources, eventQueue : IEventQueue) {
    eventQueue.EnqueueEvent(new GameLoopChangedEvent(schedule.ActiveLayer()?.name, schedule.ActiveSystemNames()), true)
}
