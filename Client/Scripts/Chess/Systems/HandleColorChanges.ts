import { Representation } from "../Contracts/Representation.ts";
import { SelectionUpdateEvent } from "../Contracts/SelectionUpdate.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { TranslateColor } from "../Utilities/ColorUtilites.ts";

export function HandleColorChanges (registry : IRegistry, eventQueue : IEventQueue) {
    const selectionEvents = eventQueue.GetEventsOfType(SelectionUpdateEvent)
    
    selectionEvents.forEach((event)=>{
        const colorRef = registry.GetComponent(event.selectionUpdateSource, Representation)?.color

        if (!colorRef) return

        if (event.newSelection) {
            TranslateColor(colorRef, 1)
        } else {
            TranslateColor(colorRef, -1)
        }
    })
    
}
        