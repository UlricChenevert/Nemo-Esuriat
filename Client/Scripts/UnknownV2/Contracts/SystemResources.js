import { FontStyle, MaxTickSeconds } from "../Configuration/GameConstants.js";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.js";
export class Resources {
    Rendering;
    World;
    Time;
    Input;
    Random;
    constructor(Rendering, World, Time = new TimeResources(), Input = new InputResources(), Random = new LinearCongruentialGenerator(Date.now())) {
        this.Rendering = Rendering;
        this.World = World;
        this.Time = Time;
        this.Input = Input;
        this.Random = Random;
    }
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
    heldKeyCodes = new Set();
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
    deltaSeconds = 1 / 60;
    /** Timestamp of the previous tick, in milliseconds. NaN before the first. */
    _previousTickMilliseconds = Number.NaN;
    /** Call once per tick with the requestAnimationFrame timestamp. */
    Advance(currentMilliseconds) {
        const elapsedMilliseconds = currentMilliseconds - this._previousTickMilliseconds;
        this._previousTickMilliseconds = currentMilliseconds;
        // NaN on the very first tick, which has no predecessor to measure from.
        if (Number.isNaN(elapsedMilliseconds))
            return;
        this.deltaSeconds = Math.min(elapsedMilliseconds / 1000, MaxTickSeconds);
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