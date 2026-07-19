import type { Entity } from "../Contracts/Entity.ts";
import type { IClassConstructor } from "./IClassConstructor.ts";

export interface IComponentRegistry<Component> {

    SetComponent(entity: Entity, component: Component) : IComponentRegistry<Component>
    RemoveComponent(entity : Entity) : boolean
    
    GetComponent(entity : Entity) : Component | undefined

    /**
     * Visits every (entity, component) pair.
     *
     * CONTRACT: removing the *currently visited* entity's component from within
     * the callback is permitted and must not skip a subsequent element.
     * Map.forEach satisfies this natively. A swap-remove dense array does NOT
     * under forward iteration -- such an implementation must iterate descending,
     * so that the element swapped into the current slot is one already visited.
     *
     * Adding components during iteration is UNSPECIFIED; do not.
     * Iteration ORDER is UNSPECIFIED -- do not depend on insertion order.
     */
    ForEach(callback: (entity: Entity, component: Component) => void): void;
    
    Size() : number
    GetComponentType() : IClassConstructor<Component>
}
