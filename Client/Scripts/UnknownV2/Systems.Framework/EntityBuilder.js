import { AnimalLayer, GameColors, TextColor, TextLayer } from "../Configuration/DisplayConstants.js";
import { ChunkCoordinate } from "../Contracts/Components/ChunkCoordinate.js";
import { IsSelectable } from "../Contracts/Components/IsSelectible.js";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.js";
import { Layer } from "../Contracts/Components/Layer.js";
import { OwnedBy } from "../Contracts/Components/OwnedBy.js";
import { Owns } from "../Contracts/Components/Owns.js";
import { Position } from "../Contracts/Components/Position.js";
import { Representation } from "../Contracts/Components/Representation.js";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.js";
import { IsMoveable } from "../Contracts/Tags/IsMovable.js";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.js";
import { Human } from "../Contracts/Tags/Human.js";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.js";
import { HerdOwner } from "../Contracts/Components/HerdOwner.js";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.js";
import { AnimalSpeed } from "../Configuration/GameConstants.js";
export class EntityBuilder {
    registry;
    entity;
    constructor(registry, entity) {
        this.registry = registry;
        this.entity = (entity) ? entity : this.registry.CreateEntity();
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
    /**
     * Unlike AddRepresentation, this stores the component as given. The palette
     * is shared by design, and the tile indices are large enough that copying
     * them per entity would defeat the point of the compact representation.
     */
    AddMultiTileRepresentation(multiTileRepresentation) {
        this.registry.RegisterEntity(this.entity, MultiTileRepresentation, multiTileRepresentation);
        return this;
    }
    AddChunkCoordinate(chunkCoordinate) {
        this.registry.RegisterEntity(this.entity, ChunkCoordinate, chunkCoordinate);
        return this;
    }
    AddMovement(speed) {
        this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable(speed));
        return this;
    }
    AddTags(isSelectable, isCollidable, isPlayer, movementFlag) {
        if (isSelectable)
            this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable);
        if (isCollidable)
            this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable());
        if (isPlayer)
            this.registry.RegisterEntity(this.entity, IsPlayer, new IsPlayer());
        if (movementFlag)
            this.registry.RegisterEntity(this.entity, MovementFlag, new MovementFlag());
        return this;
    }
    /**
     * Its own method rather than a fifth flag on AddTags: the boolean list there
     * is already hard to read at the call site, and unlike those, this one says
     * what the entity *is* rather than which systems may touch it.
     */
    AddHuman() {
        this.registry.RegisterEntity(this.entity, Human, new Human());
        return this;
    }
    AddOwner(owner) {
        this.registry.RegisterEntity(this.entity, OwnedBy, new OwnedBy(owner));
        // Append to the owner's existing Owns rather than replacing it, otherwise
        // each new child would evict its predecessor and orphan it.
        const existingOwns = this.registry.GetComponent(owner, Owns);
        if (existingOwns) {
            existingOwns.Add(this.entity);
        }
        else {
            this.registry.RegisterEntity(owner, Owns, new Owns(this.entity));
        }
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
    MakeHerd(position, amount, representationString) {
        const herd = new HerdOwner();
        this.registry.RegisterEntity(this.entity, HerdOwner, herd);
        const random = new LinearCongruentialGenerator(Date.now());
        for (let i = 0; i < amount; i++) {
            const distance = random.Random();
            const direction = random.Random() * 2 * Math.PI;
            const xDelta = Math.cos(direction) * distance;
            const yDelta = Math.sin(direction) * distance;
            const newPostion = new Position(position.x + xDelta, position.y + yDelta);
            new EntityBuilder(this.registry)
                .AddPosition(newPostion)
                .AddRepresentation(new Representation(representationString, GameColors.Animal))
                .AddLayer(new Layer(AnimalLayer))
                .AddMovement(AnimalSpeed)
                .AddOwner(this.entity)
                .GetEntity();
        }
    }
}
//# sourceMappingURL=EntityBuilder.js.map