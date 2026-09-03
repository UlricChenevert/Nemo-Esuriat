import { HudBarCells, HudHeightRows, HudTextColumn, CharacterRepresentation, TextColor } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { HudState } from "../Contracts/Components/HudState.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import { ScreenPosition } from "../Contracts/Components/ScreenPosition.ts";
import { SelectionState } from "../Contracts/Components/SelectionState.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";
import { FindActingPlayer } from "../Utilities/PlayerUtilities.ts";

/** Rows of the panel, from its top edge, that the two bars are written on. */
const HungerRow = 1
const WaterRow = 2

/**
 * Draws the appetites of whatever is selected along the bottom of the screen, and
 * takes the readout away when nothing is.
 *
 * Scoped to the selection rather than to the player on purpose. A permanent bar
 * would have to pick one body to speak for, which is exactly the thing the player
 * entity refuses to do -- it owns bodies and drives whichever is clicked. Reading
 * the selection means the readout answers "what does THIS one want", and clicking
 * a different body re-aims it with nothing to keep in sync.
 *
 * Not a MenuBuilder menu: it takes no input and must not stop the world, and
 * opening a menu pushes a loop layer that would. What is left of that pattern is
 * screen-anchored entities and a system that keeps them current, which is this.
 */
export function UpdateHud (registry : IRegistry) {
    const player = FindActingPlayer(registry)

    if (player === undefined) return

    const state = registry.GetComponent(player, HudState)
    const needs = SelectedNeeds(registry, player)

    if (needs === undefined) { Clear(registry, player, state); return }

    // Rounded to cells before comparing, which is the whole economy of this system:
    // needs move every tick but a bar only changes twenty times over its whole
    // range, so all but a few frames answer "nothing to redraw" after two
    // multiplications.
    const hungerCells = Cells(needs.hungerUnits)
    const waterCells = Cells(needs.water)

    if (state !== undefined && state.hungerCells === hungerCells && state.waterCells === waterCells) return

    if (state !== undefined) registry.DestroyEntity(state.body)

    const body = Draw(registry, player, hungerCells, waterCells)

    registry.RegisterEntity(player, HudState, new HudState(body, hungerCells, waterCells))
}

/**
 * The appetites of the selected entity, or undefined if there is no selection or it
 * has none.
 *
 * A selection that died is treated as no selection. HandlePlayerDefeat clears those
 * on the frame they happen, but only for deaths -- and a readout that outlived its
 * subject by even one frame would be reporting a corpse's appetites.
 */
function SelectedNeeds (registry : IRegistry, player : Entity) : Needs | undefined {
    const selection = registry.GetComponent(player, SelectionState)

    if (selection === undefined) return undefined
    if (!registry.IsAlive(selection.source)) return undefined

    return registry.GetComponent(selection.source, Needs)
}

/** How many of the bar's cells are filled at this level. */
function Cells (level : number) : number {
    return Math.round(Math.max(0, Math.min(1, level)) * HudBarCells)
}

/** One bar's worth of glyphs: filled cells, then blanks, inside brackets. */
function Bar (cells : number) : string {
    const filled = CharacterRepresentation.BarFilled.repeat(cells)
    const empty = CharacterRepresentation.Blank.repeat(HudBarCells - cells)

    return `[${filled}${empty}]`
}

/**
 * Builds the readout and returns the entity owning it.
 *
 * Destroyed and rebuilt whole rather than edited in place, exactly as
 * HandleMenuActions redraws a menu: the glyphs are one entity per character owned
 * by a body, so replacing the body is one DestroyEntity against the alternative of
 * finding and rewriting the models of forty-odd entities.
 *
 * The labels are padded to the same width so the two bars start on the same column
 * -- a readout whose rows disagree by a character reads as broken before it reads
 * as informative.
 */
function Draw (registry : IRegistry, player : Entity, hungerCells : number, waterCells : number) : Entity {
    const panelTop = GameWidth - HudHeightRows

    return new EntityBuilder(registry)
        .AddOwner(player)
        // Full width, flush to the bottom edge. The striped grey-and-black panel is
        // the same one every menu sits on, on MenuBackdropLayer, so the bars written
        // over it composite onto the pattern rather than punching through it.
        .AddScreenPanel(0, panelTop, GameWidth, HudHeightRows)
        .AddScreenText(`FOOD  ${Bar(hungerCells)}`, new ScreenPosition(HudTextColumn, panelTop + HungerRow), TextColor)
        .AddScreenText(`WATER ${Bar(waterCells)}`, new ScreenPosition(HudTextColumn, panelTop + WaterRow), TextColor)
        .GetEntity()
}

/**
 * Takes the readout off the screen.
 *
 * Both halves matter: the body carries the glyphs, and the component is what says
 * there is a readout at all. Leaving the component behind pointing at a destroyed
 * body would make every field on it a lie, which is what having no optional fields
 * on HudState is meant to rule out.
 */
function Clear (registry : IRegistry, player : Entity, state : HudState | undefined) {
    if (state === undefined) return

    registry.DestroyEntity(state.body)
    registry.RemoveComponent(player, HudState)
}
