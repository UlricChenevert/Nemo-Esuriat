import { OwnedBy } from "../Contracts/Components/OwnedBy.js";
import { SelectionState } from "../Contracts/Components/SelectionState.js";
import { GameCollisionEvent } from "../Contracts/Events/GameCollisionEvent.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.js";
export function HandleCollision(registry, eventQueue) {
    const collisions = eventQueue.GetEventsOfType(GameCollisionEvent);
    if (collisions.length == 0)
        return;
    collisions.forEach((collision) => {
        TryRemoveMovementFlag(registry, collision.collidingEntity, collision.collidedEntity);
        TryRemoveMovementFlag(registry, collision.collidedEntity, collision.collidingEntity);
    });
}
function TryRemoveMovementFlag(registry, flag, movingEntity) {
    if (registry.GetComponent(flag, MovementFlag)) {
        if (!registry.GetComponent(movingEntity, IsMoveable))
            throw new Error("Unexpected state!");
        const owner = registry.GetComponent(movingEntity, OwnedBy);
        if (!owner?.owner)
            throw new Error("Weird state!");
        const selectionState = registry.GetComponent(owner.owner, SelectionState);
        if (!selectionState?.MovementFlag)
            throw new Error("Weird state!");
        selectionState.MovementFlag = undefined;
        registry.DestroyEntity(flag);
    }
}
//# sourceMappingURL=HandleCollision.js.map