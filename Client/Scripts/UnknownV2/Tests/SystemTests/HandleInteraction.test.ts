import { describe, it, expect } from "vitest";
import { CharacterRepresentation, GameColors, PlayerLayer } from "../../Configuration/DisplayConstants.ts";
import {
    AnimalSpeed, DefaultHungerUnits, DrinkGainPerPress, HumanSpeed, InteractReachTiles
} from "../../Configuration/GameConstants.ts";
import { ActionListener } from "../../Contracts/Components/ActionListener.ts";
import { Carcass } from "../../Contracts/Components/Carcass.ts";
import { Consumable } from "../../Contracts/Components/Consumable.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { RenderingResources, Resources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandleInteraction } from "../../Systems.Gameloop/HandleInteraction.ts";
import { PlayerActions } from "../../Systems.Gameloop/HandlePlayerActions.ts";
import type { ISystemContext } from "../../Interfaces/ISystemContext.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { BuildGrassWorld, BuildTestWorld, FlatNoise, ShallowWaterNoise } from "../TestHelpers/BuildTestWorld.ts";

/**
 * A world with a player controller, one human body, and dry ground everywhere.
 *
 * Grass by default so drinking is never the reason a press did something -- the
 * tests that care about water build their own world.
 */
function BuildWorld(world = BuildGrassWorld()) {
    const registry = BuildTestRegistry()
    const eventQueue = new EventQueue(new LinkedList())
    const resources = new Resources({} as RenderingResources, world)

    const inputLayer = PushInputLayer(registry, resources.Input)

    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .AddActionListener(inputLayer, ...PlayerActions)
        .GetEntity()

    const context : ISystemContext = { registry, eventQueue, resources }

    return { registry, eventQueue, resources, context, player }
}

type World = ReturnType<typeof BuildWorld>

/** A human body owned by the player, standing at (x, y). */
function AddHuman(world : World, x = 50, y = 50, needs = new Needs(0.5, 0.5, 1)) : Entity {
    return new EntityBuilder(world.registry)
        .AddPosition(new Position(x, y))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddHuman()
        .AddNeeds(needs)
        .AddConsumable()
        .AddOwner(world.player)
        .GetEntity()
}

/** A herd owner with one animal at (x, y). The animal is what a press can kill. */
function AddDeer(world : World, x : number, y : number) : Entity {
    const owner = new EntityBuilder(world.registry).AddPosition(new Position(x, y)).GetEntity()

    world.registry.RegisterEntity(owner, HerdOwner, new HerdOwner())
    world.registry.RegisterEntity(owner, HerdGoal, new HerdGoal())

    return new EntityBuilder(world.registry)
        .AddPosition(new Position(x, y))
        .AddRepresentation(new Representation(CharacterRepresentation.Animal, GameColors.Animal))
        .AddMovement(AnimalSpeed)
        .AddNeeds()
        .AddConsumable()
        .AddOwner(owner)
        .GetEntity()
}

function AddCorpse(world : World, x : number, y : number, hungerUnits = DefaultHungerUnits) : Entity {
    return new EntityBuilder(world.registry)
        .AddPosition(new Position(x, y))
        .AddRepresentation(new Representation(CharacterRepresentation.DeadAnimal, GameColors.Carcass))
        .AddCarcass()
        .AddConsumable(hungerUnits)
        .GetEntity()
}

/** One Interact press, delivered the way ResolveInputActions would. */
function Press(world : World, times = 1) {
    const listener = world.registry.GetComponent(world.player, ActionListener)!

    for (let press = 0; press < times; press++) {
        listener.triggered = new Set(["Interact"])
        HandleInteraction(world.context)
    }

    listener.triggered = new Set()
}

function Corpses(registry : GlobalRegistry) {
    const found : { entity : Entity, hungerUnits : number, model : string, position : Position }[] = []

    registry.ForEachEntityWith([Carcass, Consumable, Position], (corpse, _carcass, consumable, position)=>{
        found.push({
            entity : corpse,
            hungerUnits : consumable.hungerUnits,
            model : registry.GetComponent(corpse, Representation)?.model ?? "",
            position : position
        })
    })

    return found
}

