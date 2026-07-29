import { AnimalLayer, GameColors, TextColor, TextLayer } from "../Configuration/DisplayConstants.ts";
import { ChunkCoordinate } from "../Contracts/Components/ChunkCoordinate.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { IsSelectable } from "../Contracts/Components/IsSelectible.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import { Human } from "../Contracts/Tags/Human.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.ts";
import { AnimalSpeed } from "../Configuration/GameConstants.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";

/**
 * The fallback source of herd layouts, for callers with no generator of their
 * own to pass. Shared rather than per-herd so successive herds keep drawing from
 * one sequence instead of restarting it.
 */
const herdLayoutGenerator = new LinearCongruentialGenerator(Date.now())

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

    /**
     * Its own method rather than a fifth flag on AddTags: the boolean list there
     * is already hard to read at the call site, and unlike those, this one says
     * what the entity *is* rather than which systems may touch it.
     */
    AddHuman() {
        this.registry.RegisterEntity(this.entity, Human, new Human())

        return this
    }

    AddOwner(owner : Entity) {

        this.registry.RegisterEntity(this.entity, OwnedBy, new OwnedBy(owner))

        // Append to the owner's existing Owns rather than replacing it, otherwise
        // each new child would evict its predecessor and orphan it.
        const existingOwns = this.registry.GetComponent(owner, Owns)

        if (existingOwns) {
            existingOwns.Add(this.entity)
        } else {
            this.registry.RegisterEntity(owner, Owns, new Owns(this.entity))
        }

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

    /**
     * Turns this entity into the owner of a herd of `amount` animals scattered
     * around `position`.
     *
     * Takes a generator rather than seeding one per call, which is what the
     * first version did. Crossing a chunk boundary streams five chunks at once,
     * so herds are routinely built within the same millisecond -- identically
     * seeded, they came out as the same herd laid down twice.
     */
    MakeHerd(position : Position, amount : number, representationString : string, random : IRandomNumberGenerator = herdLayoutGenerator) {
        const herd = new HerdOwner()
        this.registry.RegisterEntity(this.entity, HerdOwner, herd)

        for (let i = 0; i < amount; i++) {
            const distance = random.Random() * herd.WanderRadius
            const direction = random.Random() * 2 * Math.PI

            const xDelta = Math.cos(direction) * distance
            const yDelta = Math.sin(direction) * distance

            const newPostion = new Position(position.x + xDelta, position.y + yDelta)
            
            new EntityBuilder(this.registry)
                .AddPosition(newPostion)
                .AddRepresentation(new Representation(representationString, GameColors.Animal))
                .AddLayer(new Layer(AnimalLayer))
                .AddMovement(AnimalSpeed)
                .AddOwner(this.entity)
                .GetEntity()
        }

        return this
    }
}