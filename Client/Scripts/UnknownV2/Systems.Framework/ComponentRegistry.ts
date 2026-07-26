import type { Entity } from "../Contracts/Components/Entity.ts";
import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import { type IComponentRegistry } from "../Interfaces/IComponentRegistry.ts";

export class HashMapComponentRegistry<Component> implements IComponentRegistry<Component> {
    Container : Map<Entity, Component>
    
    constructor (public ComponentConstructor : IClassConstructor<Component>) {
        this.Container = new Map<Entity, Component>();
    }

    GetComponentType(): IClassConstructor<Component> {
        return this.ComponentConstructor
    }

    // Map.prototype.forEach tolerates deletion of the currently visited key, so
    // this satisfies IComponentRegistry.ForEach's mutation contract natively.
    ForEach(callback: (entity: Entity, component: Component) => void): void {
        this.Container.forEach((value: Component, key: Entity)=>callback(key, value));
    }

    SetComponent(entity: Entity, component: Component): IComponentRegistry<Component> {
        this.Container.set(entity, component)
        return this
    }

    RemoveComponent(entity: Entity): boolean {
        return this.Container.delete(entity)
    }
    
    GetComponent(entity: Entity): Component | undefined {
        return this.Container.get(entity)
    }

    Size() {
        return this.Container.size
    }

}