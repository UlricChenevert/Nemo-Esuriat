import {} from "../Interfaces/IEventQueue.js";
import { LinkedList } from "../libraries/FastList/FastList.js";
export class EventQueue {
    Events;
    nextQueue = new LinkedList();
    constructor(Events) {
        this.Events = Events;
    }
    EnqueueEvent(event, placeNext = false) {
        if (placeNext) {
            this.nextQueue.push(event);
            return this;
        }
        this.Events.push(event);
        return this;
    }
    GetEventsOfType(EventConstructor) {
        return this.Events.filter((event) => event instanceof EventConstructor).ToList();
    }
    Clear() {
        this.Events = this.nextQueue;
        this.Events.forEach((event) => { console.debug(event); });
        this.nextQueue = new LinkedList();
    }
}
//# sourceMappingURL=EventQueue.js.map