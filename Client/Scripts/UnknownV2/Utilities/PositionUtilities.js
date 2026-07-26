import { GameWidth } from "../Configuration/GameConstants.js";
export function isNotWithinGameBorder(position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth);
}
export function isSamePosition(a, b) {
    return a.x == b.x && a.y == b.y;
}
//# sourceMappingURL=PositionUtilities.js.map