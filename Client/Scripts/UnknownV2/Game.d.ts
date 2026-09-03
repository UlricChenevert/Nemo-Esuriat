import { Resources } from "./Contracts/SystemResources.ts";
import type { IDispose } from "./Interfaces/IDispose.ts";
import type { IEventQueue } from "./Interfaces/IEventQueue.ts";
import type { IRegistry } from "./Interfaces/IRegistry.ts";
import { EventQueue } from "./Systems.Framework/EventQueue.ts";
import { GlobalRegistry } from "./Systems.Framework/Registry.ts";
export interface GameContext {
    registry: GlobalRegistry;
    eventQueue: EventQueue;
    resources: Resources;
    disposalFunctions: IDispose[];
}
export declare function Initialization(resources: Resources): GameContext;
/**
 * Runs one frame of whichever mode is on top of the schedule.
 *
 * The loop used to be this list, written out. It is a stack of lists now
 * because "what runs" turned out to be a thing the game needed to change at
 * runtime -- pausing, menus, and any mode that is gameplay minus a system --
 * and a fixed sequence of calls can only be changed by editing it.
 */
export declare function GameLoop(registry: IRegistry, eventQueue: IEventQueue, resources: Resources): void;
export declare function Teardown(disposalFunctions: IDispose[]): void;
/**
 * Bootstraps the game onto a canvas and drives it with requestAnimationFrame.
 * Returns a teardown function that stops the loop and removes all listeners.
 */
export declare function StartGame(canvasElement: HTMLCanvasElement): IDispose;
//# sourceMappingURL=Game.d.ts.map