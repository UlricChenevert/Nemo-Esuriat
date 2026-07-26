export class GameKeyboardEvent {
    type = "KeyboardEvent";
    altKey;
    shiftKey;
    ctrlKey;
    metaKey;
    code;
    constructor(baseEvent) {
        this.altKey = baseEvent.altKey;
        this.shiftKey = baseEvent.shiftKey;
        this.ctrlKey = baseEvent.ctrlKey;
        this.metaKey = baseEvent.metaKey;
        this.code = baseEvent.code;
    }
}
//# sourceMappingURL=KeyBoardEvent.js.map