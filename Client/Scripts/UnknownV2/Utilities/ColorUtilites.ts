import { ColorTranslation } from "../Configuration/DisplayConstants.ts";
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
export function ScaleColorBrightness (color : Color, factor : number) : Color {
    const scale = (channel : number) => Math.max(0, Math.min(255, Math.round(channel * factor)))

    return new Color(scale(color.red), scale(color.green), scale(color.blue), color.opacity)
}

/**
 * A blend of two colours, `amount` 0 giving the first and 1 giving the second.
 *
 * Used to pull a terrain band's far end toward the terrain above it, so grass
 * turns earthy before it becomes hill and hill turns stony before it becomes
 * mountain, rather than each band staying its own flat hue up to the boundary.
 */
export function MixColors (from : Color, to : Color, amount : number) : Color {
    const blend = (start : number, end : number) => Math.round(start + (end - start) * amount)

    return new Color(blend(from.red, to.red), blend(from.green, to.green), blend(from.blue, to.blue), from.opacity)
}

export function TranslateColor (color : Color, direction : -1 | 1, amount = ColorTranslation) {
    color.red = Math.max(Math.min(color.red + amount * direction, 255), 0), 
    color.green = Math.max(Math.min(color.green + amount * direction, 255), 0), 
    color.blue = Math.max(Math.min(color.blue + amount * direction, 255), 0)
}