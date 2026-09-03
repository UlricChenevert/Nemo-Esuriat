// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { CharacterRepresentation, GameColors, HudBarCells } from "../../Configuration/DisplayConstants.ts";
import { AnimalSpeed } from "../../Configuration/GameConstants.ts";
import { Carcass } from "../../Contracts/Components/Carcass.ts";
import { Consumable } from "../../Contracts/Components/Consumable.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { HudState } from "../../Contracts/Components/HudState.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { Human } from "../../Contracts/Tags/Human.ts";
import { IsPlayer } from "../../Contracts/Tags/IsPlayer.ts";
import type { GameContext } from "../../Game.ts";

/**
 * The whole feature driven through the real game: real Initialization, real
 * gameplay loop layer, real renderer.
 *
 * Distinct from the per-system suites, which build their own registry and call one
 * system. This is the only thing that catches the failures those cannot see -- a
 * component missing from Game.ts's registration chain (an unregistered component
 * throws on its first LOOKUP, and the system suites register their own), a system
 * left out of the schedule, or a HUD that never reaches the canvas.
 *
 * The canvas is stubbed the way GameBootstrap.test.ts stubs it: happy-dom has no
 * 2D context, and RenderingResources throws on a null one.
 */

const drawnGlyphs : Array<{ model : string, canvasX : number, canvasY : number }> = [];

function InstallCanvasContextStub() {
    Object.defineProperty(globalThis.HTMLCanvasElement.prototype, "getContext", {
        configurable : true,
        value : function () {
            const context = {
                font : "", textBaseline : "", textAlign : "", fillStyle : "",
                fillRect : () => {},
                fillText : (model : string, canvasX : number, canvasY : number) => {
                    drawnGlyphs.push({ model, canvasX, canvasY })
                }
            }

            return context
        }
    })
}

/**
 * What the frame drew, in READING order, one string per screen row.
 *
 * Reconstructed from the canvas coordinates rather than taken in call order,
 * because the renderer blits the cells it touched in the order they were first
 * touched -- so a row of text comes out of fillText in pieces, and the tail of a
 * bar can be drawn after the whole rest of the screen.
 */
function DrawnRows() : string[] {
    const rows = new Map<number, { x : number, model : string }[]>()

    for (const glyph of drawnGlyphs) {
        const row = rows.get(glyph.canvasY)

        if (row) row.push({ x : glyph.canvasX, model : glyph.model })
        else rows.set(glyph.canvasY, [{ x : glyph.canvasX, model : glyph.model }])
    }

    return [...rows.entries()]
        .sort(([firstY], [secondY])=>firstY - secondY)
        .map(([, row])=>row.sort((a, b)=>a.x - b.x).map((glyph)=>glyph.model).join(""))
}

type Harness = {
    context : GameContext
    Frame : () => void
    Press : (code : string) => void
    Player : () => Entity
    Human : () => Entity
    AddDeerBeside : (human : Entity, offsetX : number) => Entity
    DrawnText : () => string
    Corpses : () => { model : string, hungerUnits : number, fillStyle : string | undefined }[]
}

let harness : Harness

