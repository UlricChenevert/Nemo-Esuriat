import type { Resources } from "../Contracts/SystemResources.ts";
import type { IEventQueue } from "./IEventQueue.ts";
import type { IRegistry } from "./IRegistry.ts";

/**
 * Everything a scheduled system is handed each frame.
 *
 * Systems used to take whichever of these they needed as separate parameters,
 * which meant no two had the same signature and the loop could not hold them in
 * a list. One bundle gives them a common shape; each system still reaches for
 * only the piece it wants, so nothing gains a dependency it did not already
 * have.
 *
 * In Interfaces rather than beside the loop stack because contracts refer to it
 * -- a menu item's callback takes one -- and a contract importing a system
 * would invert the layering.
 */
export interface ISystemContext {
    registry : IRegistry
    eventQueue : IEventQueue
    resources : Resources
}
