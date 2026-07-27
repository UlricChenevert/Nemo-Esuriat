import { Position } from "../Contracts/Components/Position.js";
import { TargetLocation } from "../Contracts/Components/TargetLocation.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
import { isSamePosition } from "../Utilities/PositionUtilities.js";
/**
 * Walks every entity holding a TargetLocation toward it, one tick's worth of
 * travel at a time, and drops the TargetLocation once it arrives.
 *
 * The step is taken along the straight line to the target rather than axis by
 * axis, so diagonal travel covers the same ground per tick as every other
 * heading instead of sqrt(2) times as much.
 *
 * Speed is tiles per second and is scaled by how long the tick actually took, so
 * an entity crosses the same ground in the same wall-clock time regardless of
 * frame rate. Stepping by a fixed amount per frame instead would make the game
 * run at more than twice the speed on a 144Hz display as on a 60Hz one.
 */
export function HandleMovement(registry, eventQueue, time) {
    const secondsThisTick = time.deltaSeconds;
    registry.ForEachEntityWith([TargetLocation], (entity, targetLocation) => {
        const currentLocationPos = registry.GetComponent(entity, Position);
        const targetLocationPos = targetLocation.TargetLocation;
        const speed = registry.GetComponent(entity, IsMoveable);
        if (!currentLocationPos || !speed)
            throw new Error("Weird State!");
        if (isSamePosition(currentLocationPos, targetLocationPos)) {
            registry.RemoveComponent(entity, TargetLocation);
            return;
        }
        const deltaX = targetLocationPos.x - currentLocationPos.x;
        const deltaY = targetLocationPos.y - currentLocationPos.y;
        const distance = Math.hypot(deltaX, deltaY);
        const stepDistance = speed.speed * secondsThisTick;
        // Snapping on the last step keeps the entity from overshooting and then
        // oscillating around the target forever, and makes the exact equality
        // isSamePosition tests for reachable despite the fractional steps.
        if (distance <= stepDistance) {
            currentLocationPos.x = targetLocationPos.x;
            currentLocationPos.y = targetLocationPos.y;
            registry.RemoveComponent(entity, TargetLocation);
        }
        else {
            currentLocationPos.x += (deltaX / distance) * stepDistance;
            currentLocationPos.y += (deltaY / distance) * stepDistance;
        }
    });
}
//# sourceMappingURL=HandleMovement.js.map