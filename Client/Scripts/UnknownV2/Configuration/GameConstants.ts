import { CollectionGainByNeed, NeedKind } from "./HerdConstants.ts";

/**
 * Tiles per side of the viewport.
 *
 * This, and not TileSizePixels, is what sets how big a tile looks. Both
 * bootstraps size the canvas' backing store to GameWidth * TileSizePixels and
 * then let CSS scale it to fit the window, so a tile occupies
 * (window size / GameWidth) screen pixels no matter what the backing store is —
 * raising TileSizePixels buys sharpness, not size.
 *
 * At 100 a tile was about ten screen pixels on a 1000px window, which left menu
 * text too small to read comfortably. 50 doubles it, at the cost of seeing half
 * as much world at once.
 */
export const GameWidth = 50

/** Tiles per SECOND, not per tick -- HandleMovement scales it by frame time. */
export const HumanSpeed = 4

export const AnimalSpeed = 3

/** How fast a held pan key scrolls the viewport, in tiles per second. */
export const CameraPanSpeed = 30

/**
 * Ceiling on how much simulated time one tick may represent.
 *
 * A backgrounded tab stops firing requestAnimationFrame, so the first frame back
 * reports the whole absence -- often many seconds. Without a cap, every moving
 * entity would teleport across that gap, skipping the tiles between and every
 * collision that should have happened on them.
 */
export const MaxTickSeconds = 0.1

/**
 * Turns on the developer tools: ctrl+click to inspect an entity, and a per-frame trace of
 * the event queue.
 *
 * A build-time constant rather than a runtime toggle, so that with it off the debug
 * systems are never scheduled and the debug input layer is never pushed -- there is no
 * cost and no behaviour to reason about, rather than a disabled system checking a flag
 * every frame.
 *
 * Ctrl+click resolves through the input layer stack like any other input, so with this on
 * an ordinary click still commands units exactly as it did; only the ctrl gesture is
 * intercepted.
 */
export const Debug = false

/****************************************/
//
//     Interacting with the world
//
/****************************************/

/**
 * How far a human can reach to kill something, in tiles.
 *
 * Measured as a radius from where the actor stands, not as a ring of adjacent
 * tiles: positions are continuous mid-step, so a rule about neighbouring tiles
 * would flicker in and out of range as an animal walked through a tile boundary.
 */
export const InteractReachTiles = 2

/**
 * What an ordinary body is worth to eat, in Needs.hungerUnits.
 *
 * Deliberately less than a full bar. One deer should be a serious meal without
 * being a permanent answer to hunger -- at 0.75 a starving human is nearly filled
 * by one and a comfortable one wastes most of it, which is the pressure that makes
 * hunting worth timing.
 */
export const DefaultHungerUnits = 0.75

/**
 * What one Interact in water is worth, in Needs.water.
 *
 * Taken from what a completed animal drink pays, so a human at a lake and a deer
 * at the same lake are drinking the same water. The difference is that an animal
 * has to stand still for CollectionSecondsByNeed to earn it and a human pays a
 * keypress -- deliberate, since nothing would stop a player walking away
 * mid-drink and still being paid.
 */
export const DrinkGainPerPress = CollectionGainByNeed[NeedKind.Water] ?? 0.6