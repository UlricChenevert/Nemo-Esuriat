import { GameWidth } from "../Configuration/GameConstants.js";
import { FindPlayerPosition } from "../Utilities/PlayerUtilities.js";
/**
 * Centres the viewport on the player.
 *
 * No clamping: the world is unbounded in every direction. If a finite world is
 * ever wanted, the limits belong here rather than in the renderer, so that the
 * renderer keeps knowing only how to draw what the camera points at.
 *
 * With no player the camera holds its last position instead of snapping to the
 * origin, so a frame between the player being destroyed and replaced does not
 * jump the view.
 */
export function UpdateCamera(registry, camera) {
    const playerPosition = FindPlayerPosition(registry);
    if (playerPosition === undefined)
        return;
    const halfViewport = Math.floor(GameWidth / 2);
    camera.worldOriginX = playerPosition.x - halfViewport;
    camera.worldOriginY = playerPosition.y - halfViewport;
}
//# sourceMappingURL=UpdateCamera.js.map