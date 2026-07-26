import type { Camera } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
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
export declare function UpdateCamera(registry: IRegistry, camera: Camera): void;
//# sourceMappingURL=UpdateCamera.d.ts.map