import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import type { Entity } from "../Components/Entity.ts";
export declare class SelectionUpdateEvent implements IGameEvent {
    selectionUpdateSource: Entity;
    newSelection: boolean;
    readonly type = "SelectionUpdate";
    constructor(selectionUpdateSource: Entity, newSelection: boolean);
}
//# sourceMappingURL=SelectionUpdateEvent.d.ts.map