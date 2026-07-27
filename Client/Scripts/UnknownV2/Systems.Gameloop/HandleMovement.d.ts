import type { TimeResources } from "../Contracts/SystemResources.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
/**
 * Walks every entity holding a TargetLocation toward it, one tick's worth of
 * travel at a time, and drops the TargetLocation once it arrives.
 *
 * The step is taken along the straight line to the target rather than axis by
 * axis, so diagonal travel covers the same ground per tick as every other
 * heading instead of sqrt(2) times as much.
 *
 * Speed is tiles per second and is scaled by how long the tick actually took, so
 * an entity crosses the same ground in the same wall-clock time regardless of
 * frame rate. Stepping by a fixed amount per frame instead would make the game
 * run at more than twice the speed on a 144Hz display as on a 60Hz one.
 */
export declare function HandleMovement(registry: IRegistry, eventQueue: IEventQueue, time: TimeResources): void;
//# sourceMappingURL=HandleMovement.d.ts.map