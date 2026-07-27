import type { Color } from "./Color.ts";
export declare class Representation {
    model: string;
    color: Color;
    constructor(model: string, color: Color);
    private cachedFillStyle;
    private cachedColor;
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
    FillStyle(): string;
}
//# sourceMappingURL=Representation.d.ts.map