export class Position {
    constructor(public x : number, public y : number) {}
    Copy() {
        return new Position(this.x, this.y)
    }
}