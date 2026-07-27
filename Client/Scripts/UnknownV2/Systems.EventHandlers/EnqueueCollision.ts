import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.ts";

export function EnqueueCollision(registry : IRegistry, eventQueue : IEventQueue) {
    // One distinct array per cell. `Array(n).fill([])` would share a single array
    // across every cell, making every entity collide with every other entity.
    const flatBoardOfEntityLocations : Entity[][] = Array.from({ length: GameWidth * GameWidth }, () => [])

    registry.ForEachEntityWith([Position, IsCollidable], (collidingEntity, position, _)=> {

        if (isNotWithinGameBorder(position)) return

        // Floored, because positions are continuous -- HandleMovement advances an
        // entity by a fractional speed each tick -- while this board is one cell
        // per tile. Indexing with the raw coordinates lands between cells and
        // reads undefined, so an entity mid-step would collide with nothing.
        const flattenedIndex = Math.floor(position.x) * GameWidth + Math.floor(position.y);
        const entitiesInLocation = flatBoardOfEntityLocations[flattenedIndex]!

        if (entitiesInLocation.length != 0) {
            entitiesInLocation.forEach(collidedEntity => {
                eventQueue.EnqueueEvent(new GameCollisionEvent(collidingEntity, collidedEntity)) 
            }); 
        }

        entitiesInLocation.push(collidingEntity)
    })
}