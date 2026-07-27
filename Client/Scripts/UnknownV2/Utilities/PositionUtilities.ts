import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Position } from "../Contracts/Components/Position.ts";
import { Vector2D } from "../Contracts/Components/Vector2D.ts";

export function isNotWithinGameBorder(position : Position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth)
}

export function isSamePosition(a : Position, b : Position) {
    return a.x == b.x && a.y == b.y
}

/**
 * Whether two positions fall on the same tile.
 *
 * Distinct from isSamePosition, which is exact. Positions became continuous when
 * HandleMovement started advancing entities by a fractional speed per tick, so
 * an entity mid-step between (50,50) and (51,50) is at no integer position at
 * all -- exact comparison against a click, which is always a whole tile, would
 * never match it.
 */
export function isSameTile(a : Position, b : Position) {
    return Math.floor(a.x) == Math.floor(b.x) && Math.floor(a.y) == Math.floor(b.y)
}

/**
 * Whether a screen-space tile falls outside the visible area.
 *
 * Distinct from isNotWithinGameBorder, which tests world space. Once the camera
 * can move, the two stop meaning the same thing: a tile at world (-40, 10) is
 * outside the world border but perfectly visible when the camera has scrolled
 * there.
 *
 * Takes coordinates rather than a Position because the renderer calls it once
 * per tile, and building a throwaway Position for each would allocate thousands
 * of objects per frame.
 */
export function IsOutsideViewport(screenX : number, screenY : number) {
    return (screenX < 0 || screenX >= GameWidth || screenY < 0 || screenY >= GameWidth)
}

export function getNormalizedDistanceVector(a : Position, b : Position) {
    const translatedVector = new Vector2D(b.x - a.x, b.y - a.y)

    return normalize(translatedVector)
}

/**
 * The unit vector pointing the same way as `a`, or the zero vector when `a` has
 * no direction to speak of.
 *
 * The zero case is a legitimate answer, not an error: asking for the direction
 * from an entity to a target it is already standing on is a normal thing for the
 * steering systems to do, and every entity that has just been handed a target at
 * its own position does it on its first tick. Dividing by the zero magnitude
 * instead would hand back NaN, which then flows into TargetLocation, into
 * Position via HandleMovement, and never washes out -- the entity is gone for
 * good, rendered nowhere and comparing false against every position.
 */
export function normalize(a : Vector2D) {
    const length = magnitude(a)

    if (!(length > 0) || !Number.isFinite(length)) return new Vector2D(0, 0)

    return new Vector2D(a.x / length, a.y / length)
}

export function magnitude(a : Vector2D) {
    return Math.hypot(a.x, a.y)
}

/**
 * `a` shortened to at most `max`, keeping its direction. Vectors already within
 * the bound are returned unchanged.
 *
 * Distinct from clamping each axis separately, which both lets a large negative
 * component through untouched and bends a diagonal: capping only the longer axis
 * of (10, 2) turns it into a much steeper heading than the one asked for.
 */
export function clampMagnitude(a : Vector2D, max : number) {
    const length = magnitude(a)

    if (!(length > max) || !Number.isFinite(length)) return new Vector2D(a.x, a.y)

    const scale = max / length

    return new Vector2D(a.x * scale, a.y * scale)
}