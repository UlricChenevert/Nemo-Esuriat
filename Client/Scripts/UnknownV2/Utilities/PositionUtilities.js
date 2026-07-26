import { GameWidth } from "../Configuration/GameConstants.js";
export function isNotWithinGameBorder(position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth);
}
export function isSamePosition(a, b) {
    return a.x == b.x && a.y == b.y;
}
/**
 * Whether a screen-space tile falls outside the visible area.
 *
 * Distinct from isNotWithinGameBorder, which tests world space. Once the camera
 * can move, the two stop meaning the same thing: a tile at world (-40, 10) is
 * outside the world border but perfectly visible when the camera has scrolled
 * there.
 *
 * Takes coordinates rather than a Position because the renderer calls it once
 * per tile, and building a throwaway Position for each would allocate thousands
 * of objects per frame.
 */
export function IsOutsideViewport(screenX, screenY) {
    return (screenX < 0 || screenX >= GameWidth || screenY < 0 || screenY >= GameWidth);
}
//# sourceMappingURL=PositionUtilities.js.map