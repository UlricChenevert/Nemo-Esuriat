import type { Camera } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
/**
 * Puts the player at the centre of the viewport.
 *
 * Called once at startup rather than every frame: the camera is free, and
 * PanCamera is the only thing that moves it afterwards. Re-centring per frame
 * would undo any pan as soon as anything moved, which is exactly what a free
 * camera is not. It stays its own system, rather than being inlined into
 * initialization, because a "recentre on my units" key is the obvious next thing
 * to want and this is already what it would do.
 *
 * No clamping: the world is unbounded in every direction. If a finite world is
 * ever wanted, the limits belong here rather than in the renderer, so that the
 * renderer keeps knowing only how to draw what the camera points at.
 *
 * With no player the camera holds its last position instead of snapping to the
 * origin, so a frame between the player being destroyed and replaced does not
 * jump the view.
 */
export declare function CentreCameraOnPlayer(registry: IRegistry, camera: Camera): void;
//# sourceMappingURL=CentreCameraOnPlayer.d.ts.map