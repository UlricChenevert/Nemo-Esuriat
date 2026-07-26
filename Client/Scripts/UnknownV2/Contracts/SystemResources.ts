import { FontStyle } from "../Configuration/GameConstants.ts";
import type { MultiTileRepresentation } from "./Components/MultiTileRepresentation.ts";
import type { IKeyValueStore } from "../Interfaces/IKeyValueStore.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";

export class Resources {
    constructor(public Rendering : RenderingResources, public World : WorldStreamingResources) {}
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
    constructor(public worldOriginX = 0, public worldOriginY = 0) {}
}

/** Everything chunk streaming needs to load, generate, and retire terrain. */
export class WorldStreamingResources {
    /**
     * Recently unloaded chunks, newest last. Bounded by StreamChunks so pacing
     * around a chunk boundary does not regenerate terrain on every step.
     */
    recentChunkCache = new Map<string, MultiTileRepresentation>()

    /**
     * The chunk the player was in when chunks were last reconciled. NaN so the
     * first comparison always differs and the initial buffer gets built.
     */
    lastCenterChunkX = Number.NaN
    lastCenterChunkY = Number.NaN

    constructor(
        public noiseGenerator : INoiseGenerator,
        public keyValueStore : IKeyValueStore,
        public seed : number
    ) {}
}

export class RenderingResources {
    canvasContext : CanvasRenderingContext2D
    Camera = new Camera()

    constructor(public canvasElement : HTMLCanvasElement) {
        const temp = canvasElement.getContext("2d", { alpha: false })

        if (temp === undefined || temp === null) throw "Could not get context for canvas!"
        temp.font = FontStyle;
        temp.textBaseline = "middle";
        temp.textAlign = "center";

        // Stop touch gestures (scroll / pinch-zoom / long-press menu) from
        // hijacking taps on the board so pointer input stays responsive on mobile.
        canvasElement.style.touchAction = "none";

        this.canvasContext = temp
    }
}