import { describe, it, expect } from "vitest";
import { AnimalSpeed, DefaultHungerUnits } from "../../Configuration/GameConstants.ts";
import { CharacterRepresentation } from "../../Configuration/DisplayConstants.ts";
import { Carcass } from "../../Contracts/Components/Carcass.ts";
import { Consumable } from "../../Contracts/Components/Consumable.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { EntityDiedEvent } from "../../Contracts/Events/EntityDiedEvent.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandleNeedsDecay } from "../../Systems.Gameloop/HandleNeedsDecay.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

/**
 * A world with a fixed random sequence, so which member of a herd is culled is
 * repeatable rather than a different animal on every run.
 */
function BuildWorld() {
    return {
        registry : BuildTestRegistry(),
        eventQueue : new EventQueue(new LinkedList()),
        random : new LinearCongruentialGenerator(1)
    }
}

type World = ReturnType<typeof BuildWorld>

function Decay(world : World, ticks = 1) {
    for (let tick = 0; tick < ticks; tick++) HandleNeedsDecay(world.registry, world.eventQueue, world.random)
}

/** An entity with appetites and a body, belonging to no herd. */
function AddLoner(world : World, needs : Needs, x = 50, y = 50) : Entity {
    return new EntityBuilder(world.registry)
        .AddPosition(new Position(x, y))
        .AddNeeds(needs)
        .AddConsumable()
        .GetEntity()
}

/** A herd owner and `size` members, each given its own appetites. */
function AddHerd(world : World, needsOf : (index : number) => Needs, size : number) {
    const owner = new EntityBuilder(world.registry).AddPosition(new Position(50, 50)).GetEntity()

    world.registry.RegisterEntity(owner, HerdOwner, new HerdOwner())
    world.registry.RegisterEntity(owner, HerdGoal, new HerdGoal())

    const members : Entity[] = []

    for (let index = 0; index < size; index++) {
        members.push(new EntityBuilder(world.registry)
            .AddPosition(new Position(50 + index, 50))
            .AddMovement(AnimalSpeed)
            .AddNeeds(needsOf(index))
            .AddConsumable()
            .AddOwner(owner)
            .GetEntity())
    }

    return { owner, members }
}

const LiveCount = (registry : GlobalRegistry, entities : Entity[]) => entities.filter((entity)=>registry.IsAlive(entity)).length

/** Every corpse in the world, as its position and what is left on it. */
function Corpses(registry : GlobalRegistry) {
    const found : { position : Position, hungerUnits : number, model : string }[] = []

    registry.ForEachEntityWith([Carcass, Consumable, Position], (corpse, _carcass, consumable, position)=>{
        found.push({
            position : position,
            hungerUnits : consumable.hungerUnits,
            model : registry.GetComponent(corpse, Representation)?.model ?? ""
        })
    })

    return found
}

describe("running out of what you needed", () => {
    it("kills something with no food left", () => {
        const world = BuildWorld()
        const starved = AddLoner(world, new Needs(0, 1, 1))

        Decay(world)

        expect(world.registry.IsAlive(starved)).toBe(false)
    })

    it("kills something with no water left", () => {
        const world = BuildWorld()
        const parched = AddLoner(world, new Needs(1, 0, 1))

        Decay(world)

        expect(world.registry.IsAlive(parched)).toBe(false)
    })

    it("leaves something that still has a little of both", () => {
        const world = BuildWorld()
        const hungry = AddLoner(world, new Needs(0.01, 0.01, 1))

        Decay(world)

        expect(world.registry.IsAlive(hungry)).toBe(true)
    })

    // Sleep only recovers while an animal's HERD is asleep, so nothing outside a herd
    // can service it. Lethal, it would kill every lone animal and every person on a
    // fixed timer with no counterplay.
    it("does not kill something that has only run out of sleep", () => {
        const world = BuildWorld()
        const exhausted = AddLoner(world, new Needs(1, 1, 0))

        Decay(world)

        expect(world.registry.IsAlive(exhausted)).toBe(true)
    })

    it("leaves appetites alone -- draining is UpdateNeeds' job", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 0.5)

        AddLoner(world, needs)
        Decay(world, 10)

        expect(needs.hungerUnits).toBe(0.5)
        expect(needs.water).toBe(0.5)
    })
})

