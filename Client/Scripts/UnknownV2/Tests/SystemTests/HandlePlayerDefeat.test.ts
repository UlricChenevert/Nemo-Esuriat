import { describe, it, expect } from "vitest";
import { CharacterRepresentation, GameColors, PlayerLayer } from "../../Configuration/DisplayConstants.ts";
import { HumanSpeed } from "../../Configuration/GameConstants.ts";
import { GameLoopLayer } from "../../Contracts/Schedule.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MenuState } from "../../Contracts/Components/MenuState.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { RenderingResources, Resources, WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { PushLoopLayer } from "../../Systems.Framework/GameLoopStack.ts";
import { PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandlePlayerDefeat } from "../../Systems.EventHandlers/HandlePlayerDefeat.ts";
import type { ISystemContext } from "../../Interfaces/ISystemContext.ts";
import { KillEntity } from "../../Utilities/MortalityUtilities.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

/**
 * A context with the layers a menu is opened from already in place, since the death
 * screen is an ordinary menu and MenuBuilder.Open pushes onto both stacks.
 */
function BuildWorld() {
    const registry = BuildTestRegistry()
    const eventQueue = new EventQueue(new LinkedList())
    const resources = new Resources({} as RenderingResources, {} as WorldStreamingResources)

    PushLoopLayer(resources.Schedule, eventQueue, new GameLoopLayer("Gameplay", [{ name : "Move", enabled : true, run : ()=>{} }]))
    PushInputLayer(registry, resources.Input)

    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .GetEntity()

    const context : ISystemContext = { registry, eventQueue, resources }

    return { registry, eventQueue, resources, context, player }
}

type World = ReturnType<typeof BuildWorld>

function AddHuman(world : World, x = 50, y = 50) : Entity {
    return new EntityBuilder(world.registry)
        .AddPosition(new Position(x, y))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddHuman()
        .AddNeeds(new Needs(0.5, 0.5, 1))
        .AddConsumable()
        .AddOwner(world.player)
        .GetEntity()
}

/** A death, published the way HandleNeedsDecay publishes one. */
function Kill(world : World, entity : Entity) {
    KillEntity(world.registry, world.eventQueue, entity)
}

const MenuCount = (registry : GlobalRegistry) => {
    let menus = 0

    registry.ForEachEntityWith([MenuState], ()=>{menus++})

    return menus
}

const TitleOf = (registry : GlobalRegistry) => {
    let title : string | undefined

    registry.ForEachEntityWith([MenuState], (_menu, state)=>{title ??= state.title})

    return title
}

describe("losing a body", () => {
    it("does not end the game while another human is left", () => {
        const world = BuildWorld()
        const first = AddHuman(world)

        AddHuman(world, 51, 50)
        Kill(world, first)
        HandlePlayerDefeat(world.context)

        expect(MenuCount(world.registry)).toBe(0)
    })

    it("ends the game when the last human dies", () => {
        const world = BuildWorld()
        const only = AddHuman(world)

        Kill(world, only)
        HandlePlayerDefeat(world.context)

        expect(TitleOf(world.registry)).toBe("YOU DIED")
    })

    it("ends the game on the second of two deaths, not the first", () => {
        const world = BuildWorld()
        const first = AddHuman(world)
        const second = AddHuman(world, 51, 50)

        Kill(world, first)
        HandlePlayerDefeat(world.context)
        expect(MenuCount(world.registry)).toBe(0)

        world.eventQueue.Clear()

        Kill(world, second)
        HandlePlayerDefeat(world.context)

        expect(TitleOf(world.registry)).toBe("YOU DIED")
    })

    // A corpse is not a body the player can drive, whatever else it inherited.
    it("does not count the corpse the death left behind as a survivor", () => {
        const world = BuildWorld()
        const only = AddHuman(world)

        Kill(world, only)
        HandlePlayerDefeat(world.context)

        expect(MenuCount(world.registry)).toBe(1)
    })

    it("stays quiet on a frame with no deaths", () => {
        const world = BuildWorld()

        // No humans at all, which would otherwise read as defeat -- the events are what
        // make it a question worth asking.
        HandlePlayerDefeat(world.context)

        expect(MenuCount(world.registry)).toBe(0)
    })

    it("does not end the game when something unrelated dies", () => {
        const world = BuildWorld()

        AddHuman(world)

        const bystander = new EntityBuilder(world.registry)
            .AddPosition(new Position(10, 10))
            .AddNeeds(new Needs(0, 0, 1))
            .AddConsumable()
            .GetEntity()

        Kill(world, bystander)
        HandlePlayerDefeat(world.context)

        expect(MenuCount(world.registry)).toBe(0)
    })
})

describe("a selection that died", () => {
    it("is dropped", () => {
        const world = BuildWorld()
        const human = AddHuman(world)

        AddHuman(world, 51, 50)
        world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(human))

        Kill(world, human)
        HandlePlayerDefeat(world.context)

        expect(world.registry.GetComponent(world.player, SelectionState)).toBeUndefined()
    })

    it("takes its movement flag with it", () => {
        // The flag is owned by the player rather than by the body, so it survives the death
        // it was pointing the way for.
        const world = BuildWorld()
        const human = AddHuman(world)

        AddHuman(world, 51, 50)

        const flag = new EntityBuilder(world.registry)
            .AddPosition(new Position(60, 60))
            .AddOwner(world.player)
            .GetEntity()

        const selection = new SelectionState(human)

        selection.MovementFlag = flag
        world.registry.RegisterEntity(world.player, SelectionState, selection)

        Kill(world, human)
        HandlePlayerDefeat(world.context)

        expect(world.registry.IsAlive(flag)).toBe(false)
    })

    it("leaves a selection alone when somebody else died", () => {
        const world = BuildWorld()
        const selected = AddHuman(world)
        const other = AddHuman(world, 51, 50)

        world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(selected))

        Kill(world, other)
        HandlePlayerDefeat(world.context)

        expect(world.registry.GetComponent(world.player, SelectionState)?.source).toBe(selected)
    })
})
