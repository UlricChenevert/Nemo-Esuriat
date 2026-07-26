import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Position } from "../Contracts/Components/Position.ts";

export function isNotWithinGameBorder(position : Position) {
    return (position.x < 0 || position.x >= GameWidth || position.y < 0 || position.y >= GameWidth)
}

export function isSamePosition(a : Position, b : Position) {
    return a.x == b.x && a.y == b.y
}