describe("what dying leaves behind", () => {
    it("leaves a corpse where the body fell", () => {
        const world = BuildWorld()

        AddLoner(world, new Needs(0, 1, 1), 12, 34)
        Decay(world)

        const corpses = Corpses(world.registry)

        expect(corpses).toHaveLength(1)
        expect(corpses[0]!.position.x).toBe(12)
        expect(corpses[0]!.position.y).toBe(34)
    })

    it("carries the dead thing's own worth onto the corpse", () => {
        // Decided where the animal was created, not by whatever killed it.
        const world = BuildWorld()

        AddLoner(world, new Needs(0, 1, 1))
        Decay(world)

        expect(Corpses(world.registry)[0]!.hungerUnits).toBe(DefaultHungerUnits)
    })

    it("draws a fresh corpse as a dead animal", () => {
        const world = BuildWorld()

        AddLoner(world, new Needs(0, 1, 1))
        Decay(world)

        expect(Corpses(world.registry)[0]!.model).toBe(CharacterRepresentation.DeadAnimal)
    })

    it("announces the death, naming both the deceased and the corpse", () => {
        const world = BuildWorld()
        const starved = AddLoner(world, new Needs(0, 1, 1))

        Decay(world)

        const deaths = world.eventQueue.GetEventsOfType(EntityDiedEvent)

        expect(deaths).toHaveLength(1)
        expect(deaths[0]!.entity).toBe(starved)
        expect(world.registry.IsAlive(deaths[0]!.corpse)).toBe(true)
    })

    // A corpse is not a herd member -- it has no IsMoveable -- so a dead animal must
    // not read as another mouth with appetites of its own, or it would starve again
    // every tick and breed corpses forever.
    it("leaves a corpse that cannot itself starve", () => {
        const world = BuildWorld()

        AddLoner(world, new Needs(0, 1, 1))
        Decay(world, 5)

        expect(Corpses(world.registry)).toHaveLength(1)
    })
})

describe("a starving herd", () => {
    const Empty = () => new Needs(0, 0, 1)

    it("loses exactly one animal per tick", () => {
        // Every member drains at the same rate, so a herd arrives at zero all together.
        // Killing everything that qualifies would delete a herd of five between one frame
        // and the next, which reads as a bug rather than as a famine.
        const world = BuildWorld()
        const { members } = AddHerd(world, Empty, 5)

        Decay(world)
        expect(LiveCount(world.registry, members)).toBe(4)

        Decay(world)
        expect(LiveCount(world.registry, members)).toBe(3)
    })

    it("takes as many ticks to empty as it had animals", () => {
        const world = BuildWorld()
        const { members } = AddHerd(world, Empty, 5)

        Decay(world, 5)

        expect(LiveCount(world.registry, members)).toBe(0)
    })

    it("leaves a corpse for every animal it lost", () => {
        const world = BuildWorld()

        AddHerd(world, Empty, 5)
        Decay(world, 5)

        expect(Corpses(world.registry)).toHaveLength(5)
    })

    // The owner is bodiless and holds no appetites, so nothing here can reach it.
    // PopulateHerds retires an emptied herd on distance, which is existing behaviour.
    it("outlives its last animal as an empty herd", () => {
        const world = BuildWorld()
        const { owner, members } = AddHerd(world, Empty, 3)

        Decay(world, 10)

        expect(LiveCount(world.registry, members)).toBe(0)
        expect(world.registry.IsAlive(owner)).toBe(true)
    })

    it("culls the starving member and not a fed one", () => {
        const world = BuildWorld()
        const { members } = AddHerd(world, (index)=>(index === 2 ? Empty() : new Needs(1, 1, 1)), 4)

        Decay(world)

        expect(world.registry.IsAlive(members[2]!)).toBe(false)
        expect(LiveCount(world.registry, members)).toBe(3)
    })

    // Two herds are two groups, and neither is spared because the other lost somebody.
    it("thins each herd independently", () => {
        const world = BuildWorld()
        const first = AddHerd(world, Empty, 3)
        const second = AddHerd(world, Empty, 3)

        Decay(world)

        expect(LiveCount(world.registry, first.members)).toBe(2)
        expect(LiveCount(world.registry, second.members)).toBe(2)
    })

    it("does not spare a starving loner while a herd is being thinned", () => {
        const world = BuildWorld()
        const loner = AddLoner(world, Empty())

        AddHerd(world, Empty, 3)
        Decay(world)

        expect(world.registry.IsAlive(loner)).toBe(false)
    })
})