describe("killing", () => {
    it("kills an animal within reach", () => {
        const world = BuildWorld()

        AddHuman(world)

        const deer = AddDeer(world, 51, 50)

        Press(world)

        expect(world.registry.IsAlive(deer)).toBe(false)
    })

    it("leaves a corpse where the animal stood", () => {
        const world = BuildWorld()

        AddHuman(world)
        AddDeer(world, 51, 51)
        Press(world)

        const corpses = Corpses(world.registry)

        expect(corpses).toHaveLength(1)
        expect(corpses[0]!.position.x).toBe(51)
        expect(corpses[0]!.position.y).toBe(51)
        expect(corpses[0]!.model).toBe(CharacterRepresentation.DeadAnimal)
        expect(corpses[0]!.hungerUnits).toBe(DefaultHungerUnits)
    })

    it("cannot reach an animal further away than the reach", () => {
        const world = BuildWorld()

        AddHuman(world)

        const distant = AddDeer(world, 50 + InteractReachTiles + 1, 50)

        Press(world)

        expect(world.registry.IsAlive(distant)).toBe(true)
        expect(Corpses(world.registry)).toHaveLength(0)
    })

    it("kills exactly one animal per press", () => {
        const world = BuildWorld()

        AddHuman(world)

        const first = AddDeer(world, 51, 50)
        const second = AddDeer(world, 49, 50)

        Press(world)

        const alive = [first, second].filter((deer)=>world.registry.IsAlive(deer))

        expect(alive).toHaveLength(1)
    })

    it("takes the nearest of two animals in reach", () => {
        const world = BuildWorld()

        AddHuman(world)

        const near = AddDeer(world, 50.5, 50)
        const far = AddDeer(world, 52, 50)

        Press(world)

        expect(world.registry.IsAlive(near)).toBe(false)
        expect(world.registry.IsAlive(far)).toBe(true)
    })

    // The pressing human is itself an entity with Needs, a Position and an owner. Only
    // being owned by a HERD makes something quarry.
    it("never kills the human doing the pressing", () => {
        const world = BuildWorld()
        const human = AddHuman(world)

        Press(world)

        expect(world.registry.IsAlive(human)).toBe(true)
        expect(Corpses(world.registry)).toHaveLength(0)
    })

    it("never kills another of the player's own humans", () => {
        const world = BuildWorld()

        AddHuman(world)

        const companion = AddHuman(world, 51, 50)

        Press(world)

        expect(world.registry.IsAlive(companion)).toBe(true)
    })

    it("does nothing at all without a press", () => {
        const world = BuildWorld()

        AddHuman(world)

        const deer = AddDeer(world, 51, 50)

        HandleInteraction(world.context)

        expect(world.registry.IsAlive(deer)).toBe(true)
    })
})

describe("eating", () => {
    it("takes from a corpse underfoot", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.2)

        Press(world)

        expect(needs.hungerUnits).toBeCloseTo(0.7)
    })

    it("takes exactly what it gains, and no more", () => {
        // What the corpse loses is what the eater gains, so a big meal is a big loss and
        // nothing evaporates in between.
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.2)

        Press(world)

        expect(Corpses(world.registry)[0]!.hungerUnits).toBeCloseTo(0)
    })

    it("stops at a full bar and leaves the rest on the corpse", () => {
        const world = BuildWorld()
        const needs = new Needs(0.9, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.75)

        Press(world)

        expect(needs.hungerUnits).toBeCloseTo(1)
        expect(Corpses(world.registry)[0]!.hungerUnits).toBeCloseTo(0.65)
    })

    it("ignores a corpse on the next tile over", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 51, 50)

        Press(world)

        expect(needs.hungerUnits).toBe(0.5)
    })

    it("picks the corpse clean over several presses", () => {
        const world = BuildWorld()
        const needs = new Needs(0, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.75)

        // The first press takes all of it, since there was room for all of it.
        Press(world)

        expect(Corpses(world.registry)[0]!.hungerUnits).toBeCloseTo(0)
        expect(needs.hungerUnits).toBeCloseTo(0.75)
    })

    it("empties a corpse a bite at a time when there is little room", () => {
        const world = BuildWorld()
        const needs = new Needs(0.9, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.3)

        Press(world)
        expect(Corpses(world.registry)[0]!.hungerUnits).toBeCloseTo(0.2)

        // Hungry again -- the bar is what limits a bite, so room has to be made for one.
        needs.hungerUnits = 0.9
        Press(world)

        expect(Corpses(world.registry)[0]!.hungerUnits).toBeCloseTo(0.1)
    })

    it("marks a picked corpse with the empty glyph", () => {
        const world = BuildWorld()

        AddHuman(world, 50, 50, new Needs(0, 0.5, 1))
        AddCorpse(world, 50, 50, 0.5)

        Press(world)

        expect(Corpses(world.registry)[0]!.model).toBe(CharacterRepresentation.PickedCarcass)
    })

    it("leaves a corpse with meat left on it looking fresh", () => {
        const world = BuildWorld()

        AddHuman(world, 50, 50, new Needs(0.9, 0.5, 1))
        AddCorpse(world, 50, 50, 0.75)

        Press(world)

        expect(Corpses(world.registry)[0]!.model).toBe(CharacterRepresentation.DeadAnimal)
    })

    it("gives nothing from a corpse already picked clean", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0)

        Press(world)

        expect(needs.hungerUnits).toBe(0.5)
    })

    // A press that finds nothing to eat has to fall through, or a full human standing on
    // a corpse could never do anything else.
    it("falls through to drinking when there is no room to eat", () => {
        const world = BuildWorld(BuildTestWorld(FlatNoise(ShallowWaterNoise)))
        const needs = new Needs(1, 0.2, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.75)

        Press(world)

        expect(needs.water).toBeCloseTo(0.2 + DrinkGainPerPress)
        expect(Corpses(world.registry)[0]!.hungerUnits).toBe(0.75)
    })
})

