import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";

/**
 * Announces that the set of systems the loop will run has changed -- a layer
 * pushed or popped, or a single system enabled or disabled.
 *
 * Carries the resulting list by name rather than the functions themselves so a
 * consumer can log it, show it, or assert on it without holding references to
 * live systems.
 */
export class GameLoopChangedEvent implements IGameEvent {
    readonly type = "GameLoopChanged"

    constructor (
        /** The layer now on top, or undefined if the stack was emptied. */
        public readonly layerName : string | undefined,
        /** Names of the enabled systems that layer will run, in order. */
        public readonly systemNames : readonly string[]
    ) {}
}
