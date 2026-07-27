import type { Position } from "../Contracts/Components/Position.ts";
export declare function isNotWithinGameBorder(position: Position): boolean;
export declare function isSamePosition(a: Position, b: Position): boolean;
/**
 * Whether two positions fall on the same tile.
 *
 * Distinct from isSamePosition, which is exact. Positions became continuous when
 * HandleMovement started advancing entities by a fractional speed per tick, so
 * an entity mid-step between (50,50) and (51,50) is at no integer position at
 * all -- exact comparison against a click, which is always a whole tile, would
 * never match it.
 */
export declare function isSameTile(a: Position, b: Position): boolean;
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