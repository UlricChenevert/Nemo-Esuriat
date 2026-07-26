export class SelectionUpdateEvent {
    selectionUpdateSource;
    newSelection;
    type = "SelectionUpdate";
    constructor(selectionUpdateSource, newSelection) {
        this.selectionUpdateSource = selectionUpdateSource;
        this.newSelection = newSelection;
    }
}
//# sourceMappingURL=SelectionUpdateEvent.js.map