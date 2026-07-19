import type { IClassConstructor } from "./IClassConstructor";
import type { IGameEvent } from "./IGameEvent";

export interface IEventQueue {
    EnqueueEvent(event : IGameEvent, placeNext? : boolean) : IEventQueue

    GetEventsOfType<T extends IGameEvent>(EventConstructor: IClassConstructor<T>): T[] 

    Clear() : void
}