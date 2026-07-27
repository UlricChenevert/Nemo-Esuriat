import { Color } from "../Contracts/Components/Color.ts";
/**
 * A copy of the colour with every channel scaled, clamped to the byte range.
 *
 * Multiplicative rather than additive so a dark hue and a bright one shade by
 * the same proportion; adding a fixed amount would wash out the dark end and
 * barely move the bright one. Pure, unlike TranslateColor, because it is used to
 * build shared palette tables where mutating the source colour would corrupt
 * every entry derived from it.
 */
export declare function ScaleColorBrightness(color: Color, factor: number): Color;
/**
 * A blend of two colours, `amount` 0 giving the first and 1 giving the second.
 *
 * Used to pull a terrain band's far end toward the terrain above it, so grass
 * turns earthy before it becomes hill and hill turns stony before it becomes
 * mountain, rather than each band staying its own flat hue up to the boundary.
 */
export declare function MixColors(from: Color, to: Color, amount: number): Color;
export declare function TranslateColor(color: Color, direction: -1 | 1, amount?: number): void;
//# sourceMappingURL=ColorUtilites.d.ts.map