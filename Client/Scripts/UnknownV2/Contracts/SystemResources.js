import { FontStyle } from "../Configuration/GameConstants.js";
export class Resources {
    Rendering;
    World;
    constructor(Rendering, World) {
        this.Rendering = Rendering;
        this.World = World;
    }
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
export class Camera {
    worldOriginX;
    worldOriginY;
    constructor(worldOriginX = 0, worldOriginY = 0) {
        this.worldOriginX = worldOriginX;
        this.worldOriginY = worldOriginY;
    }
}
/** Everything chunk streaming needs to load, generate, and retire terrain. */
export class WorldStreamingResources {
    noiseGenerator;
    keyValueStore;
    seed;
    /**
     * Recently unloaded chunks, newest last. Bounded by StreamChunks so pacing
     * around a chunk boundary does not regenerate terrain on every step.
     */
    recentChunkCache = new Map();
    /**
     * The chunk the player was in when chunks were last reconciled. NaN so the
     * first comparison always differs and the initial buffer gets built.
     */
    lastCenterChunkX = Number.NaN;
    lastCenterChunkY = Number.NaN;
    constructor(noiseGenerator, keyValueStore, seed) {
        this.noiseGenerator = noiseGenerator;
        this.keyValueStore = keyValueStore;
        this.seed = seed;
    }
}
export class RenderingResources {
    canvasElement;
    canvasContext;
    Camera = new Camera();
    constructor(canvasElement) {
        this.canvasElement = canvasElement;
        const temp = canvasElement.getContext("2d", { alpha: false });
        if (temp === undefined || temp === null)
            throw "Could not get context for canvas!";
        temp.font = FontStyle;
        temp.textBaseline = "middle";
        temp.textAlign = "center";
        // Stop touch gestures (scroll / pinch-zoom / long-press menu) from
        // hijacking taps on the board so pointer input stays responsive on mobile.
        canvasElement.style.touchAction = "none";
        this.canvasContext = temp;
    }
}
//# sourceMappingURL=SystemResources.js.map