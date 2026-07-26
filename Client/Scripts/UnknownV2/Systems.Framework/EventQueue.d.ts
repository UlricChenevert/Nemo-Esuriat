import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import { type IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IGameEvent } from "../Interfaces/IGameEvent.ts";
import { LinkedList } from "../libraries/FastList/FastList.ts";
export declare class EventQueue implements IEventQueue {
    Events: LinkedList<IGameEvent>;
    nextQueue: LinkedList<IGameEvent>;
    constructor(Events: LinkedList<IGameEvent>);
    EnqueueEvent(event: IGameEvent, placeNext?: boolean): this;
    GetEventsOfType<T extends IGameEvent>(EventConstructor: IClassConstructor<T>): T[];
    Clear(): void;
}
//# sourceMappingURL=EventQueue.d.ts.map