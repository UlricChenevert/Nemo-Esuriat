import type { Entity } from "../Contracts/Entity.ts";
import { IsChessPiece } from "../Contracts/IsChessPiece.ts";
import { IsCollidable } from "../Contracts/IsCollideable.ts";
import { Position } from "../Contracts/Position.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export type Occupancy = Map<string, Entity>

export function OccupancyKey (position : Position) {
    return `${position.x},${position.y}`
}

/** Indexes every blocking piece by square so move generation can look up an occupant in O(1). */
export function GetOccupancy (registry : IRegistry) : Occupancy {
    const occupancy : Occupancy = new Map()

    registry.ForEachEntityWith([Position, IsCollidable, IsChessPiece], (entity, position)=>{
        occupancy.set(OccupancyKey(position), entity)
    })

    return occupancy
}

export function OccupantAt (occupancy : Occupancy, position : Position) {
    return occupancy.get(OccupancyKey(position))
}

/**
 * A copy of `occupancy` with `entity` relocated from `from` to `to`, and whatever
 * stood on `to` removed. Used to evaluate a move without touching the registry.
 */
export function WithSimulatedMove (occupancy : Occupancy, entity : Entity, from : Position, to : Position) : Occupancy {
    const simulated = new Map(occupancy)

    simulated.delete(OccupancyKey(from))
    simulated.set(OccupancyKey(to), entity)

    return simulated
}

/** Every occupied square paired with its occupant. */
export function OccupiedSquares (occupancy : Occupancy) : { position : Position, entity : Entity }[] {
    return [...occupancy].map(([squareKey, entity])=>{
        const [x, y] = squareKey.split(",").map(Number)

        return { position: new Position(x!, y!), entity }
    })
}
