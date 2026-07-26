import { TextColor, TextLayer } from "../Configuration/DisplayConstants.js";
import { IsSelectable } from "../Contracts/Components/IsSelectible.js";
import { Layer } from "../Contracts/Components/Layer.js";
import { OwnedBy } from "../Contracts/Components/OwnedBy.js";
import { Owns } from "../Contracts/Components/Owns.js";
import { Position } from "../Contracts/Components/Position.js";
import { Representation } from "../Contracts/Components/Representation.js";
import { DecidesMovement } from "../Contracts/Tags/DecidesMovement.js";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
export class EntityBuilder {
    registry;
    entity;
    constructor(registry) {
        this.registry = registry;
        this.entity = this.registry.CreateEntity();
        return this;
    }
    AddPosition(position) {
        this.registry.RegisterEntity(this.entity, Position, position);
        return this;
    }
    AddRepresentation(representation) {
        this.registry.RegisterEntity(this.entity, Representation, new Representation(representation.model, representation.color.Copy()));
        return this;
    }
    AddLayer(layer) {
        this.registry.RegisterEntity(this.entity, Layer, layer);
        return this;
    }
    AddTags(isSelectable, isCollidable, isMoveable, isPlayer, decidesMovement) {
        if (isSelectable)
            this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable);
        if (isCollidable)
            this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable());
        if (isMoveable)
            this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable());
        if (decidesMovement)
            this.registry.RegisterEntity(this.entity, DecidesMovement, new DecidesMovement());
        return this;
    }
    AddOwner(owner) {
        this.registry.RegisterEntity(this.entity, OwnedBy, new OwnedBy(owner));
        this.registry.RegisterEntity(owner, Owns, new Owns(this.entity));
        return this;
    }
    GetEntity() {
        return this.entity;
    }
    AddText(text, position) {
        let newLines = 0;
        let startingPosition = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] == '\n') {
                newLines++;
                startingPosition -= i + 1;
                continue;
            }
            const x = position.x + i + startingPosition;
            const y = position.y + newLines;
            new EntityBuilder(this.registry)
                .AddOwner(this.entity)
                .AddRepresentation(new Representation(text[i], TextColor))
                .AddPosition(new Position(x, y))
                .AddLayer(new Layer(TextLayer));
        }
        return this;
    }
}
//# sourceMappingURL=EntityBuilder.js.map