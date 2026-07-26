import type { Position } from "../Contracts/Components/Position.ts";
export declare function isNotWithinGameBorder(position: Position): boolean;
export declare function isSamePosition(a: Position, b: Position): boolean;
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
export declare function IsOutsideViewport(screenX: number, screenY: number): boolean;
//# sourceMappingURL=PositionUtilities.d.ts.map