import type { Entity } from "../Contracts/Components/Entity.ts";
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

    /**
     * Visits every component `entity` currently holds, with the class it was registered
     * under.
     *
     * The one query that goes the other way round: every other lookup here names a
     * component and asks which entities have it. This asks an entity what it is made of,
     * which is what an inspector needs and what nothing else in the game does.
     *
     * On the interface rather than left to the concrete registry because systems are
     * handed an IRegistry, so the alternative is a cast to GlobalRegistry in production
     * code purely to reach a public field.
     *
     * Order is UNSPECIFIED, as with ForEachEntityWith -- it follows registration order,
     * which is a detail of how the game was wired rather than anything to rely on.
     */
    ForEachComponentOf(entity: Entity, callback: (componentClass: IClassConstructor<unknown>, component: unknown) => void): void
}