import type { Entity } from "../Contracts/Entity.ts";
import type { ComponentInstances } from "./ComponentInstances.ts";
import type { IClassConstructor } from "./IClassConstructor.ts";
import type { IComponentRegistry } from "./IComponentRegistry.ts";

export interface IRegistry {
    CreateEntity(): Entity;

    /** Purges every component and frees the slot. Idempotent. */
    DestroyEntity(entity: Entity): IRegistry;

    /** True iff `entity` was created and has not been destroyed since. */
    IsAlive(entity: Entity): boolean;

    RegisterEntity<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>, component : ComponentType): IRegistry

    GetComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): ComponentType | undefined;
    RemoveComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): boolean;
    
    ForEachEntityWith<const T extends readonly IClassConstructor<unknown>[]>(
        components: [...T],
        callback: (entity: Entity, ...components: ComponentInstances<T>) => void
    ): IRegistry

    RegisterComponentRegistry<ComponentType>(componentClass: IClassConstructor<ComponentType>, registry: IComponentRegistry<ComponentType>): IRegistry
}