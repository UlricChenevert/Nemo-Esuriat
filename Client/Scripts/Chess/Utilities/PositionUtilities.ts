import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Position } from "../Contracts/Position.ts";
import { Vector2D } from "../Contracts/Vector.ts";

export function isNotWithinGameBorder(position : Position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth)
}

export function isSamePosition(a : Position, b : Position) {
    return a.x == b.x && a.y == b.y
}

export function toVector(from : Position, to : Position) {
    return new Vector2D(to.x - from.x, to.y - from.y)
}

export function isSameVector(a : Vector2D, b : Vector2D) {
    return a.x == b.x && a.y == b.y
}

/** True iff `to` sits exactly one of `vectors` away from `from`. */
export function isDisplacedByAnyOf(from : Position, to : Position, vectors : Vector2D[]) {
    const displacement = toVector(from, to)

    return vectors.some((vector)=>isSameVector(displacement, vector))
}

