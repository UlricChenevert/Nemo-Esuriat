// Attached to the PLAYER doing the selecting, not to the selected entity.
// `source` is the piece that was picked up; `destination` is the tile it will
// move to, and stays undefined until the player's second click.
export class SelectionState {
    source;
    MovementFlag;
    constructor(source, MovementFlag) {
        this.source = source;
        this.MovementFlag = MovementFlag;
    }
}
//# sourceMappingURL=SelectionState.js.map