beforeAll(async () => {
    InstallCanvasContextStub()

    const { GameLoop, Initialization } = await import("../../Game.ts")
    const { Resources, RenderingResources } = await import("../../Contracts/SystemResources.ts")
    const { CreateWorldStreamingResources } = await import("../../Utilities/CreateWorldStreamingResources.ts")
    const { GameKeyboardEvent } = await import("../../Contracts/Events/KeyBoardEvent.ts")
    const { EntityBuilder } = await import("../../Systems.Framework/EntityBuilder.ts")

    const canvas = document.createElement("canvas")

    canvas.width = 1200
    canvas.height = 1200
    document.body.appendChild(canvas)

    const context = Initialization(new Resources(new RenderingResources(canvas), CreateWorldStreamingResources()))

    const Frame = () => {
        drawnGlyphs.length = 0
        GameLoop(context.registry, context.eventQueue, context.resources)
    }

    const Press = (code : string) => {
        const Key = (isPressed : boolean) => new GameKeyboardEvent(
            { code, altKey : false, shiftKey : false, ctrlKey : false, metaKey : false } as KeyboardEvent, isPressed
        )

        context.eventQueue.EnqueueEvent(Key(true))
        Frame()
        context.eventQueue.EnqueueEvent(Key(false))
        Frame()
    }

    const Player = () => {
        let player : Entity | undefined

        context.registry.ForEachEntityWith([IsPlayer], (entity)=>{player ??= entity})

        return player!
    }

    const HumanBody = () => {
        let human : Entity | undefined

        context.registry.ForEachEntityWith([Human, Position], (entity)=>{human ??= entity})

        return human!
    }

    /** A one-animal herd `offsetX` tiles from `human`, so it is inside reach. */
    const AddDeerBeside = (human : Entity, offsetX : number) => {
        const standing = context.registry.GetComponent(human, Position)!
        const spot = new Position(standing.x + offsetX, standing.y)

        const owner = new EntityBuilder(context.registry).AddPosition(spot.Copy()).GetEntity()

        context.registry.RegisterEntity(owner, HerdOwner, new HerdOwner())
        context.registry.RegisterEntity(owner, HerdGoal, new HerdGoal())

        return new EntityBuilder(context.registry)
            .AddPosition(spot.Copy())
            .AddRepresentation(new Representation(CharacterRepresentation.Animal, GameColors.Animal))
            .AddMovement(AnimalSpeed)
            .AddNeeds()
            .AddConsumable()
            .AddOwner(owner)
            .GetEntity()
    }

    const DrawnText = () => DrawnRows().join("\n")

    const Corpses = () => {
        const found : { model : string, hungerUnits : number, fillStyle : string | undefined }[] = []

        context.registry.ForEachEntityWith([Carcass, Consumable], (corpse, _carcass, consumable)=>{
            const representation = context.registry.GetComponent(corpse, Representation)

            found.push({
                model : representation?.model ?? "",
                hungerUnits : consumable.hungerUnits,
                fillStyle : representation?.FillStyle()
            })
        })

        return found
    }

    harness = { context, Frame, Press, Player, Human : HumanBody, AddDeerBeside, DrawnText, Corpses }

    // Frame one is the start menu. Close it the way a player does, which is now
    // Interact rather than Confirm -- the same press that hunts, one layer up.
    Frame()
    Press("Space")
    Frame()
})

describe("booting the game with all of this in it", () => {
    // An unregistered component throws on its first lookup, so a missing line in
    // Game.ts's registration chain surfaces as an exception in a frame, not as a
    // wrong pixel.
    it("runs frames without throwing", () => {
        expect(()=>{ for (let frame = 0; frame < 30; frame++) harness.Frame() }).not.toThrow()
    })

    it("runs the new systems in the gameplay layer", () => {
        const names = harness.context.resources.Schedule.ActiveSystemNames()

        expect(names).toContain("HandleInteraction")
        expect(names).toContain("HandleNeedsDecay")
        expect(names).toContain("HandlePlayerDefeat")
        expect(names).toContain("UpdateHud")
    })

    it("gives the player a human with appetites", () => {
        expect(harness.context.registry.GetComponent(harness.Human(), Needs)).toBeDefined()
    })

    it("draws the world, so the menu really did close", () => {
        harness.Frame()

        expect(harness.DrawnText()).toContain(CharacterRepresentation.Character)
    })
})

