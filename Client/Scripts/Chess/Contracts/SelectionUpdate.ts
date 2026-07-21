import type { IGameEvent } from "../Interfaces/IGameEvent";
import type { Entity } from "./Entity";

export class SelectionUpdateEvent implements IGameEvent {
    readonly type = "SelectionUpdate";
    
    constructor (public selectionUpdateSource : Entity, public newSelection : boolean) {}
}