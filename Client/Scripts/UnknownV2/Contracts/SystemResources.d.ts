import type { MultiTileRepresentation } from "./Components/MultiTileRepresentation.ts";
import type { IKeyValueStore } from "../Interfaces/IKeyValueStore.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";
export declare class Resources {
    Rendering: RenderingResources;
    World: WorldStreamingResources;
    constructor(Rendering: RenderingResources, World: WorldStreamingResources);
}
/**
 * Where the viewport sits in the world: the world coordinate drawn at the
 * screen's top-left corner.
 *
 * A resource rather than a component, because the camera is a property of the
 * view and nothing in the simulation should be reading it. Keeping it here also
 * means the renderer needs no extra query and no rule for which camera wins when
 * two entities claim to be one. UpdateCamera is what ties it to the player, so
 * what the camera follows can change without the renderer knowing.
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