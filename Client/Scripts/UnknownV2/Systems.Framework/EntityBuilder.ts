import { TextColor, TextLayer } from "../Configuration/DisplayConstants.ts";
import { ChunkCoordinate } from "../Contracts/Components/ChunkCoordinate.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { IsSelectable } from "../Contracts/Components/IsSelectible.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { DecidesMovement } from "../Contracts/Tags/DecidesMovement.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.ts";

export class EntityBuilder {
    entity : Entity
    
    constructor (private registry : IRegistry, entity? : Entity) {
        this.entity = (entity)? entity : this.registry.CreateEntity()
        
        return this
    }

    AddPosition(position : Position) {
        this.registry.RegisterEntity(this.entity, Position, position)
        return this
    }

    AddRepresentation(representation : Representation) {
        this.registry.RegisterEntity(this.entity, Representation, new Representation(representation.model, representation.color.Copy()))
        return this
    }

    AddLayer(layer : Layer) {
        this.registry.RegisterEntity(this.entity, Layer, layer)
        return this
    }

    /**
     * Unlike AddRepresentation, this stores the component as given. The palette
     * is shared by design, and the tile indices are large enough that copying
     * them per entity would defeat the point of the compact representation.
     */
    AddMultiTileRepresentation(multiTileRepresentation : MultiTileRepresentation) {
        this.registry.RegisterEntity(this.entity, MultiTileRepresentation, multiTileRepresentation)
        return this
    }

    AddChunkCoordinate(chunkCoordinate : ChunkCoordinate) {
        this.registry.RegisterEntity(this.entity, ChunkCoordinate, chunkCoordinate)
        return this
    }

    AddMovement(speed : number) {
        this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable(speed))

        return this
    }

    AddTags(isSelectable : boolean, isCollidable : boolean, isPlayer : boolean, movementFlag? : boolean) {
        if (isSelectable) this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable)
        if (isCollidable) this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable())
        if (isPlayer) this.registry.RegisterEntity(this.entity, IsPlayer, new IsPlayer())
        if (movementFlag) this.registry.RegisterEntity(this.entity, MovementFlag, new MovementFlag())

        return this
    }

    AddOwner(owner : Entity) {

        this.registry.RegisterEntity(this.entity, OwnedBy, new OwnedBy(owner))
        this.registry.RegisterEntity(owner, Owns, new Owns(this.entity)) 
        return this
    }

    GetEntity () {
        return this.entity
    }

    AddText(text : string, position : Position) {
        
        let newLines = 0
        let startingPosition = 0

        for (let i = 0; i < text.length; i++) {
            if (text[i]! == '\n') {newLines++; startingPosition -= i + 1; continue}

            const x = position.x + i + startingPosition
            const y = position.y + newLines

            new EntityBuilder(this.registry)
                .AddOwner(this.entity)
                .AddRepresentation(new Representation(text[i]!, TextColor))
                .AddPosition(new Position(x, y))
                .AddLayer(new Layer(TextLayer))
        }

        return this
    }
}