import { GameWidth } from "../../Configuration/GameConstants.ts";
import { ChunkCoordinate } from "../../Contracts/Components/ChunkCoordinate.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { CollectingResource } from "../../Contracts/Components/CollectingResource.ts";
import { IsPredator } from "../../Contracts/Components/IsPredator.ts";
import { Human } from "../../Contracts/Tags/Human.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { OwnedBy } from "../../Contracts/Components/OwnedBy.ts";
import { Owns } from "../../Contracts/Components/Owns.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { IsPlayer } from "../../Contracts/Tags/IsPlayer.ts";
import { IsCamera } from "../../Contracts/Tags/IsCamera.ts";
import { IsSelectable } from "../../Contracts/Components/IsSelectible.ts";
import { IsCollidable } from "../../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../../Contracts/Tags/IsMovable.ts";
import { DecidesMovement } from "../../Contracts/Tags/DecidesMovement.ts";
import { MovementFlag } from "../../Contracts/Tags/MovementFlag.ts";
import { ActionListener } from "../../Contracts/Components/ActionListener.ts";
import { ClickListener } from "../../Contracts/Components/ClickListener.ts";
import { InputLayer } from "../../Contracts/Components/InputLayer.ts";
import { MenuState } from "../../Contracts/Components/MenuState.ts";
import { HudState } from "../../Contracts/Components/HudState.ts";
import { Carcass } from "../../Contracts/Components/Carcass.ts";
import { Consumable } from "../../Contracts/Components/Consumable.ts";
import { ScreenPosition } from "../../Contracts/Components/ScreenPosition.ts";
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
        .RegisterComponentRegistry(IsCamera, new HashMapComponentRegistry(IsCamera))
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
        .RegisterComponentRegistry(Human, new HashMapComponentRegistry(Human))
        // What the input and movement systems read and write.
        .RegisterComponentRegistry(SelectionState, new HashMapComponentRegistry(SelectionState))
        .RegisterComponentRegistry(TargetLocation, new HashMapComponentRegistry(TargetLocation))
        // EntityBuilder.MakeHerd writes this, so it is reachable from any test
        // that builds a herd, not only from the AI movement tests.
        .RegisterComponentRegistry(HerdOwner, new HashMapComponentRegistry(HerdOwner))
        // Input routing and menus. Registered here even for tests that never
        // touch input, because ResolveInputActions and RenderCanvas query these
        // unconditionally and an unregistered component is a throw, not a miss.
        .RegisterComponentRegistry(ActionListener, new HashMapComponentRegistry(ActionListener))
        .RegisterComponentRegistry(ClickListener, new HashMapComponentRegistry(ClickListener))
        .RegisterComponentRegistry(InputLayer, new HashMapComponentRegistry(InputLayer))
        .RegisterComponentRegistry(ScreenPosition, new HashMapComponentRegistry(ScreenPosition))
        .RegisterComponentRegistry(MenuState, new HashMapComponentRegistry(MenuState))
        .RegisterComponentRegistry(HudState, new HashMapComponentRegistry(HudState))
        // The herd AI's own state. MakeHerd writes HerdGoal and Needs alongside
        // HerdOwner; the other two only appear once a herd is running. All four are
        // registered regardless, because an unregistered component throws on the
        // first LOOKUP rather than the first write -- and the AI looks all of them
        // up on its first tick.
        .RegisterComponentRegistry(HerdGoal, new HashMapComponentRegistry(HerdGoal))
        .RegisterComponentRegistry(Needs, new HashMapComponentRegistry(Needs))
        .RegisterComponentRegistry(CollectingResource, new HashMapComponentRegistry(CollectingResource))
        .RegisterComponentRegistry(IsPredator, new HashMapComponentRegistry(IsPredator))
        // Dying and being eaten. MakeHerd writes Consumable on every animal, and
        // KillEntity looks both of these up on the first death.
        .RegisterComponentRegistry(Consumable, new HashMapComponentRegistry(Consumable))
        .RegisterComponentRegistry(Carcass, new HashMapComponentRegistry(Carcass)) as GlobalRegistry
}

/** Adds a player entity at the given world position. */
export function AddPlayerAt(registry : GlobalRegistry, x : number, y : number) {
    return new EntityBuilder(registry)
        .AddPosition(new Position(x, y))
        .AddTags(false, false, true, true)
        .GetEntity()
}

/**
 * Adds the camera entity looking at the given world position.
 *
 * `x` and `y` are the CENTRE of the viewport, not its top-left corner. Use
 * AddCameraViewing when a test cares about which world tile the corner sits on.
 */
export function AddCameraAt(registry : GlobalRegistry, x : number, y : number) {
    return new EntityBuilder(registry)
        .AddPosition(new Position(x, y))
        .AddCamera()
        .GetEntity()
}

/**
 * Adds the camera entity positioned so the viewport's top-left corner lands on
 * the given world tile.
 *
 * The corner is what the renderer and the streaming buffer are expressed in
 * terms of, so a test asserting about screen layout reads far better stating the
 * corner than stating a centre half a viewport away from the thing it means.
 */
export function AddCameraViewing(registry : GlobalRegistry, originX : number, originY : number) {
    return AddCameraAt(registry, originX + GameWidth / 2, originY + GameWidth / 2)
}
