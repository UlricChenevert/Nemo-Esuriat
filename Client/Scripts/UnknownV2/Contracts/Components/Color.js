export class Color {
    red;
    green;
    blue;
    opacity;
    constructor(red, green, blue, opacity = 255) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.opacity = opacity;
    }
    ToHex() {
        const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
        return '#' + [this.red, this.green, this.blue, this.opacity]
            .map(x => clamp(x).toString(16).padStart(2, '0'))
            .join('');
    }
    Copy() {
        return new Color(this.red, this.green, this.blue, this.opacity);
    }
}
//# sourceMappingURL=Color.js.map