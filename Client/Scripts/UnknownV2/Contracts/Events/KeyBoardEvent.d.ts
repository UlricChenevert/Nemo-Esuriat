import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
export declare class GameKeyboardEvent implements IGameEvent {
    readonly type = "KeyboardEvent";
    altKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    code: string;
    constructor(baseEvent: KeyboardEvent);
}
//# sourceMappingURL=KeyBoardEvent.d.ts.map