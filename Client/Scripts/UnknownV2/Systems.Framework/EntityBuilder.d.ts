import { ChunkCoordinate } from "../Contracts/Components/ChunkCoordinate.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
export declare class EntityBuilder {
    private registry;
    entity: Entity;
    constructor(registry: IRegistry, entity?: Entity);
    AddPosition(position: Position): this;
    AddRepresentation(representation: Representation): this;
    AddLayer(layer: Layer): this;
    /**
     * Unlike AddRepresentation, this stores the component as given. The palette
     * is shared by design, and the tile indices are large enough that copying
     * them per entity would defeat the point of the compact representation.
     */
    AddMultiTileRepresentation(multiTileRepresentation: MultiTileRepresentation): this;
    AddChunkCoordinate(chunkCoordinate: ChunkCoordinate): this;
    AddMovement(speed: number): this;
    AddTags(isSelectable: boolean, isCollidable: boolean, isPlayer: boolean, movementFlag?: boolean): this;
    /**
     * Its own method rather than a fifth flag on AddTags: the boolean list there
     * is already hard to read at the call site, and unlike those, this one says
     * what the entity *is* rather than which systems may touch it.
     */
    AddHuman(): this;
    AddOwner(owner: Entity): this;
    GetEntity(): Entity;
    AddText(text: string, position: Position): this;
    MakeHerd(position: Position, amount: number, representationString: string): void;
}
//# sourceMappingURL=EntityBuilder.d.ts.map