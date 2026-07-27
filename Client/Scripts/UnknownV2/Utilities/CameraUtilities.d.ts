import { Position } from "../Contracts/Components/Position.ts";
import type { Camera } from "../Contracts/SystemResources.ts";
/**
 * The world tile drawn at the viewport's top-left corner.
 *
 * The camera's origin is continuous -- PanCamera moves it by a fraction of a
 * tile every frame -- but the screen is a whole-tile grid, so somewhere the
 * origin has to become an integer. That happens here, once, and both the
 * renderer and click handling go through it.
 *
 * Sharing the floor is the point, not a convenience. If the two floored
 * independently, or one floored while the other truncated, a click would land a
 * tile away from the glyph the player aimed at for half of all pan offsets --
 * and only for negative coordinates, which is the hardest kind of bug to catch.
 */
export declare function CameraTileOrigin(camera: Camera): {
    originX: number;
    originY: number;
};
/**
 * The world tile shown at a given screen tile: the inverse of the mapping
 * RenderCanvas draws with.
 */
export declare function WorldTileOfScreenTile(camera: Camera, screenX: number, screenY: number): Position;
//# sourceMappingURL=CameraUtilities.d.ts.map