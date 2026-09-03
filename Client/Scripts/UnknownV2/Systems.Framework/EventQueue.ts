import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import { type IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import { LinkedList } from "../Libraries/FastList/FastList.ts";

export class EventQueue implements IEventQueue {
    nextQueue = new LinkedList<IGameEvent>()

    constructor (public Events : LinkedList<IGameEvent>) {}

    EnqueueEvent(event : IGameEvent, placeNext : boolean = false) {
        if (placeNext) {this.nextQueue.push(event); return this}

        this.Events.push(event)

        return this
    }
    
    GetEventsOfType<T extends IGameEvent>(EventConstructor: IClassConstructor<T>): T[] {
        return this.Events.filter((event): event is T => event instanceof EventConstructor).ToList()
    }

    GetAllEvents(): IGameEvent[] {
        return this.Events.ToList()
    }

    /**
     * Retires this frame's events and promotes the ones deferred to the next.
     *
     * Deliberately silent. This used to console.debug every event on its way out, which
     * meant the queue logged unconditionally, in release, from inside a data structure --
     * and buried anything else anybody was trying to read. Wanting that trace is a
     * debugging choice, so it belongs to a system somebody schedules (LogEventQueue),
     * not to the queue itself.
     */
    Clear(): void {
        this.Events = this.nextQueue
        this.nextQueue = new LinkedList()
    }
}