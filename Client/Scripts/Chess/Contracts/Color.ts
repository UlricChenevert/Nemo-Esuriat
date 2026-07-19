export class Color {
    constructor(public red : number, public green : number, public blue : number, public opacity : number = 1) {}
    ToHex() {
        return '#' + [this.red, this.green, this.blue]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
    }
}