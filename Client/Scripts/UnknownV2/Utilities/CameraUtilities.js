import { Position } from "../Contracts/Components/Position.js";
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
export function CameraTileOrigin(camera) {
    // Math.floor rather than truncation, so an origin of -0.5 is tile -1 rather
    // than sharing tile 0 with +0.5 and making the origin row twice as tall.
    return { originX: Math.floor(camera.worldOriginX), originY: Math.floor(camera.worldOriginY) };
}
/**
 * The world tile shown at a given screen tile: the inverse of the mapping
 * RenderCanvas draws with.
 */
export function WorldTileOfScreenTile(camera, screenX, screenY) {
    const { originX, originY } = CameraTileOrigin(camera);
    return new Position(originX + screenX, originY + screenY);
}
//# sourceMappingURL=CameraUtilities.js.map