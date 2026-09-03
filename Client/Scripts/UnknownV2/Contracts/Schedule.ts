import type { ISystemContext } from "../Interfaces/ISystemContext.ts";

/** One entry in a layer: a named system and whether the loop should run it. */
export interface ScheduledSystem {
    name : string
    enabled : boolean
    run : (context : ISystemContext) => void
}

/**
 * One game mode's worth of systems, in the order they must run.
 *
 * Named because everything that manipulates the schedule from outside --
 * toggling a system, reading the change event, a test asserting what is live --
 * refers to entries by name rather than by an index into a list it cannot see.
 */
export class GameLoopLayer {
    constructor (public name : string, public systems : ScheduledSystem[]) {}

    Find(systemName : string) : ScheduledSystem | undefined {
        return this.systems.find((system)=>system.name === systemName)
    }

    EnabledSystems() : ScheduledSystem[] {
        return this.systems.filter((system)=>system.enabled)
    }
}

/**
 * The stack of game modes, of which only the top one runs.
 *
 * Top-only rather than every layer bottom-up, because pausing is the common
 * case: pushing a menu whose layer draws but does not simulate freezes the world
 * without anything having to know which of the nine gameplay systems would have
 * been unsafe to keep running. Layers below are dormant, not gone -- popping
 * resumes them exactly where they were, since all their state lives in the
 * registry and the resources rather than in the schedule.
 *
 * Data only. Everything that mutates the stack lives in
 * Systems.Framework/GameLoopStack, because a mutation has to announce itself and
 * that needs the event queue.
 */
export class ScheduleResources {
    /** Lowest first; the last entry is what runs. */
    stack : GameLoopLayer[] = []

    ActiveLayer() : GameLoopLayer | undefined {
        return this.stack[this.stack.length - 1]
    }

    ActiveSystemNames() : string[] {
        return this.ActiveLayer()?.EnabledSystems().map((system)=>system.name) ?? []
    }
}
