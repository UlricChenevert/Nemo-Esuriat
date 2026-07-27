export const GameWidth = 100;
export const FontStyle = "14px monospace";
/** Tiles per SECOND, not per tick -- HandleMovement scales it by frame time. */
export const HumanSpeed = 4;
export const AnimalSpeed = 3;
/** How fast a held pan key scrolls the viewport, in tiles per second. */
export const CameraPanSpeed = 30;
/**
 * Ceiling on how much simulated time one tick may represent.
 *
 * A backgrounded tab stops firing requestAnimationFrame, so the first frame back
 * reports the whole absence -- often many seconds. Without a cap, every moving
 * entity would teleport across that gap, skipping the tiles between and every
 * collision that should have happened on them.
 */
export const MaxTickSeconds = 0.1;
//# sourceMappingURL=GameConstants.js.map