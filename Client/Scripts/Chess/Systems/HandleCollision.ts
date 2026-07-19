import { GameWidth } from "../Configuration/GameConstants";
import type { Entity } from "../Contracts/Entity";
import { GameCollisionEvent } from "../Contracts/GameCollisionEvent";
import { IsCollidable } from "../Contracts/IsCollideable";
import { Position } from "../Contracts/Position";
import type { IEventQueue } from "../Interfaces/IEventQueue";
import type { IRegistry } from "../Interfaces/IRegistry";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities";

export function HandleCollision(registry : IRegistry, eventQueue : IEventQueue) {
    const flatBoardOfEntityLocations : Entity[][] = Array(GameWidth * GameWidth).fill([]) 
    
    registry.ForEachEntityWith([Position, IsCollidable], (collidingEntity, position, _)=> {

        const flattenedIndex = position.x * GameWidth + position.y;
        const entitiesInLocation = flatBoardOfEntityLocations[flattenedIndex]!

        if (isNotWithinGameBorder(position)) return
        
        entitiesInLocation.push(collidingEntity)

        if (entitiesInLocation.length == 1) return

        entitiesInLocation.forEach(collidedEntity => {
            if (collidedEntity == collidingEntity) return

            eventQueue.EnqueueEvent(new GameCollisionEvent(collidingEntity, collidedEntity)) 
        }); 
    })
}