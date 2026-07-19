import type { Entity } from "../Contracts/Entity.ts";
import { IsConscious } from "../Contracts/IsConcious.ts";
import { IsMoveable } from "../Contracts/IsMovable.ts";
import { IsSelected } from "../Contracts/IsSelected.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export function HandleMovement (registry : IRegistry, eventQueue : IEventQueue) {

    // Add validation logic
    registry.ForEachEntityWith([IsConscious], (consciousnessEntity, _)=>{
        // A move needs exactly one selected moveable entity (the piece) and one
        // selected destination entity (the tile), both owned by this consciousness.
        let movableEntity : Entity | undefined;
        let moveToEntity : Entity | undefined;

        registry.ForEachEntityWith([IsSelected], (selectedEntity, isSelected) => {
            if (isSelected.source !== consciousnessEntity) return

            if (registry.GetComponent(selectedEntity, IsMoveable)) {movableEntity = selectedEntity; return}

            moveToEntity = selectedEntity;

            return
        })

        if (movableEntity === undefined || moveToEntity === undefined) return

        const target = registry.GetComponent(moveToEntity, Position)
        const positionToEdit = registry.GetComponent(movableEntity, Position)

        if (target === undefined || positionToEdit === undefined) throw new Error("move-to entity or move-from entity's position was undefined?")

        positionToEdit.x = target.x 
        positionToEdit.y = target.y

        registry.RemoveComponent(movableEntity, IsSelected)
        registry.RemoveComponent(moveToEntity, IsSelected)
    })
}