import { GameLoopLayer, type ScheduledSystem } from "../Contracts/Schedule.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { Debug } from "./GameConstants.ts";
import { ResolveClickTargets } from "../Systems.Gameloop/ResolveClickTargets.ts";
import { InspectEntities } from "../Systems.Gameloop/InspectEntities.ts";
import { LogEventQueue } from "../Systems.Gameloop/LogEventQueue.ts";
import { EnqueueCollision } from "../Systems.EventHandlers/EnqueueCollision.ts";
import { HandleCollision } from "../Systems.EventHandlers/HandleCollision.ts";
import { HandlePlayerDefeat } from "../Systems.EventHandlers/HandlePlayerDefeat.ts";
import { HandleAIMovement } from "../Systems.Gameloop/HandleAIMovement.ts";
import { HandleInputEvents } from "../Systems.Gameloop/HandleInputEvents.ts";
import { HandleInteraction } from "../Systems.Gameloop/HandleInteraction.ts";
import { HandleMenuActions } from "../Systems.Gameloop/HandleMenuActions.ts";
import { HandleMovement } from "../Systems.Gameloop/HandleMovement.ts";
import { HandleNeedsDecay } from "../Systems.Gameloop/HandleNeedsDecay.ts";
import { HandlePlayerActions } from "../Systems.Gameloop/HandlePlayerActions.ts";
import { PanCamera } from "../Systems.Gameloop/PanCamera.ts";
import { PopulateHerds } from "../Systems.Gameloop/PopulateHerds.ts";
import { RenderCanvas } from "../Systems.Gameloop/RenderCanvas.ts";
import { ResolveInputActions } from "../Systems.Gameloop/ResolveInputActions.ts";
import { StreamChunks } from "../Systems.Gameloop/StreamChunks.ts";
import { UpdateHud } from "../Systems.Gameloop/UpdateHud.ts";
import { UpdateNeeds } from "../Systems.Gameloop/UpdateNeeds.ts";

/** Layer names, so callers of SetSystemEnabled do not spell them by hand. */
export const GameplayLayerName = "Gameplay"
export const MenuLayerName = "Menu"

/**
 * The systems that make up ordinary play, in the only order they work in.
 *
 * Each entry adapts a system to the common (context) shape rather than the
 * systems changing signature: a system asking for exactly the two or three
 * things it uses is worth keeping, and the adapter is where "what this system
 * needs" is written down.
 *
 * A fresh object per call, never a shared constant. Layers carry mutable
 * per-entry `enabled` flags and are compared by identity when removed from the
 * stack, so two modes sharing one instance would toggle and pop each other.
 */
