import type { Entity } from "../Contracts/Entity.ts";
import type { IClassConstructor } from "./IClassConstructor.ts";

export interface IComponentRegistry<Component> {

    SetComponent(entity: Entity, component: Component) : IComponentRegistry<Component>
    RemoveComponent(entity : Entity) : boolean
    
    GetComponent(entity : Entity) : Component | undefined

    ForEach(callback: (entity: Entity, component: Component) => void): void;
    
    Size() : number
    GetComponentType() : IClassConstructor<Component>
}
