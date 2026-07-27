import { GameWidth } from "../Configuration/GameConstants.js";
import { Position } from "../Contracts/Components/Position.js";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.js";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.js";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities.js";
export function EnqueueCollision(registry, eventQueue) {
    // One distinct array per cell. `Array(n).fill([])` would share a single array
    // across every cell, making every entity collide with every other entity.
    const flatBoardOfEntityLocations = Array.from({ length: GameWidth * GameWidth }, () => []);
    registry.ForEachEntityWith([Position, IsCollidable], (collidingEntity, position, _) => {
        if (isNotWithinGameBorder(position))
            return;
        // Floored, because positions are continuous -- HandleMovement advances an
        // entity by a fractional speed each tick -- while this board is one cell
        // per tile. Indexing with the raw coordinates lands between cells and
        // reads undefined, so an entity mid-step would collide with nothing.
        const flattenedIndex = Math.floor(position.x) * GameWidth + Math.floor(position.y);
        const entitiesInLocation = flatBoardOfEntityLocations[flattenedIndex];
        if (entitiesInLocation.length != 0) {
            entitiesInLocation.forEach(collidedEntity => {
                eventQueue.EnqueueEvent(new GameCollisionEvent(collidingEntity, collidedEntity));
            });
        }
        entitiesInLocation.push(collidingEntity);
    });
}
//# sourceMappingURL=EnqueueCollision.js.map