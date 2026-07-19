import { BasicEntity, Entity } from "../Contracts/Entity.ts";
import type { ComponentInstances } from "../Interfaces/ComponentInstances.ts";
import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import type { IComponentRegistry } from "../Interfaces/IComponentRegistry.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export class GlobalRegistry implements IRegistry {
    ComponentRegistry : Map<IClassConstructor<unknown>, IComponentRegistry<unknown>>
    EntityId = 0

    constructor () {this.ComponentRegistry = new Map()}

    
    CreateEntity(): Entity {
        this.EntityId++
        return new BasicEntity(this.EntityId)
    }
    
    DestroyEntity(entity: Entity): IRegistry {
        this.ComponentRegistry.forEach((componentRegistry)=>{componentRegistry.RemoveComponent(entity)})

        return this
    }
    
    GetComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): ComponentType | undefined {
        const componentRegistry = this._getComponentRegistryOrThrow(componentClass)
        
        return (componentRegistry as IComponentRegistry<ComponentType>)?.GetComponent(entity)
    }

    RemoveComponent<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>): boolean {
        const componentRegistry = this._getComponentRegistryOrThrow(componentClass)

        return componentRegistry.RemoveComponent(entity)
    }
    
    RegisterComponentRegistry<ComponentType>(componentClass: IClassConstructor<ComponentType>, registry: IComponentRegistry<ComponentType>): IRegistry {
        this.ComponentRegistry.set(componentClass, registry)
        
        return this
    }
    
    RegisterEntity<ComponentType>(entity: Entity, componentClass: IClassConstructor<ComponentType>, component : ComponentType): IRegistry {
        let currentRegistry = this._getComponentRegistryOrThrow(componentClass)
        
        currentRegistry.SetComponent(entity, component)

        return this
    }

    ForEachEntityWith<const T extends readonly IClassConstructor<unknown>[]>(
        components: [...T],
        callback: (entity: Entity, ...components: ComponentInstances<T>) => void
    ): IRegistry {
        if (components.length == 0) {console.warn("ForEach-ing with zero component queries!"); return this}

        const componentRegistries = components.map((component)=>this._getComponentRegistryOrThrow(component))

        // Iterate the SMALLEST registry so we touch the fewest entities.
        let smallestRegistry = componentRegistries[0] as IComponentRegistry<unknown>

        for (const compareComponentRegistry of componentRegistries) {
            if (compareComponentRegistry.Size() < smallestRegistry.Size()) {
                smallestRegistry = compareComponentRegistry
            }
        }

        // Single pass: reuse the component ForEach already yields for the smallest
        // registry (no lookup), and call GetEntity exactly once for each other registry,
        // folding the "has every component" check into the instance-fetch.
        smallestRegistry.ForEach((entity, smallestComponent) => {
            const instances: unknown[] = []
            let complete = true

            // Build in the ORIGINAL `components` order (componentRegistries preserves it).
            for (const registry of componentRegistries) {
                if (registry === smallestRegistry) {
                    instances.push(smallestComponent)
                    continue
                }

                const component = registry.GetComponent(entity)
                if (component === undefined) { complete = false; break }
                instances.push(component)
            }

            if (!complete) return

            callback(entity, ...(instances as ComponentInstances<T>));
        });

        return this
    }

    _getComponentRegistryOrThrow<ComponentType>(component : IClassConstructor<ComponentType>) {
        const attempt = this.ComponentRegistry.get(component)

        if (attempt === undefined) throw new Error(`Component ${component.name} is not defined yet! Please define component first before using!`)
        if (attempt.GetComponentType() != component) throw new Error(`Component ${component.name} ${component.toString()} is in a weird state where component class is off! Please investigate!`)

        return attempt
    }
    
}