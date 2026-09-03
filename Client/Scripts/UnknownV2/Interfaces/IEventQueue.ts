import type { IClassConstructor } from "./IClassConstructor.ts";
import type { IGameEvent } from "./IGameEvent.ts";

export interface IEventQueue {
    EnqueueEvent(event : IGameEvent, placeNext? : boolean) : IEventQueue

    GetEventsOfType<T extends IGameEvent>(EventConstructor: IClassConstructor<T>): T[]

    /**
     * Everything queued for this frame, of every type.
     *
     * For diagnostics rather than for gameplay: a system that acts on events should say
     * which kind it wants, so that what it consumes is legible at the call site. This is
     * for the debug trace, which by definition wants whatever turned up.
     */
    GetAllEvents() : IGameEvent[]

    Clear() : void
}