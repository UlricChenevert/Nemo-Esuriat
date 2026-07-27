export declare const GameWidth = 100;
export declare const FontStyle = "14px monospace";
/** Tiles per SECOND, not per tick -- HandleMovement scales it by frame time. */
export declare const HumanSpeed = 4;
export declare const AnimalSpeed = 3;
/** How fast a held pan key scrolls the viewport, in tiles per second. */
export declare const CameraPanSpeed = 30;
/**
 * Ceiling on how much simulated time one tick may represent.
 *
 * A backgrounded tab stops firing requestAnimationFrame, so the first frame back
 * reports the whole absence -- often many seconds. Without a cap, every moving
 * entity would teleport across that gap, skipping the tiles between and every
 * collision that should have happened on them.
 */
export declare const MaxTickSeconds = 0.1;
//# sourceMappingURL=GameConstants.d.ts.map