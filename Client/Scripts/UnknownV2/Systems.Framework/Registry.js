import { EntityHandle, MaxEntityIndex, MaxEntityVersion } from "../Contracts/Components/Entity.js";
import { Owns } from "../Contracts/Components/Owns.js";
export class GlobalRegistry {
    ComponentRegistry;
    /** _versions[i] is slot i's CURRENT generation. Always >= 1 once allocated. */
    _versions = [];
    /** _alive[i] mirrors whether slot i is presently allocated. */
    _alive = [];
    /** Indices of destroyed slots, available for reuse (LIFO). */
    _freeIndices = [];
    constructor() { this.ComponentRegistry = new Map(); }
    CreateEntity() {
        const recycledIndex = this._freeIndices.pop();
        if (recycledIndex !== undefined) {
            this._alive[recycledIndex] = true;
            // The version was already bumped at destruction time, so every
            // handle to this slot's previous occupant is already stale.
            return EntityHandle.Make(recycledIndex, this._versions[recycledIndex] ?? 1);
        }
        const newIndex = this._versions.length;
        if (newIndex > MaxEntityIndex) {
            throw new RangeError(`Entity capacity exhausted (${MaxEntityIndex + 1} slots).`);
        }
        this._versions.push(1);
        this._alive.push(true);
        return EntityHandle.Make(newIndex, 1);
    }
    DestroyEntity(entity) {
        // Idempotent: double-destroying must not push a duplicate onto the free
        // list, which would hand the same slot out to two live entities.
        if (!this.IsAlive(entity))
            return this;
        const index = EntityHandle.Index(entity);
        const entityToDelete = this._getComponentRegistryOrThrow(Owns).GetComponent(entity);
        if (entityToDelete) {
            this.DestroyEntity(entityToDelete.entity);
        }
        this.ComponentRegistry.forEach((componentRegistry) => { componentRegistry.RemoveComponent(entity); });
        // Bump the generation so every outstanding handle to this slot goes
        // stale. Wrap back to 1, never 0, preserving "no live handle is 0".
        const nextVersion = (this._versions[index] ?? 1) + 1;
        this._versions[index] = nextVersion > MaxEntityVersion ? 1 : nextVersion;
        this._alive[index] = false;
        this._freeIndices.push(index);
        return this;
    }
    IsAlive(entity) {
        const index = EntityHandle.Index(entity);
        return this._alive[index] === true && this._versions[index] === EntityHandle.Version(entity);
    }
    GetComponent(entity, componentClass) {
        const componentRegistry = this._getComponentRegistryOrThrow(componentClass);
        return componentRegistry?.GetComponent(entity);
    }
    RemoveComponent(entity, componentClass) {
        const componentRegistry = this._getComponentRegistryOrThrow(componentClass);
        return componentRegistry.RemoveComponent(entity);
    }
    RegisterComponentRegistry(componentClass, registry) {
        this.ComponentRegistry.set(componentClass, registry);
        return this;
    }
    RegisterEntity(entity, componentClass, component) {
        let currentRegistry = this._getComponentRegistryOrThrow(componentClass);
        currentRegistry.SetComponent(entity, component);
        return this;
    }
    ForEachEntityWith(components, callback) {
        if (components.length == 0) {
            console.warn("ForEach-ing with zero component queries!");
            return this;
        }
        const componentRegistries = components.map((component) => this._getComponentRegistryOrThrow(component));
        // Iterate the SMALLEST registry so we touch the fewest entities.
        let smallestRegistry = componentRegistries[0];
        for (const compareComponentRegistry of componentRegistries) {
            if (compareComponentRegistry.Size() < smallestRegistry.Size()) {
                smallestRegistry = compareComponentRegistry;
            }
        }
        // Single pass: reuse the component ForEach already yields for the smallest
        // registry (no lookup), and call GetEntity exactly once for each other registry,
        // folding the "has every component" check into the instance-fetch.
        smallestRegistry.ForEach((entity, smallestComponent) => {
            const instances = [];
            let complete = true;
            // Build in the ORIGINAL `components` order (componentRegistries preserves it).
            for (const registry of componentRegistries) {
                if (registry === smallestRegistry) {
                    instances.push(smallestComponent);
                    continue;
                }
                const component = registry.GetComponent(entity);
                if (component === undefined) {
                    complete = false;
                    break;
                }
                instances.push(component);
            }
            if (!complete)
                return;
            callback(entity, ...instances);
        });
        return this;
    }
    _getComponentRegistryOrThrow(component) {
        const attempt = this.ComponentRegistry.get(component);
        if (attempt === undefined)
            throw new Error(`Component ${component.name} is not defined yet! Please define component first before using!`);
        if (attempt.GetComponentType() != component)
            throw new Error(`Component ${component.name} ${component.toString()} is in a weird state where component class is off! Please investigate!`);
        return attempt;
    }
}
//# sourceMappingURL=Registry.js.map