import { ColorTranslation } from "../Configuration/DisplayConstants.js";
export function TranslateColor(color, direction, amount = ColorTranslation) {
    color.red = Math.max(Math.min(color.red + amount * direction, 255), 0),
        color.green = Math.max(Math.min(color.green + amount * direction, 255), 0),
        color.blue = Math.max(Math.min(color.blue + amount * direction, 255), 0);
}
//# sourceMappingURL=ColorUtilites.js.map