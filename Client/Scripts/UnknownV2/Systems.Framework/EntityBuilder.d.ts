import type { Entity } from "../Contracts/Components/Entity.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { DecidesMovement } from "../Contracts/Tags/DecidesMovement.ts";
import type { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
export declare class EntityBuilder {
    private registry;
    entity: Entity;
    constructor(registry: IRegistry);
    AddPosition(position: Position): this;
    AddRepresentation(representation: Representation): this;
    AddLayer(layer: Layer): this;
    AddTags(isSelectable: boolean, isCollidable: boolean, isMoveable: boolean, isPlayer: IsPlayer, decidesMovement: DecidesMovement): this;
    AddOwner(owner: Entity): this;
    GetEntity(): Entity;
    AddText(text: string, position: Position): this;
}
//# sourceMappingURL=EntityBuilder.d.ts.map