describe("the readout, on the real canvas", () => {
    it("stays off screen until something is selected", () => {
        harness.Frame()

        expect(harness.DrawnText()).not.toContain("WATER")
    })

    it("appears when the player's human is selected", () => {
        harness.context.registry.RegisterEntity(harness.Player(), SelectionState, new SelectionState(harness.Human()))
        harness.Frame()

        const drawn = harness.DrawnText()

        expect(drawn).toContain("FOOD")
        expect(drawn).toContain("WATER")
    })

    it("draws both bars full at the start of a game", () => {
        harness.Frame()

        const full = CharacterRepresentation.BarFilled.repeat(HudBarCells)

        expect(harness.DrawnText()).toContain(`FOOD  [${full}`)
    })

    it("empties a bar as the need does", () => {
        const needs = harness.context.registry.GetComponent(harness.Human(), Needs)!

        needs.water = 0.25
        harness.Frame()

        const quarter = CharacterRepresentation.BarFilled.repeat(HudBarCells / 4)

        expect(harness.DrawnText()).toContain(`WATER [${quarter} `)

        needs.water = 1
        harness.Frame()
    })
})

describe("hunting, on the real canvas", () => {
    let deer : Entity

    it("kills a deer within reach on a press", () => {
        deer = harness.AddDeerBeside(harness.Human(), 1)

        expect(harness.context.registry.IsAlive(deer)).toBe(true)

        harness.Press("Space")

        expect(harness.context.registry.IsAlive(deer)).toBe(false)
    })

    it("leaves a red corpse where it fell", () => {
        const corpses = harness.Corpses()

        expect(corpses).toHaveLength(1)
        expect(corpses[0]!.model).toBe(CharacterRepresentation.DeadAnimal)
        expect(corpses[0]!.fillStyle).toBe(`rgba(${GameColors.Carcass.red},${GameColors.Carcass.green},${GameColors.Carcass.blue},255)`)
    })

    it("draws the corpse in the world", () => {
        harness.Frame()

        expect(harness.DrawnText()).toContain(CharacterRepresentation.DeadAnimal)
    })

    it("feeds the human that walks onto it and presses", () => {
        const human = harness.Human()
        const needs = harness.context.registry.GetComponent(human, Needs)!

        needs.hungerUnits = 0.2

        // Stand on it. Walking there through the click handler would take dozens of
        // frames and prove nothing this does not.
        const corpsePosition = harness.context.registry.GetComponent(human, Position)!

        corpsePosition.x += 1

        harness.Press("Space")

        expect(needs.hungerUnits).toBeGreaterThan(0.2)
    })

    it("shows the meal on the readout", () => {
        harness.Frame()

        const empty = CharacterRepresentation.BarFilled.repeat(HudBarCells / 5)

        // The bar has moved off the fifth it was pinned at.
        expect(harness.DrawnText()).not.toContain(`FOOD  [${empty} `)
    })

    it("marks the corpse picked clean once it is", () => {
        const needs = harness.context.registry.GetComponent(harness.Human(), Needs)!

        // Keep making room and keep eating until there is nothing left. Emptied to a
        // sliver rather than to zero, deliberately: zero is starvation, and
        // HandleNeedsDecay would kill the eater between bites.
        for (let bite = 0; bite < 10; bite++) {
            needs.hungerUnits = 0.05
            harness.Press("Space")
        }

        const corpses = harness.Corpses()

        expect(corpses[0]!.hungerUnits).toBeCloseTo(0)
        expect(corpses[0]!.model).toBe(CharacterRepresentation.PickedCarcass)
    })
})

describe("starving, on the real canvas", () => {
    it("kills the human when its water runs out, and ends the game", () => {
        const human = harness.Human()
        const needs = harness.context.registry.GetComponent(human, Needs)!

        needs.water = 0
        harness.Frame()

        expect(harness.context.registry.IsAlive(human)).toBe(false)

        // The death screen, drawn by the real renderer on the frame after the death.
        harness.Frame()

        expect(harness.DrawnText()).toContain("YOU DIED")
    })

    it("takes the readout down with the body", () => {
        expect(harness.context.registry.GetComponent(harness.Player(), HudState)).toBeUndefined()
    })
})
