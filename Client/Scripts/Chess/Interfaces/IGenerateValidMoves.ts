import type { Entity } from "../Contracts/Entity";
import type { Position } from "../Contracts/Position";
import type { IRegistry } from "./IRegistry";

/**
 * `occupancy` lets a caller substitute a hypothetical board for the real one —
 * check filtering evaluates candidate moves against a modified copy of the map
 * rather than mutating the registry. Omit it and the generator reads the live board.
 */
export type IGenerateValidMoves = (
    currentPosition : Position,
    thisEntity : Entity,
    registry : IRegistry,
    occupancy? : Map<string, Entity>
)=>Position[]
