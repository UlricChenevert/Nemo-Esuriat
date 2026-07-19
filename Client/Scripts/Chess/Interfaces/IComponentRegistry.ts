import type { Entity } from "../Contracts/Entity";
import type { IClassConstructor } from "./IClassConstructor";

export interface IComponentRegistry<Component> {

    SetComponent(entity: Entity, component: Component) : IComponentRegistry<Component>
    RemoveComponent(entity : Entity) : boolean
    
    GetComponent(entity : Entity) : Component | undefined

    ForEach(callback: (entity: Entity, component: Component) => void): void;
    
    Size() : number
    GetComponentType() : IClassConstructor<Component>
}
