import {} from "../Interfaces/IComponentRegistry.js";
export class HashMapComponentRegistry {
    ComponentConstructor;
    Container;
    constructor(ComponentConstructor) {
        this.ComponentConstructor = ComponentConstructor;
        this.Container = new Map();
    }
    GetComponentType() {
        return this.ComponentConstructor;
    }
    // Map.prototype.forEach tolerates deletion of the currently visited key, so
    // this satisfies IComponentRegistry.ForEach's mutation contract natively.
    ForEach(callback) {
        this.Container.forEach((value, key) => callback(key, value));
    }
    SetComponent(entity, component) {
        this.Container.set(entity, component);
        return this;
    }
    RemoveComponent(entity) {
        return this.Container.delete(entity);
    }
    GetComponent(entity) {
        return this.Container.get(entity);
    }
    Size() {
        return this.Container.size;
    }
}
//# sourceMappingURL=ComponentRegistry.js.map