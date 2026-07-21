export class Color {
    constructor(public red : number, public green : number, public blue : number, public opacity : number = 255) {}
    ToHex() {
        const clamp = (x : number) => Math.max(0, Math.min(255, Math.round(x)))
        return '#' + [this.red, this.green, this.blue, this.opacity]
        .map(x => clamp(x).toString(16).padStart(2, '0'))
        .join('');
    }
    Copy() {
        return new Color(this.red, this.green, this.blue, this.opacity)
    }
}