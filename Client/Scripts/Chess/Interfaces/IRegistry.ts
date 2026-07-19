import type { Entity, IndexableEntity } from "../Contracts/Entity";
import type { ComponentInstances } from "./ComponentInstances";
import type { IClassConstructor } from "./IClassConstructor";
import type { IComponentRegistry } from "./IComponentRegistry";

export interface IRegistry {
    CreateEntity(): Entity;
    DestroyEntity(entity: Entity): IRegistry;
    
    RegisterEntity<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>, component : ComponentType): IRegistry

    GetComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): ComponentType | undefined;
    RemoveComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): boolean;
    
    ForEachEntityWith<const T extends readonly IClassConstructor<unknown>[]>(
        components: [...T],
        callback: (entity: Entity, ...components: ComponentInstances<T>) => void
    ): IRegistry

    RegisterComponentRegistry<ComponentType>(componentClass: IClassConstructor<ComponentType>, registry: IComponentRegistry<ComponentType>): IRegistry
}