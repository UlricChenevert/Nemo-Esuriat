import type { Color } from "./Color.ts";

export class Representation {
    constructor (public model : string, public color : Color) {}

    private cachedFillStyle : string | undefined
    private cachedColor : Color | undefined

    /**
     * The canvas fillStyle for this representation's colour.
     *
     * Cached because terrain shading widened the palette from four colours to
     * thirty-two: the renderer compares a style string per tile to decide whether
     * the context needs updating, and rebuilding that string for every one of
     * thousands of tiles every frame is pure waste when a palette entry's colour
     * almost never changes.
     *
     * Keyed on the colour object's identity, so assigning a new Color to a
     * representation is picked up. Mutating a Color's channels in place is not —
     * TranslateColor does exactly that, so call it only on a Color that no
     * representation is holding, or assign a fresh Color instead.
     */
    FillStyle () : string {
        if (this.cachedFillStyle === undefined || this.cachedColor !== this.color) {
            const { red, green, blue, opacity } = this.color

            this.cachedFillStyle = `rgba(${red},${green},${blue},${opacity})`
            this.cachedColor = this.color
        }

        return this.cachedFillStyle
    }
}
