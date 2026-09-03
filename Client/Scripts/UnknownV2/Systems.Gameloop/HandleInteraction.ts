import { CharacterRepresentation } from "../Configuration/DisplayConstants.ts";
import { DrinkGainPerPress, InteractReachTiles } from "../Configuration/GameConstants.ts";
import { NeedKind } from "../Configuration/HerdConstants.ts";
import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import { Carcass } from "../Contracts/Components/Carcass.ts";
import { Consumable } from "../Contracts/Components/Consumable.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { KillEntity } from "../Utilities/MortalityUtilities.ts";
import { FindPlayerHumans } from "../Utilities/PlayerUtilities.ts";
import { isSameTile } from "../Utilities/PositionUtilities.ts";
import { IsDrinkableWater } from "../Utilities/TerrainUtilities.ts";

/**
 * Turns one Interact press into one thing happening in the world.
 *
 * Kill, then eat, then drink -- the first that applies wins, and nothing else runs
 * this press. A press is a single decision, and stacking effects would mean a
 * human standing in the shallows next to a deer killing it, eating it and drinking
 * from one keystroke.
 *
 * Kill leads because it is the one with a cost of being wrong. Water is still
 * there next press and so is a corpse; a deer walks away.
 */
export function HandleInteraction (context : ISystemContext) {
    const { registry, eventQueue, resources } = context

    // Collected first: acting kills and creates entities, and the registry only
    // promises that removing the entity currently being visited is safe.
    const players : Entity[] = []

    registry.ForEachEntityWith([IsPlayer, ActionListener], (player) => { players.push(player) })

    for (const player of players) {
        if (!registry.GetComponent(player, ActionListener)?.triggered.has("Interact")) continue

        const actor = FindActor(registry, player)

        if (actor !== undefined) Interact(registry, eventQueue, resources.World, actor)
    }
}

/**
 * Which body a press acts through: the selected one, or the only one there is.
 *
 * The player entity itself is never the actor. It is a bodiless controller parked
 * where it was created and moved by nothing, so reaching from its position would
 * measure distances from a point on the map the player left long ago.
 *
 * Falling back to the first human is what keeps the verb usable before anything has
 * been clicked. With several unselected humans it is ambiguous, and deliberately so:
 * selecting one is how the player says which.
 */
function FindActor (registry : IRegistry, player : Entity) : Entity | undefined {
    const humans = FindPlayerHumans(registry, player)
    const selected = registry.GetComponent(player, SelectionState)?.source

    if (selected !== undefined && humans.includes(selected)) return selected

    return humans[0]
}

function Interact (registry : IRegistry, eventQueue : IEventQueue, world : WorldStreamingResources, actor : Entity) {
    const position = registry.GetComponent(actor, Position)
    const needs = registry.GetComponent(actor, Needs)

    if (!position || !needs) return

    if (TryKill(registry, eventQueue, position, actor)) return
    if (TryEat(registry, position, needs)) return

    TryDrink(world, position, needs)
}

/**
 * Kills the nearest herd animal within reach, if there is one.
 *
 * Restricted to herd members -- something whose owner is a HerdOwner -- rather than
 * to anything with a body. That is what stops a press killing a corpse, a movement
 * flag, a text glyph or the human standing next to the one acting, without needing
 * a list of exceptions that grows every time something new gets a Position.
 *
 * Nearest rather than first found, and by straight-line distance rather than by
 * tile ring: positions are continuous mid-step, so a rule about adjacent tiles
 * would put an animal in and out of reach as it walked across a tile boundary.
 */
function TryKill (registry : IRegistry, eventQueue : IEventQueue, position : Position, actor : Entity) : boolean {
    let quarry : Entity | undefined
    let nearest = Number.POSITIVE_INFINITY

    registry.ForEachEntityWith([Needs, Position, OwnedBy], (candidate, _needs, candidatePosition, ownedBy)=>{
        if (candidate === actor) return
        if (!registry.IsAlive(ownedBy.owner)) return
        if (!registry.GetComponent(ownedBy.owner, HerdOwner)) return

        const distance = Math.hypot(candidatePosition.x - position.x, candidatePosition.y - position.y)

        if (distance > InteractReachTiles) return
        if (distance >= nearest) return

        nearest = distance
        quarry = candidate
    })

    if (quarry === undefined) return false

    KillEntity(registry, eventQueue, quarry)

    return true
}

/**
 * Eats from a corpse underfoot, if there is one with anything left on it.
 *
 * Takes as much as there is room for, so what the corpse loses is exactly what the
 * eater gains: a starving human nearly empties a deer and a comfortable one barely
 * dents it. Paying a fixed portion instead would either waste the remainder of a
 * carcass or overfill and silently discard the excess against the [0, 1] clamp.
 */
function TryEat (registry : IRegistry, position : Position, needs : Needs) : boolean {
    let meal : { consumable : Consumable, representation : Representation | undefined } | undefined

    registry.ForEachEntityWith([Carcass, Consumable, Position], (corpse, _carcass, consumable, corpsePosition)=>{
        if (meal !== undefined) return
        if (consumable.hungerUnits <= 0) return
        if (!isSameTile(position, corpsePosition)) return

        meal = { consumable : consumable, representation : registry.GetComponent(corpse, Representation) }
    })

    if (meal === undefined) return false

    const room = 1 - needs.hungerUnits
    const eaten = Math.min(meal.consumable.hungerUnits, room)

    // A full eater standing on a full corpse is not an interaction. Reporting it as
    // one would consume the press and leave the player unable to do the thing they
    // actually meant by it.
    if (eaten <= 0) return false

    needs.Add(NeedKind.Food, eaten)
    meal.consumable.hungerUnits -= eaten

    // Only the glyph changes, and only when there is nothing left. Representation
    // caches its fill style on the IDENTITY of its Color, so recolouring would mean
    // assigning a fresh Color rather than editing the one it holds -- the model has
    // no such cache and can be written straight.
    if (meal.consumable.hungerUnits <= 0 && meal.representation) {
        meal.representation.model = CharacterRepresentation.PickedCarcass
    }

    return true
}

/**
 * Drinks from the tile underfoot, if it is shallow enough to drink from.
 *
 * Instant, unlike an animal's drink, which is CollectingResource counting down
 * seconds of standing still. A human is not standing still on command -- nothing
 * would stop the player walking away mid-drink and being paid anyway -- so the
 * press is the whole transaction.
 */
function TryDrink (world : WorldStreamingResources, position : Position, needs : Needs) : boolean {
    if (!IsDrinkableWater(world, position.x, position.y)) return false

    needs.Add(NeedKind.Water, DrinkGainPerPress)

    return true
}
