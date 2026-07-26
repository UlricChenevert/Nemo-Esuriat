import type { IClassConstructor } from "./IClassConstructor.ts";
import type { IGameEvent } from "./IGameEvent.ts";
export interface IEventQueue {
    EnqueueEvent(event: IGameEvent, placeNext?: boolean): IEventQueue;
    GetEventsOfType<T extends IGameEvent>(EventConstructor: IClassConstructor<T>): T[];
    Clear(): void;
}
//# sourceMappingURL=IEventQueue.d.ts.map