import type { Entity } from "../Contracts/Components/Entity.ts";
import type { IClassConstructor } from "../Interfaces/IClassConstructor.ts";
import { type IComponentRegistry } from "../Interfaces/IComponentRegistry.ts";
export declare class HashMapComponentRegistry<Component> implements IComponentRegistry<Component> {
    ComponentConstructor: IClassConstructor<Component>;
    Container: Map<Entity, Component>;
    constructor(ComponentConstructor: IClassConstructor<Component>);
    GetComponentType(): IClassConstructor<Component>;
    ForEach(callback: (entity: Entity, component: Component) => void): void;
    SetComponent(entity: Entity, component: Component): IComponentRegistry<Component>;
    RemoveComponent(entity: Entity): boolean;
    GetComponent(entity: Entity): Component | undefined;
    Size(): number;
}
//# sourceMappingURL=ComponentRegistry.d.ts.map