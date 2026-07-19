import { IsConscious } from "../Contracts/IsConcious";
import { IsMoveable } from "../Contracts/IsMovable";
import { IsSelected } from "../Contracts/IsSelected";
import { Position } from "../Contracts/Position";
import type { IEventQueue } from "../Interfaces/IEventQueue";
import type { IRegistry } from "../Interfaces/IRegistry";

export function HandleMovement (registry : IRegistry, eventQueue : IEventQueue) {

    // Add validation logic
    registry.ForEachEntityWith([IsConscious], (consciousnessEntity, _)=>{
        // If any entity has more than two isSelected, then move it
        let movableEntity;
        let moveToEntity;

        registry.ForEachEntityWith([IsSelected], (selectedEntity, isSelected) => {
            if (isSelected.source !== consciousnessEntity) return

            if (registry.GetComponent(selectedEntity, IsMoveable)) {movableEntity = selectedEntity; return}

            moveToEntity = selectedEntity; 
            
            return
        })

        if (movableEntity === undefined || moveToEntity === undefined) return

        const target = registry.GetComponent(moveToEntity, Position)
        const positionToEdit = registry.GetComponent(movableEntity, Position)

        if (target === undefined || positionToEdit === undefined) throw "move to entity or move from entity's position was undefined?"

        positionToEdit.x = target.x 
        positionToEdit.y = target.y

        registry.RemoveComponent(movableEntity, IsSelected)
        registry.RemoveComponent(moveToEntity, IsSelected)
    })
}