import type { Entity } from "../Contracts/Entity";
import { IsCollidable } from "../Contracts/IsCollideable";
import { IsConscious as IsConsciousness } from "../Contracts/IsConcious";
import { IsMoveable } from "../Contracts/IsMovable";
import { IsPlayer } from "../Contracts/IsPlayer";
import { IsSelected } from "../Contracts/IsSelected";
import { IsSelectable } from "../Contracts/IsSelectible";
import { Layer } from "../Contracts/Layer";
import { Position } from "../Contracts/Position";
import { Representation } from "../Contracts/Representation";
import type { IRegistry } from "../Interfaces/IRegistry";

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

    AddTags(isSelectable : boolean, isCollidable : boolean, isMoveable : boolean) {
        if (isSelectable) this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable())
        if (isCollidable) this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable())
        if (isMoveable) this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable())
    }

    AddIsSelected(target : Entity, source : Entity) {
        this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelected(target, source))
    }

    AddIsConsciousness(isPlayer? : boolean) {
        this.registry.RegisterEntity(this.entity, IsConsciousness, new IsConsciousness())
        if (isPlayer) this.registry.RegisterEntity(this.entity, IsPlayer, new IsPlayer())
    }
}