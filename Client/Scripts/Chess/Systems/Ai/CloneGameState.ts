import type { Entity } from "../../Contracts/Entity.ts";
import { HasMoved } from "../../Contracts/HasMoved.ts";
import { IsChessPiece } from "../../Contracts/IsChessPiece.ts";
import { IsCollidable } from "../../Contracts/IsCollideable.ts";
import { IsConscious } from "../../Contracts/IsConcious.ts";
import { IsCurrentTurn } from "../../Contracts/IsCurrentTurn.ts";
import { IsGoingDown } from "../../Contracts/IsGoingDown.ts";
import { IsMoveable } from "../../Contracts/IsMovable.ts";
import { IsPlayer } from "../../Contracts/IsPlayer.ts";
import { JustDoubleStepped } from "../../Contracts/JustDoubleStepped.ts";
import { PendingPromotion } from "../../Contracts/PendingPromotion.ts";
import { MovementRules } from "../../Contracts/MovementRules.ts";
import { OwnedBy } from "../../Contracts/OwnedBy.ts";
import { Owns } from "../../Contracts/Owns.ts";
import { Position } from "../../Contracts/Position.ts";
import { Representation } from "../../Contracts/Representation.ts";
import type { IClassConstructor } from "../../Interfaces/IClassConstructor.ts";
import type { IRegistry } from "../../Interfaces/IRegistry.ts";
import { HashMapComponentRegistry } from "../ComponentRegistry.ts";
import { GlobalRegistry } from "../Registry.ts";

/**
 * A self-contained copy of the board the search can mutate freely and throw away, plus
 * the map that turns a handle in the original registry into its twin in the clone.
 */
export interface ClonedGameState {
    registry : GlobalRegistry
    translate : Map<Entity, Entity>
}

/**
 * The components the clone has to register. DestroyEntity touches the Owns registry
 * unconditionally (to cascade owned entities), so it has to be present even though no
 * piece owns anything — hence its inclusion here.
 */
const ClonedComponents : IClassConstructor<unknown>[] = [
    Position, Representation, MovementRules, OwnedBy, Owns,
    IsChessPiece, IsCollidable, IsMoveable, IsConscious, IsCurrentTurn,
    IsGoingDown, HasMoved, JustDoubleStepped,
    // Not copied onto any clone, but ApplyMove runs the real HandleSpecialMoves, which
    // reads IsPlayer and may write PendingPromotion — so both registries must exist.
    IsPlayer, PendingPromotion,
]

/** Tag components copied by mere presence — a fresh empty instance on the twin. */
const CopiedTags : IClassConstructor<object>[] = [
    IsChessPiece, IsCollidable, IsMoveable, IsConscious, IsCurrentTurn,
    IsGoingDown, HasMoved, JustDoubleStepped,
]

/**
 * Clones the parts of the board the move generator reads: the two conscious sides and
 * every piece, with their positions, representations, rules and state tags.
 *
 * Deliberately omitted: IsPlayer. A cloned side is never "the player", so promotions in
 * search auto-queen through the real HandleSpecialMoves instead of stalling on a prompt
 * that has no one to answer it. Board tiles are omitted too — nothing in move generation
 * or collision (which needs IsCollidable, and tiles have none) looks at them.
 */
export function CloneGameState (source : IRegistry) : ClonedGameState {
    const registry = new GlobalRegistry()

    for (const component of ClonedComponents) {
        registry.RegisterComponentRegistry(component, new HashMapComponentRegistry(component))
    }

    const translate = new Map<Entity, Entity>()
    const originals : Entity[] = []

    const remember = (entity : Entity) => {
        if (translate.has(entity)) return
        translate.set(entity, registry.CreateEntity())
        originals.push(entity)
    }

    source.ForEachEntityWith([IsConscious], remember)
    source.ForEachEntityWith([IsChessPiece, Position], remember)

    for (const original of originals) {
        CopyComponents(source, registry, original, translate)
    }

    return { registry, translate }
}

function CopyComponents (source : IRegistry, target : GlobalRegistry, original : Entity, translate : Map<Entity, Entity>) {
    const clone = translate.get(original)!

    const position = source.GetComponent(original, Position)
    if (position !== undefined) target.RegisterEntity(clone, Position, new Position(position.x, position.y))

    const representation = source.GetComponent(original, Representation)
    if (representation !== undefined) target.RegisterEntity(clone, Representation, new Representation(representation.model, representation.color.Copy()))

    const rules = source.GetComponent(original, MovementRules)
    if (rules !== undefined) target.RegisterEntity(clone, MovementRules, new MovementRules(rules.generateValidMoves))

    const ownedBy = source.GetComponent(original, OwnedBy)
    // A piece's owner is one of the conscious sides, always already in the map.
    if (ownedBy !== undefined) target.RegisterEntity(clone, OwnedBy, new OwnedBy(translate.get(ownedBy.owner) ?? ownedBy.owner))

    for (const Tag of CopiedTags) {
        if (source.GetComponent(original, Tag) !== undefined) target.RegisterEntity(clone, Tag, new Tag())
    }
}
