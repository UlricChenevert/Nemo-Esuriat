import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
export declare class GameKeyboardEvent implements IGameEvent {
    readonly type = "KeyboardEvent";
    altKey: boolean;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    code: string;
    /**
     * True for a press, false for a release.
     *
     * Carried on the event because panning is continuous: the camera needs to
     * know a key is still down on frames where the browser sends no event at
     * all, which means tracking press and release rather than reacting to
     * individual keystrokes.
     *
     * Defaults to a press so the many call sites that only ever meant "this key
     * was pressed" read the same as before.
     */
    isPressed: boolean;
    constructor(baseEvent: KeyboardEvent, isPressed?: boolean);
}
//# sourceMappingURL=KeyBoardEvent.d.ts.map