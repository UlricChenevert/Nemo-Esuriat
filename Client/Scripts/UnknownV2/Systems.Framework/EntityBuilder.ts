import { TextColor, TextLayer } from "../Configuration/DisplayConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

export class EntityBuilder {
    entity : Entity
    
    constructor (private registry : IRegistry) {
        this.entity = this.registry.CreateEntity()
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

    AddTags(isSelectable : boolean, isCollidable : boolean, isMoveable : boolean, isChessPiece : boolean) {
        if (isCollidable) this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable())
        if (isMoveable) this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable())

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