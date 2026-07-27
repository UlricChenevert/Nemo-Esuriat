import type { Camera, WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
/**
 * Keeps a square of terrain chunks loaded around the viewport, creating chunks
 * that come into range and destroying those that leave.
 *
 * This reconciles the loaded set against the desired set rather than shifting a
 * grid by one step at a time, which is how the original game did it. That
 * version needed a separate branch per direction plus a fallback for teleports,
 * and its two branches each read from the unshifted buffer, so moving diagonally
 * silently dropped one of the two shifts. Reconciliation has no directional
 * cases at all: startup, a single step, a diagonal step, and a jump across the
 * map are all just "which chunks are missing, and which are no longer wanted".
 */
export declare function StreamChunks(registry: IRegistry, world: WorldStreamingResources, camera: Camera): void;
//# sourceMappingURL=StreamChunks.d.ts.map