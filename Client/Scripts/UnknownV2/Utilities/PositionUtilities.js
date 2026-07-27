import { GameWidth } from "../Configuration/GameConstants.js";
export function isNotWithinGameBorder(position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth);
}
export function isSamePosition(a, b) {
    return a.x == b.x && a.y == b.y;
}
/**
 * Whether two positions fall on the same tile.
 *
 * Distinct from isSamePosition, which is exact. Positions became continuous when
 * HandleMovement started advancing entities by a fractional speed per tick, so
 * an entity mid-step between (50,50) and (51,50) is at no integer position at
 * all -- exact comparison against a click, which is always a whole tile, would
 * never match it.
 */
export function isSameTile(a, b) {
    return Math.floor(a.x) == Math.floor(b.x) && Math.floor(a.y) == Math.floor(b.y);
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