import { describe, it, expect } from "vitest";
import {
    CharacterRepresentation, GameColors, HudBarCells, HudHeightRows, MenuBackdropLayer, MenuLayer,
    PlayerLayer
} from "../../Configuration/DisplayConstants.ts";
import { GameWidth, HumanSpeed } from "../../Configuration/GameConstants.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HudState } from "../../Contracts/Components/HudState.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { ScreenPosition } from "../../Contracts/Components/ScreenPosition.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { UpdateHud } from "../../Systems.Gameloop/UpdateHud.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

function BuildWorld() {
    const registry = BuildTestRegistry()

    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .GetEntity()

    return { registry, player }
}

type World = ReturnType<typeof BuildWorld>

function AddHuman(world : World, needs = new Needs(1, 1, 1)) : Entity {
    return new EntityBuilder(world.registry)
        .AddPosition(new Position(50, 50))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddHuman()
        .AddNeeds(needs)
        .GetEntity()
}

function Select(world : World, entity : Entity) {
    world.registry.RegisterEntity(world.player, SelectionState, new SelectionState(entity))
}

function Deselect(world : World) {
    world.registry.RemoveComponent(world.player, SelectionState)
}

const StateOf = (world : World) => world.registry.GetComponent(world.player, HudState)

/**
 * The readout's rows, in reading order.
 *
 * MenuLayer only. The panel occupies the same cells on MenuBackdropLayer and
 * including it would interleave a block between every pair of characters -- the same
 * reason Menus.test.ts filters this way.
 */
function DrawnRows(registry : GlobalRegistry) : string[] {
    const rows = new Map<number, { x : number, model : string }[]>()

    registry.ForEachEntityWith([ScreenPosition, Layer, Representation], (_entity, screen, layer, representation)=>{
        if (layer.layerIndex !== MenuLayer) return

        const row = rows.get(screen.y)

        if (row) row.push({ x : screen.x, model : representation.model })
        else rows.set(screen.y, [{ x : screen.x, model : representation.model }])
    })

    return [...rows.entries()]
        .sort(([firstY], [secondY])=>firstY - secondY)
        .map(([, row])=>row.sort((a, b)=>a.x - b.x).map((glyph)=>glyph.model).join(""))
}

/** The striped panel behind the bars: one entity carrying the whole rectangle. */
function FindPanel(registry : GlobalRegistry) {
    let found : { screen : ScreenPosition, layer : Layer, multiTile : MultiTileRepresentation } | undefined

    registry.ForEachEntityWith([ScreenPosition, Layer, MultiTileRepresentation], (_entity, screen, layer, multiTile)=>{
        if (layer.layerIndex === MenuBackdropLayer) found = { screen, layer, multiTile }
    })

    return found
}

const Full = CharacterRepresentation.BarFilled.repeat(HudBarCells)
const Empty = CharacterRepresentation.Blank.repeat(HudBarCells)

describe("when the readout is on screen", () => {
    it("shows nothing until something is selected", () => {
        const world = BuildWorld()

        AddHuman(world)
        UpdateHud(world.registry)

        expect(StateOf(world)).toBeUndefined()
        expect(DrawnRows(world.registry)).toEqual([])
    })

    it("appears when a body is selected", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        expect(StateOf(world)).toBeDefined()
        expect(DrawnRows(world.registry)).toHaveLength(2)
    })

    it("goes away again when the selection is dropped", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        Deselect(world)
        UpdateHud(world.registry)

        expect(StateOf(world)).toBeUndefined()
        expect(DrawnRows(world.registry)).toEqual([])
    })

    it("shows nothing for a selected thing with no appetites", () => {
        const world = BuildWorld()

        const flag = new EntityBuilder(world.registry).AddPosition(new Position(60, 60)).GetEntity()

        Select(world, flag)
        UpdateHud(world.registry)

        expect(StateOf(world)).toBeUndefined()
    })

    // The readout must not outlive its subject by even a frame, or it reports the
    // appetites of a corpse.
    it("goes away when what was selected dies", () => {
        const world = BuildWorld()
        const human = AddHuman(world)

        Select(world, human)
        UpdateHud(world.registry)

        world.registry.DestroyEntity(human)
        UpdateHud(world.registry)

        expect(StateOf(world)).toBeUndefined()
        expect(DrawnRows(world.registry)).toEqual([])
    })

    it("does nothing at all without a player", () => {
        const registry = BuildTestRegistry()

        expect(()=>UpdateHud(registry)).not.toThrow()
    })
})

