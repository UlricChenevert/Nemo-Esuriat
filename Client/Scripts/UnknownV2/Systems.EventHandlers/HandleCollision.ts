import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.ts";

export function HandleCollision(registry : IRegistry, eventQueue : IEventQueue) {
    // One distinct array per cell. `Array(n).fill([])` would share a single array
    // across every cell, making every entity collide with every other entity.
    const flatBoardOfEntityLocations : Entity[][] = Array.from({ length: GameWidth * GameWidth }, () => [])

    registry.ForEachEntityWith([Position, IsCollidable], (collidingEntity, position, _)=> {

        if (isNotWithinGameBorder(position)) return

        const flattenedIndex = position.x * GameWidth + position.y;
        const entitiesInLocation = flatBoardOfEntityLocations[flattenedIndex]!

        if (entitiesInLocation.length != 0) {
            entitiesInLocation.forEach(collidedEntity => {
                eventQueue.EnqueueEvent(new GameCollisionEvent(collidingEntity, collidedEntity)) 
            }); 
        }

        entitiesInLocation.push(collidingEntity)
    })
}