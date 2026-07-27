export class GameKeyboardEvent {
    type = "KeyboardEvent";
    altKey;
    shiftKey;
    ctrlKey;
    metaKey;
    code;
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
    isPressed;
    constructor(baseEvent, isPressed = true) {
        this.isPressed = isPressed;
        this.altKey = baseEvent.altKey;
        this.shiftKey = baseEvent.shiftKey;
        this.ctrlKey = baseEvent.ctrlKey;
        this.metaKey = baseEvent.metaKey;
        this.code = baseEvent.code;
    }
}
//# sourceMappingURL=KeyBoardEvent.js.map