export function BuildGameplayLoopLayer () : GameLoopLayer {
    return new GameLoopLayer(GameplayLayerName, [
        // First, so everything below reads this frame's input rather than last
        // frame's, and so the layer stack is pruned before anyone consults it.
        { name: "ResolveInputActions", enabled: true, run: (context)=>ResolveInputActions(context.registry, context.eventQueue, context.resources.Input) },

        // Immediately after the actions, and for the same reason: it routes this frame's
        // clicks down the layer stack so every consumer below reads its own mailbox rather
        // than the shared queue. Needs the pruned stack ResolveInputActions just left.
        { name: "ResolveClickTargets", enabled: true, run: (context)=>ResolveClickTargets(context.registry, context.eventQueue, context.resources.Input) },

        { name: "HandlePlayerActions", enabled: true, run: (context)=>HandlePlayerActions(context) },

        // Beside HandlePlayerActions, because both read the press edges
        // ResolveInputActions just rebuilt, and ahead of everything that moves: a
        // kill is aimed at where the animals are now, which is where the player saw
        // them when they pressed.
        { name: "HandleInteraction", enabled: true, run: (context)=>HandleInteraction(context) },

        // Converts click screen-tiles to world-tiles against the same camera
        // origin the renderer will use, so it has to precede the pan.
        { name: "HandleInputEvents", enabled: true, run: (context)=>HandleInputEvents(context.registry, context.eventQueue) },

        // Before the pan for the same camera-origin reason as HandleInputEvents: it
        // resolves a clicked screen tile against the origin the player was looking at.
        ...(Debug ? [{
            name: "InspectEntities", enabled: true,
            run: (context : ISystemContext)=>{
                const inspector = context.resources.Input.debugInspector

                if (inspector !== undefined) InspectEntities(context.registry, context.resources.World, inspector)
            }
        }] : []),
        { name: "PanCamera", enabled: true, run: (context)=>PanCamera(context.registry, context.resources.Time) },

        { name: "HandleMovement", enabled: true, run: (context)=>HandleMovement(context.registry, context.eventQueue, context.resources.Time) },
        { name: "EnqueueCollision", enabled: true, run: (context)=>EnqueueCollision(context.registry, context.eventQueue) },

        // Before the AI decides anything, and after everything has finished moving.
        // The herd decision trees branch on need levels and on whether a member has
        // finished drinking, so both have to be current: an animal that finished on
        // this tick must be seen to have finished on this tick, or the herd re-decides
        // against stale numbers. Running it at the end of the loop instead would
        // charge a member that has only just stopped for a tick it never stood still
        // for.
        { name: "UpdateNeeds", enabled: true, run: (context)=>UpdateNeeds(context.registry, context.resources.Time) },

        // Straight after the drain it reacts to, and still before the AI: an animal
        // that starved this tick must not also get a turn to decide where to walk.
        { name: "HandleNeedsDecay", enabled: true, run: (context)=>HandleNeedsDecay(context.registry, context.eventQueue, context.resources.Random) },

        // Same frame as the deaths it reads. The queue is drained at the end of the
        // frame, so a defeat check anywhere later in the schedule is fine and one in
        // the next frame's schedule would never see them.
        { name: "HandlePlayerDefeat", enabled: true, run: (context)=>HandlePlayerDefeat(context) },

        // After HandleMovement, so it senses where the animals actually ended up. A
        // member that reached water this tick is seen standing in it and stops to
        // drink against an already-stripped TargetLocation, with no write/erase race.
        { name: "HandleAIMovement", enabled: true, run: (context)=>HandleAIMovement(context.registry, context.resources.World, context.resources.Random) },

        // After the pan, and before rendering: streaming reacts to where the camera
        // now points, so the chunks it just scrolled onto exist by the time they are
        // drawn. Running it ahead of PanCamera would show a blank strip for a frame.
        { name: "StreamChunks", enabled: true, run: (context)=>StreamChunks(context.registry, context.resources.World) },

        // Immediately after streaming, which is the only point in the frame where
        // the list of chunks it just loaded is still standing.
        { name: "PopulateHerds", enabled: true, run: (context)=>PopulateHerds(context.registry, context.resources.World, context.resources.Random) },

        // After EnqueueCollision, which is what it consumes, and same-frame.
        { name: "HandleCollision", enabled: true, run: (context)=>HandleCollision(context.registry, context.eventQueue) },

        // Last before the draw, because it exists to prepare part of it: the bars
        // read the needs every system above has finished writing for this tick.
        { name: "UpdateHud", enabled: true, run: (context)=>UpdateHud(context.registry) },

        { name: "RenderCanvas", enabled: true, run: (context)=>RenderCanvas(context.registry, context.resources.Rendering) },

        // Last, which is what makes it see the whole frame: GameLoop clears the queue
        // after the active layer has run, so this is everything that happened, printed
        // just before it is thrown away.
        ...(Debug ? [DebugEventLogEntry()] : [])
    ])
}

/** The event trace, shared by every layer that wants it. */
function DebugEventLogEntry () : ScheduledSystem {
    return { name: "LogEventQueue", enabled: true, run: (context)=>LogEventQueue(context.eventQueue) }
}

/**
 * A menu's mode: hear input, draw, simulate nothing.
 *
 * Since only the top layer runs, this list IS the pause -- there is no separate
 * "paused" flag for a system to forget to check, and no question about which of
 * the gameplay systems were safe to leave running.
 *
 * HandleInputEvents is deliberately absent: clicking commands units, and a click
 * that walked somebody across the map while a pause screen was up would be the
 * clearest possible sign the pause was a lie.
 */
export function BuildMenuLoopLayer () : GameLoopLayer {
    return new GameLoopLayer(MenuLayerName, [
        { name: "ResolveInputActions", enabled: true, run: (context)=>ResolveInputActions(context.registry, context.eventQueue, context.resources.Input) },
        { name: "HandleMenuActions", enabled: true, run: (context)=>HandleMenuActions(context) },
        { name: "RenderCanvas", enabled: true, run: (context)=>RenderCanvas(context.registry, context.resources.Rendering) },
        ...(Debug ? [DebugEventLogEntry()] : [])
    ])
}
