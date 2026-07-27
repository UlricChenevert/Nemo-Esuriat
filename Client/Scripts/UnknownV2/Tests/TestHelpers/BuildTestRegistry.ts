import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { OwnedBy } from "../../Contracts/Components/OwnedBy.ts";
import { Owns } from "../../Contracts/Components/Owns.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { IsPlayer } from "../../Contracts/Tags/IsPlayer.ts";
import { IsSelectable } from "../../Contracts/Components/IsSelectible.ts";
import { IsCollidable } from "../../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../../Contracts/Tags/IsMovable.ts";
import { DecidesMovement } from "../../Contracts/Tags/DecidesMovement.ts";
import { MovementFlag } from "../../Contracts/Tags/MovementFlag.ts";
import { HashMapComponentRegistry } from "../../Systems.Framework/ComponentRegistry.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { GlobalRegistry } from "../../Systems.Framework/Registry.ts";

/**
 * A registry with the components the world systems touch already registered.
 *
 * GlobalRegistry throws on any lookup of an unregistered component, and Owns is
 * needed even when unused because DestroyEntity consults it to cascade.
 */
export function BuildTestRegistry() : GlobalRegistry {
    return new GlobalRegistry()
        .RegisterComponentRegistry(Position, new HashMapComponentRegistry(Position))
        .RegisterComponentRegistry(Layer, new HashMapComponentRegistry(Layer))
        .RegisterComponentRegistry(Representation, new HashMapComponentRegistry(Representation))
        .RegisterComponentRegistry(MultiTileRepresentation, new HashMapComponentRegistry(MultiTileRepresentation))
        .RegisterComponentRegistry(ChunkCoordinate, new HashMapComponentRegistry(ChunkCoordinate))
        .RegisterComponentRegistry(IsPlayer, new HashMapComponentRegistry(IsPlayer))
        .RegisterComponentRegistry(Owns, new HashMapComponentRegistry(Owns))
        .RegisterComponentRegistry(OwnedBy, new HashMapComponentRegistry(OwnedBy))
        // Every tag EntityBuilder.AddTags and AddMovement can write. A helper that
        // registered only what the world systems read would throw the moment a
        // test built an entity with a tag those systems ignore.
        .RegisterComponentRegistry(IsSelectable, new HashMapComponentRegistry(IsSelectable))
        .RegisterComponentRegistry(IsCollidable, new HashMapComponentRegistry(IsCollidable))
        .RegisterComponentRegistry(DecidesMovement, new HashMapComponentRegistry(DecidesMovement))
        .RegisterComponentRegistry(MovementFlag, new HashMapComponentRegistry(MovementFlag))
        .RegisterComponentRegistry(IsMoveable, new HashMapComponentRegistry(IsMoveable))
        // What the input and movement systems read and write.
        .RegisterComponentRegistry(SelectionState, new HashMapComponentRegistry(SelectionState))
        .RegisterComponentRegistry(TargetLocation, new HashMapComponentRegistry(TargetLocation)) as GlobalRegistry
}

/** Adds a player entity at the given world position. */
export function AddPlayerAt(registry : GlobalRegistry, x : number, y : number) {
    return new EntityBuilder(registry)
        .AddPosition(new Position(x, y))
        .AddTags(false, false, true, true)
        .GetEntity()
}
