import { type Entity } from "../Contracts/Components/Entity.ts";
import type { ComponentInstances } from "../Interfaces/ComponentInstances.ts";
import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import type { IComponentRegistry } from "../Interfaces/IComponentRegistry.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
export declare class GlobalRegistry implements IRegistry {
    ComponentRegistry: Map<IClassConstructor<unknown>, IComponentRegistry<unknown>>;
    /** _versions[i] is slot i's CURRENT generation. Always >= 1 once allocated. */
    private _versions;
    /** _alive[i] mirrors whether slot i is presently allocated. */
    private _alive;
    /** Indices of destroyed slots, available for reuse (LIFO). */
    private _freeIndices;
    constructor();
    CreateEntity(): Entity;
    DestroyEntity(entity: Entity): IRegistry;
    IsAlive(entity: Entity): boolean;
    GetComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): ComponentType | undefined;
    RemoveComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): boolean;
    RegisterComponentRegistry<ComponentType>(componentClass: IClassConstructor<ComponentType>, registry: IComponentRegistry<ComponentType>): IRegistry;
    RegisterEntity<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>, component: ComponentType): IRegistry;
    ForEachEntityWith<const T extends readonly IClassConstructor<unknown>[]>(components: [...T], callback: (entity: Entity, ...components: ComponentInstances<T>) => void): IRegistry;
    _getComponentRegistryOrThrow<ComponentType>(component: IClassConstructor<ComponentType>): IComponentRegistry<ComponentType>;
}
//# sourceMappingURL=Registry.d.ts.map