describe("drinking", () => {
    it("fills the water bar while standing in shallow water", () => {
        const world = BuildWorld(BuildTestWorld(FlatNoise(ShallowWaterNoise)))
        const needs = new Needs(0.5, 0.2, 1)

        AddHuman(world, 50, 50, needs)
        Press(world)

        expect(needs.water).toBeCloseTo(0.2 + DrinkGainPerPress)
    })

    it("does nothing on dry ground", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.2, 1)

        AddHuman(world, 50, 50, needs)
        Press(world)

        expect(needs.water).toBe(0.2)
    })

    it("never fills past full", () => {
        const world = BuildWorld(BuildTestWorld(FlatNoise(ShallowWaterNoise)))
        const needs = new Needs(0.5, 0.9, 1)

        AddHuman(world, 50, 50, needs)
        Press(world, 3)

        expect(needs.water).toBe(1)
    })
})

describe("one press, one thing", () => {
    // Kill leads because it is the only one with a cost of being wrong: water is still
    // there next press and so is a corpse, but a deer walks away.
    it("kills rather than eats or drinks when all three are available", () => {
        const world = BuildWorld(BuildTestWorld(FlatNoise(ShallowWaterNoise)))
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.5)

        const deer = AddDeer(world, 50.5, 50)

        Press(world)

        expect(world.registry.IsAlive(deer)).toBe(false)
        expect(needs.hungerUnits).toBe(0.5)
        expect(needs.water).toBe(0.5)
    })

    it("eats rather than drinks when both are available", () => {
        const world = BuildWorld(BuildTestWorld(FlatNoise(ShallowWaterNoise)))
        const needs = new Needs(0.5, 0.5, 1)

        AddHuman(world, 50, 50, needs)
        AddCorpse(world, 50, 50, 0.2)

        Press(world)

        expect(needs.hungerUnits).toBeCloseTo(0.7)
        expect(needs.water).toBe(0.5)
    })
})

describe("which body acts", () => {
    it("acts through the selected human", () => {
        const world = BuildWorld()

        AddHuman(world, 50, 50)

        const selected = AddHuman(world, 20, 20)
        const deer = AddDeer(world, 21, 20)

        world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(selected))
        Press(world)

        expect(world.registry.IsAlive(deer)).toBe(false)
    })

    it("reaches from the selected human, not from the player controller", () => {
        // The controller never moves from where it was created, so measuring from it would
        // put everything the player walked to out of reach forever.
        const world = BuildWorld()

        const selected = AddHuman(world, 20, 20)
        const nextToController = AddDeer(world, 51, 50)

        world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(selected))
        Press(world)

        expect(world.registry.IsAlive(nextToController)).toBe(true)
    })

    it("falls back to the only human when nothing is selected", () => {
        const world = BuildWorld()

        AddHuman(world, 20, 20)

        const deer = AddDeer(world, 21, 20)

        Press(world)

        expect(world.registry.IsAlive(deer)).toBe(false)
    })

    it("does nothing when the player has no bodies left", () => {
        const world = BuildWorld()

        const deer = AddDeer(world, 51, 50)

        expect(()=>Press(world)).not.toThrow()
        expect(world.registry.IsAlive(deer)).toBe(true)
    })

    it("ignores a selection that is not one of the player's humans", () => {
        const world = BuildWorld()
        const human = AddHuman(world, 20, 20)
        const stranger = AddDeer(world, 80, 80)

        world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(stranger))

        const quarry = AddDeer(world, 21, 20)

        Press(world)

        // Fell back to the human, which is what was in reach of something.
        expect(world.registry.IsAlive(human)).toBe(true)
        expect(world.registry.IsAlive(quarry)).toBe(false)
    })
})
