import type { IGameEvent } from "../Interfaces/IGameEvent";
import type { Entity } from "./Entity";
export declare class SelectionUpdateEvent implements IGameEvent {
    selectionUpdateSource: Entity;
    newSelection: boolean;
    readonly type = "SelectionUpdate";
    constructor(selectionUpdateSource: Entity, newSelection: boolean);
}
//# sourceMappingURL=SelectionUpdate.d.ts.map