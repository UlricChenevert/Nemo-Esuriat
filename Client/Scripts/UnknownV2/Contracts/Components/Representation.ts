import type { Color } from "./Color.ts";

export class Representation {
    /**
     * @param fillsCell Paint the whole tile in `color` instead of drawing `model`.
     *
     * A glyph cannot fill its cell. Monospace advance width is around 0.6em, so
     * even the full-block character covers roughly six tenths of a tile's width
     * and a "solid" panel built from them comes out as vertical stripes. Sizing
     * the font up until the block did span the cell would make every letter
     * overflow into the rows above and below.
     *
     * So a solid tile is a rectangle, drawn by the same blit loop through the
     * same Z-buffer -- it layers against glyphs exactly as another glyph would.
     * `model` is kept for such representations because it is what tests and
     * debugging read to identify the tile.
     */
    constructor (public model : string, public color : Color, public fillsCell = false) {}

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
