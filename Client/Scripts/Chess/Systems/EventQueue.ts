import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import { type IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import { LinkedList } from "../libraries/FastList/FastList.ts";

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

    Clear(): void {
        this.Events = this.nextQueue
        this.nextQueue = new LinkedList()
    }
}