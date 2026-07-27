import type { MultiTileRepresentation } from "./Components/MultiTileRepresentation.ts";
import type { IKeyValueStore } from "../Interfaces/IKeyValueStore.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";
export declare class Resources {
    Rendering: RenderingResources;
    World: WorldStreamingResources;
    Time: TimeResources;
    Input: InputResources;
    constructor(Rendering: RenderingResources, World: WorldStreamingResources, Time?: TimeResources, Input?: InputResources);
}
/** Input state that outlives a single event, as opposed to the events themselves. */
export declare class InputResources {
    /**
     * Key codes held down right now, by KeyboardEvent.code.
     *
     * Held here rather than derived from the event queue each frame because
     * a held key produces one keydown and then nothing until release, so the
     * queue is empty on almost every frame the key is still down.
     */
    heldKeyCodes: Set<string>;
}
/**
 * How much simulated time the current tick covers.
 *
 * A resource rather than a parameter threaded through every system, matching how
 * Camera is handled: anything that moves reads it, and nothing owns it.
 */
export declare class TimeResources {
    /**
     * Seconds elapsed since the previous tick. Systems that move things multiply
     * by this, so speeds are expressed per second and stay the same whether the
     * display runs at 60Hz or 144Hz.
     *
     * Seeded with one 60Hz frame rather than 0 so a loop driven without
     * timestamps -- a test calling GameLoop directly -- still advances.
     */
    deltaSeconds: number;
    /** Timestamp of the previous tick, in milliseconds. NaN before the first. */
    private _previousTickMilliseconds;
    /** Call once per tick with the requestAnimationFrame timestamp. */
    Advance(currentMilliseconds: number): void;
}
/**
 * Where the viewport sits in the world: the world coordinate drawn at the
 * screen's top-left corner.
 *
 * A resource rather than a component, because the camera is a property of the
 * view and nothing in the simulation should be reading it. Keeping it here also
 * means the renderer needs no extra query and no rule for which camera wins when
 * two entities claim to be one. PanCamera is what moves it and StreamChunks is
 * what follows it, so where the view goes can change without the renderer
 * knowing anything about it.
 *
 * At the origin, screen coordinates equal world coordinates.
 */
export declare class Camera {
    worldOriginX: number;
    worldOriginY: number;
    constructor(worldOriginX?: number, worldOriginY?: number);
}
/** Everything chunk streaming needs to load, generate, and retire terrain. */
export declare class WorldStreamingResources {
    noiseGenerator: INoiseGenerator;
    keyValueStore: IKeyValueStore;
    seed: number;
    /**
     * Recently unloaded chunks, newest last. Bounded by StreamChunks so pacing
     * around a chunk boundary does not regenerate terrain on every step.
     */
    recentChunkCache: Map<string, MultiTileRepresentation>;
    /**
     * The chunk the player was in when chunks were last reconciled. NaN so the
     * first comparison always differs and the initial buffer gets built.
     */
    lastCenterChunkX: number;
    lastCenterChunkY: number;
    constructor(noiseGenerator: INoiseGenerator, keyValueStore: IKeyValueStore, seed: number);
}
export declare class RenderingResources {
    canvasElement: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    Camera: Camera;
    constructor(canvasElement: HTMLCanvasElement);
}
//# sourceMappingURL=SystemResources.d.ts.map