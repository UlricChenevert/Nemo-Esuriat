import { FontStyle, MaxTickSeconds } from "../Configuration/GameConstants.ts";
import type { Entity } from "./Components/Entity.ts";
import type { MultiTileRepresentation } from "./Components/MultiTileRepresentation.ts";
import type { IKeyValueStore } from "../Interfaces/IKeyValueStore.ts";
import type { INoiseGenerator } from "../Interfaces/INoiseGenerator.ts";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.ts";

export class Resources {
    constructor(
        public Rendering : RenderingResources,
        public World : WorldStreamingResources,
        public Time = new TimeResources(),
        public Input = new InputResources(),
        public Random = new LinearCongruentialGenerator(Date.now())
    ) {}
}

/** Input state that outlives a single event, as opposed to the events themselves. */
export class InputResources {
    /**
     * Key codes held down right now, by KeyboardEvent.code.
     *
     * Held here rather than derived from the event queue each frame because
     * a held key produces one keydown and then nothing until release, so the
     * queue is empty on almost every frame the key is still down.
     */
    heldKeyCodes = new Set<string>()
}

/**
 * How much simulated time the current tick covers.
 *
 * A resource rather than a parameter threaded through every system, matching how
 * Camera is handled: anything that moves reads it, and nothing owns it.
 */
export class TimeResources {
    /**
     * Seconds elapsed since the previous tick. Systems that move things multiply
     * by this, so speeds are expressed per second and stay the same whether the
     * display runs at 60Hz or 144Hz.
     *
     * Seeded with one 60Hz frame rather than 0 so a loop driven without
     * timestamps -- a test calling GameLoop directly -- still advances.
     */
    deltaSeconds = 1 / 60

    /** Timestamp of the previous tick, in milliseconds. NaN before the first. */
    private _previousTickMilliseconds = Number.NaN

    /** Call once per tick with the requestAnimationFrame timestamp. */
    Advance(currentMilliseconds : number) {
        const elapsedMilliseconds = currentMilliseconds - this._previousTickMilliseconds

        this._previousTickMilliseconds = currentMilliseconds

        // NaN on the very first tick, which has no predecessor to measure from.
        if (Number.isNaN(elapsedMilliseconds)) return

        this.deltaSeconds = Math.min(elapsedMilliseconds / 1000, MaxTickSeconds)
    }
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

    /**
     * Chunk entities created by the most recent StreamChunks call, for systems
     * that populate fresh terrain to consume.
     *
     * Emptied at the top of every StreamChunks call, including the ones that
     * early-out, so it never describes a tick older than the current one. A
     * populating system that missed its turn must not get a second chance at the
     * same chunks -- that is how one chunk ends up with a herd per frame.
     */
    chunksLoadedThisTick : Entity[] = []

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