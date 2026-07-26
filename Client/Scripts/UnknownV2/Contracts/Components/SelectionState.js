// Attached to the PLAYER doing the selecting, not to the selected entity.
// `source` is the piece that was picked up; `destination` is the tile it will
// move to, and stays undefined until the player's second click.
export class SelectionState {
    source;
    destination;
    constructor(source, destination) {
        this.source = source;
        this.destination = destination;
    }
}
//# sourceMappingURL=SelectionState.js.map