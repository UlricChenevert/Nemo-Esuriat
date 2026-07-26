import { GameWidth } from "../Configuration/GameConstants.js";
import { Position } from "../Contracts/Components/Position.js";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.js";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.js";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.js";
export function HandleCollision(registry, eventQueue) {
    // One distinct array per cell. `Array(n).fill([])` would share a single array
    // across every cell, making every entity collide with every other entity.
    const flatBoardOfEntityLocations = Array.from({ length: GameWidth * GameWidth }, () => []);
    registry.ForEachEntityWith([Position, IsCollidable], (collidingEntity, position, _) => {
        if (isNotWithinGameBorder(position))
            return;
        const flattenedIndex = position.x * GameWidth + position.y;
        const entitiesInLocation = flatBoardOfEntityLocations[flattenedIndex];
        if (entitiesInLocation.length != 0) {
            entitiesInLocation.forEach(collidedEntity => {
                eventQueue.EnqueueEvent(new GameCollisionEvent(collidingEntity, collidedEntity));
            });
        }
        entitiesInLocation.push(collidingEntity);
    });
}
//# sourceMappingURL=HandleCollision.js.map