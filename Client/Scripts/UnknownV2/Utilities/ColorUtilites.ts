import { ColorTranslation } from "../Configuration/DisplayConstants.ts";
import type { Color } from "../Contracts/Components/Color.ts";

export function TranslateColor (color : Color, direction : -1 | 1, amount = ColorTranslation) {
    color.red = Math.max(Math.min(color.red + amount * direction, 255), 0), 
    color.green = Math.max(Math.min(color.green + amount * direction, 255), 0), 
    color.blue = Math.max(Math.min(color.blue + amount * direction, 255), 0)
}