describe("what the bars say", () => {
    it("reads full at full", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(1, 1, 1)))
        UpdateHud(world.registry)

        expect(DrawnRows(world.registry)).toEqual([`FOOD  [${Full}]`, `WATER [${Full}]`])
    })

    it("reads empty at empty", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(0, 0, 1)))
        UpdateHud(world.registry)

        expect(DrawnRows(world.registry)).toEqual([`FOOD  [${Empty}]`, `WATER [${Empty}]`])
    })

    it("fills half the cells at half", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(0.5, 0.5, 1)))
        UpdateHud(world.registry)

        const half = HudBarCells / 2
        const bar = CharacterRepresentation.BarFilled.repeat(half) + CharacterRepresentation.Blank.repeat(half)

        expect(DrawnRows(world.registry)).toEqual([`FOOD  [${bar}]`, `WATER [${bar}]`])
    })

    it("shows the two needs separately", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(1, 0, 1)))
        UpdateHud(world.registry)

        expect(DrawnRows(world.registry)).toEqual([`FOOD  [${Full}]`, `WATER [${Empty}]`])
    })

    it("lines the two bars up", () => {
        // A readout whose rows disagree by a character reads as broken before it reads as
        // informative.
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(0.3, 0.8, 1)))
        UpdateHud(world.registry)

        const [hunger, water] = DrawnRows(world.registry)

        expect(hunger!.indexOf("[")).toBe(water!.indexOf("["))
        expect(hunger!.length).toBe(water!.length)
    })

    it("follows the selection to another body", () => {
        const world = BuildWorld()
        const sated = AddHuman(world, new Needs(1, 1, 1))
        const starving = AddHuman(world, new Needs(0, 0, 1))

        Select(world, sated)
        UpdateHud(world.registry)
        expect(DrawnRows(world.registry)[0]).toBe(`FOOD  [${Full}]`)

        Select(world, starving)
        UpdateHud(world.registry)

        expect(DrawnRows(world.registry)[0]).toBe(`FOOD  [${Empty}]`)
    })
})

describe("redrawing", () => {
    it("leaves the drawn body alone when nothing has moved a whole cell", () => {
        // The economy of the whole system: needs move every tick, a bar only twenty times
        // over its range.
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        Select(world, AddHuman(world, needs))
        UpdateHud(world.registry)

        const firstBody = StateOf(world)!.body

        // A nudge far too small to cross a twentieth of the bar.
        needs.hungerUnits = 0.501
        UpdateHud(world.registry)

        expect(StateOf(world)!.body).toBe(firstBody)
        expect(world.registry.IsAlive(firstBody)).toBe(true)
    })

    it("rebuilds once a bar actually changes", () => {
        const world = BuildWorld()
        const needs = new Needs(0.5, 0.5, 1)

        Select(world, AddHuman(world, needs))
        UpdateHud(world.registry)

        const firstBody = StateOf(world)!.body

        needs.hungerUnits = 0.1
        UpdateHud(world.registry)

        expect(StateOf(world)!.body).not.toBe(firstBody)
        expect(world.registry.IsAlive(firstBody)).toBe(false)
    })

    it("never leaves two readouts on screen", () => {
        const world = BuildWorld()
        const needs = new Needs(1, 1, 1)

        Select(world, AddHuman(world, needs))

        for (const level of [1, 0.8, 0.6, 0.4, 0.2, 0]) {
            needs.hungerUnits = level
            needs.water = level
            UpdateHud(world.registry)
        }

        expect(DrawnRows(world.registry)).toHaveLength(2)
    })

    it("records what it drew", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world, new Needs(1, 0, 1)))
        UpdateHud(world.registry)

        expect(StateOf(world)!.hungerCells).toBe(HudBarCells)
        expect(StateOf(world)!.waterCells).toBe(0)
    })
})

describe("where the readout sits", () => {
    it("spans the bottom of the screen", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        const panel = FindPanel(world.registry)!

        expect(panel.screen.x).toBe(0)
        expect(panel.screen.y).toBe(GameWidth - HudHeightRows)
        expect(panel.multiTile.width).toBe(GameWidth)
        expect(panel.multiTile.height).toBe(HudHeightRows)
    })

    it("puts its panel under its text", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        expect(FindPanel(world.registry)!.layer.layerIndex).toBeLessThan(MenuLayer)
    })

    it("keeps its bars inside the panel", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        const panelTop = GameWidth - HudHeightRows
        let rowsOutside = 0

        world.registry.ForEachEntityWith([ScreenPosition, Layer, Representation], (_entity, screen, layer)=>{
            if (layer.layerIndex !== MenuLayer) return
            if (screen.y >= panelTop && screen.y < GameWidth) return

            rowsOutside++
        })

        expect(rowsOutside).toBe(0)
    })

    it("takes the panel away with the bars", () => {
        const world = BuildWorld()

        Select(world, AddHuman(world))
        UpdateHud(world.registry)

        Deselect(world)
        UpdateHud(world.registry)

        expect(FindPanel(world.registry)).toBeUndefined()
    })
})
