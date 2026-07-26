import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";

export class GameKeyboardEvent implements IGameEvent {
    readonly type = "KeyboardEvent";
    altKey : boolean
    shiftKey : boolean
    ctrlKey : boolean
    metaKey : boolean
    code : string
    
    constructor (baseEvent : KeyboardEvent) {
        this.altKey = baseEvent.altKey
        this.shiftKey = baseEvent.shiftKey
        this.ctrlKey = baseEvent.ctrlKey
        this.metaKey = baseEvent.metaKey
        this.code = baseEvent.code
    }
}