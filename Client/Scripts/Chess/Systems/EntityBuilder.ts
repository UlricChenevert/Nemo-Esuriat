import { TextColor, TextLayer } from "../Configuration/DisplayConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { IsChessPiece } from "../Contracts/IsChessPiece.ts";
import { IsCollidable } from "../Contracts/IsCollideable.ts";
import { IsConscious as IsConsciousness } from "../Contracts/IsConcious.ts";
import { IsMoveable } from "../Contracts/IsMovable.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { IsSelectable } from "../Contracts/IsSelectible.ts";
import { Layer } from "../Contracts/Layer.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { Owns } from "../Contracts/Owns.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
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
        this.registry.RegisterEntity(this.entity, Representation, representation)
        return this
    }

    AddLayer(layer : Layer) {
        this.registry.RegisterEntity(this.entity, Layer, layer)
        return this
    }

    AddTags(isSelectable : boolean, isCollidable : boolean, isMoveable : boolean, isChessPiece : boolean) {
        if (isSelectable) this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable())
        if (isCollidable) this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable())
        if (isMoveable) this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable())
        if (isChessPiece) this.registry.RegisterEntity(this.entity, IsChessPiece, new IsChessPiece())

        return this
    }

    AddIsConsciousness(isPlayer? : boolean) {
        this.registry.RegisterEntity(this.entity, IsConsciousness, new IsConsciousness())
        if (isPlayer) this.registry.RegisterEntity(this.entity, IsPlayer, new IsPlayer())

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