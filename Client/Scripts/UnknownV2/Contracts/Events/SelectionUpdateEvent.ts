import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import type { Entity } from "../Components/Entity.ts";

export class SelectionUpdateEvent implements IGameEvent {
    readonly type = "SelectionUpdate";
    
    constructor (public selectionUpdateSource : Entity, public newSelection : boolean) {}
}