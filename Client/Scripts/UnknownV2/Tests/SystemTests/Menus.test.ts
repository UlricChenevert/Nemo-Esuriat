import { describe, it, expect } from "vitest";
import { CloseMenu, MenuBuilder } from "../../Systems.Framework/MenuBuilder.ts";
import { HandleMenuActions } from "../../Systems.Gameloop/HandleMenuActions.ts";
import { ResolveInputActions } from "../../Systems.Gameloop/ResolveInputActions.ts";
import { GameLoopLayer } from "../../Contracts/Schedule.ts";
import { MenuState } from "../../Contracts/Components/MenuState.ts";
import { ScreenPosition } from "../../Contracts/Components/ScreenPosition.ts";
import { Representation } from "../../Contracts/Components/Representation.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { MenuBackdropLayer, MenuLayer, MenuPanelStripeWidth, TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import { RenderCanvas } from "../../Systems.Gameloop/RenderCanvas.ts";
import { CreateRecordingRenderingResources } from "../TestHelpers/RecordingRenderingResources.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { MultiTileRepresentation } from "../../Contracts/Components/MultiTileRepresentation.ts";
import { ActionListener } from "../../Contracts/Components/ActionListener.ts";
import { GameKeyboardEvent } from "../../Contracts/Events/KeyBoardEvent.ts";
import { RenderingResources, Resources, WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";
import { PushLoopLayer } from "../../Systems.Framework/GameLoopStack.ts";
import { BuildKeybindingsMenu } from "../../Configuration/Menus.ts";
import type { ISystemContext } from "../../Interfaces/ISystemContext.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";

const KeyDown = (code : string) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, true);

const KeyUp = (code : string) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, false);

/** A menu's loop layer, standing in for the real one without dragging in rendering. */
const BuildStubMenuLoopLayer = () => new GameLoopLayer("Menu", [{ name: "HandleMenuActions", enabled: true, run: ()=>{} }])

/**
 * A context with a gameplay loop layer and a world input layer already in
 * place, which is the state a menu is opened from.
 *
 * Resources is built by hand rather than through StartGame: nothing here needs a
 * canvas, and RenderingResources demands one.
 */
function BuildContext() : ISystemContext {
  const registry = BuildTestRegistry()
  const eventQueue = new EventQueue(new LinkedList())
  const resources = new Resources({} as RenderingResources, {} as WorldStreamingResources)

  PushLoopLayer(resources.Schedule, eventQueue, new GameLoopLayer("Gameplay", [{ name: "Move", enabled: true, run: ()=>{} }]))
  PushInputLayer(registry, resources.Input)

  return { registry, eventQueue, resources }
}

/** One frame: keys in, actions routed, menu driven. */
function Frame(context : ISystemContext, events : GameKeyboardEvent[] = []) {
  events.forEach((event)=>context.eventQueue.EnqueueEvent(event))

  ResolveInputActions(context.registry, context.eventQueue, context.resources.Input)
  HandleMenuActions(context)
  context.eventQueue.Clear()
}

/** Presses and releases a key, so the next press is an edge rather than a repeat. */
function Press(context : ISystemContext, code : string) {
  Frame(context, [KeyDown(code)])
  Frame(context, [KeyUp(code)])
}

const StateOf = (context : ISystemContext, menu : Entity) => context.registry.GetComponent(menu, MenuState)!

/**
 * The menu's text, in reading order, one row per line.
 *
 * MenuLayer only. The panel occupies the same cells on MenuBackdropLayer, and
 * including it would interleave a block between every pair of letters.
 */
function DrawnText(context : ISystemContext) : string {
  const rows = new Map<number, Array<{ x : number, model : string }>>()

  context.registry.ForEachEntityWith([ScreenPosition, Layer, Representation], (_entity, screen, layer, representation) => {
    if (layer.layerIndex !== MenuLayer) return

    const row = rows.get(screen.y)

    if (row) row.push({ x: screen.x, model: representation.model })
    else rows.set(screen.y, [{ x: screen.x, model: representation.model }])
  })

  return [...rows.entries()]
    .sort(([firstY], [secondY])=>firstY - secondY)
    .map(([, row])=>row.sort((a, b)=>a.x - b.x).map((glyph)=>glyph.model).join(""))
    .join("\n")
}

/** The menu's panel block: one entity carrying the whole striped rectangle. */
function FindPanel(context : ISystemContext) {
  let found : { screen : ScreenPosition, layer : Layer, multiTile : MultiTileRepresentation } | undefined

  context.registry.ForEachEntityWith([ScreenPosition, Layer, MultiTileRepresentation], (_entity, screen, layer, multiTile) => {
    if (layer.layerIndex === MenuBackdropLayer) found = { screen, layer, multiTile }
  })

  return found
}

/**
 * The bounds of the drawn panel box, which is the menu the player actually sees.
 *
 * Read off the block's origin and size rather than by collecting cells: the panel
 * is a single MultiTileRepresentation entity, not one entity per cell.
 */
function PanelExtent(context : ISystemContext) {
  const panel = FindPanel(context)!

  return {
    minX: panel.screen.x,
    maxX: panel.screen.x + panel.multiTile.width - 1,
    minY: panel.screen.y,
    maxY: panel.screen.y + panel.multiTile.height - 1
  }
}

// The anchor used to be a fixed offset chosen to suit the widest screen, so the
// keybindings list looked centred and every shorter menu sat left of centre.
describe("centring", () => {
  /** Distance from the panel's midpoint to the middle of the screen. */
  const OffCentreBy = (context : ISystemContext) => {
    const { minX, maxX, minY, maxY } = PanelExtent(context)

    return {
      horizontal: Math.abs((minX + maxX + 1) / 2 - GameWidth / 2),
      vertical: Math.abs((minY + maxY + 1) / 2 - GameWidth / 2)
    }
  }

  // Integer tile positions cannot centre an even span against an odd one, so
  // half a tile out is exact rather than sloppy.
  const HalfATile = 0.5

  it("centres a narrow menu", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer)
      .SetTitle("PAUSED")
      .AddCloseItem("Return to Game")
      .AddMenuItem("Show Keybindings", ()=>{})
      .Open()

    Frame(context)

    expect(OffCentreBy(context).horizontal).toBeLessThanOrEqual(HalfATile)
    expect(OffCentreBy(context).vertical).toBeLessThanOrEqual(HalfATile)
  })

  it("centres a wide menu", () => {
    const context = BuildContext()
    const builder = new MenuBuilder(context, BuildStubMenuLoopLayer)

    BuildKeybindingsMenu(builder)
    builder.Open()
    Frame(context)

    expect(OffCentreBy(context).horizontal).toBeLessThanOrEqual(HalfATile)
    expect(OffCentreBy(context).vertical).toBeLessThanOrEqual(HalfATile)
  })

  // Both menus centre, which is the point: they land in the same place rather
  // than the short one sitting off to one side of the long one.
  it("puts a narrow and a wide menu in the same place", () => {
    const narrow = BuildContext()
    new MenuBuilder(narrow, BuildStubMenuLoopLayer).SetTitle("PAUSED").AddCloseItem("Return to Game").Open()
    Frame(narrow)

    const wide = BuildContext()
    const builder = new MenuBuilder(wide, BuildStubMenuLoopLayer)
    BuildKeybindingsMenu(builder)
    builder.Open()
    Frame(wide)

    const narrowMiddle = (PanelExtent(narrow).minX + PanelExtent(narrow).maxX) / 2
    const wideMiddle = (PanelExtent(wide).minX + PanelExtent(wide).maxX) / 2

    expect(Math.abs(narrowMiddle - wideMiddle)).toBeLessThanOrEqual(1)
  })

  it("still honours an explicit anchor", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).SetTitle("X").AddCloseItem("Back").AnchorAt(5, 6).Open()
    Frame(context)

    // The panel is padded outward from the anchor.
    expect(PanelExtent(context).minX).toBe(3)
    expect(PanelExtent(context).minY).toBe(4)
  })
})

/**
 * The bug this compositing work exists for.
 *
 * The renderer used to keep one representation per cell, so a text glyph on
 * MenuLayer *replaced* the panel fill beneath it and that cell was never painted
 * -- leaving the frame's black clear showing through. Every character sat in its
 * own black box on an otherwise grey menu.
 */
describe("a rendered menu", () => {
  /** Cell coordinates of every solid fill, excluding the full-canvas clear. */
  const FilledCells = (drawnRects : ReturnType<typeof CreateRecordingRenderingResources>["drawnRects"]) =>
    new Set(drawnRects
      .filter((rect)=>rect.width === TileSizePixels && rect.height === TileSizePixels)
      .map((rect)=>`${rect.canvasX / TileSizePixels},${rect.canvasY / TileSizePixels}`))

  /** Cell coordinates of every drawn character. Glyphs are placed at cell centres. */
  const TextCells = (drawnGlyphs : ReturnType<typeof CreateRecordingRenderingResources>["drawnGlyphs"]) =>
    drawnGlyphs.map((glyph)=>{
      const halfCell = TileSizePixels / 2

      return `${(glyph.canvasX - halfCell) / TileSizePixels},${(glyph.canvasY - halfCell) / TileSizePixels}`
    })

  it("paints the panel behind every character rather than a black hole", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).SetTitle("PAUSED").AddCloseItem("Return to Game").Open()
    Frame(context)

    const { resources, drawnGlyphs, drawnRects } = CreateRecordingRenderingResources()

    RenderCanvas(context.registry, resources)

    const filled = FilledCells(drawnRects)
    const text = TextCells(drawnGlyphs)

    expect(text.length).toBeGreaterThan(0)
    expect(text.filter((cell)=>!filled.has(cell))).toEqual([])
  })

  // No camera in this context, so nothing but the menu is drawn -- which is the
  // point: the panel is the only fill, and it is bounded by the menu.
  it("fills only the panel, not the whole screen", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).SetTitle("PAUSED").AddCloseItem("Return to Game").Open()
    Frame(context)

    const { resources, drawnRects } = CreateRecordingRenderingResources()

    RenderCanvas(context.registry, resources)

    const panel = FindPanel(context)!

    expect(FilledCells(drawnRects).size).toBe(panel.multiTile.width * panel.multiTile.height)
  })
})

describe("the striped panel behind a menu's text", () => {
  const BuildSmallMenu = (context : ISystemContext) =>
    new MenuBuilder(context, BuildStubMenuLoopLayer).SetTitle("PAUSED").AddCloseItem("Back").Open()

  // The pattern belongs to the menu, not the screen: it used to be a full-screen
  // scrim, and the world is meant to show around the panel now.
  it("covers only the menu, not the viewport", () => {
    const context = BuildContext()

    BuildSmallMenu(context)
    Frame(context)

    const panel = FindPanel(context)!

    expect(panel.multiTile.width).toBeLessThan(GameWidth)
    expect(panel.multiTile.height).toBeLessThan(GameWidth)
  })

  it("sits under the text", () => {
    const context = BuildContext()

    BuildSmallMenu(context)
    Frame(context)

    expect(FindPanel(context)!.layer.layerIndex).toBeLessThan(MenuLayer)
  })

  it("alternates two shades by column", () => {
    const context = BuildContext()

    BuildSmallMenu(context)
    Frame(context)

    const { multiTile } = FindPanel(context)!

    // Neighbouring columns differ, and the pattern repeats every two stripes.
    expect(multiTile.paletteIndices[0]).not.toBe(multiTile.paletteIndices[MenuPanelStripeWidth])
    expect(multiTile.paletteIndices[0]).toBe(multiTile.paletteIndices[MenuPanelStripeWidth * 2])
  })

  it("draws every one of its cells as a fill rather than a glyph", () => {
    const context = BuildContext()

    BuildSmallMenu(context)
    Frame(context)

    const { multiTile } = FindPanel(context)!

    expect(multiTile.palette.every((entry)=>entry.fillsCell)).toBe(true)
  })

  // Keyed on the absolute screen column, so two menus of different widths line
  // their bands up instead of the pattern sliding with the panel's left edge.
  it("keeps its stripes aligned across menus of different widths", () => {
    const narrow = BuildContext()
    BuildSmallMenu(narrow)
    Frame(narrow)

    const wide = BuildContext()
    const builder = new MenuBuilder(wide, BuildStubMenuLoopLayer)
    BuildKeybindingsMenu(builder)
    builder.Open()
    Frame(wide)

    /** Which shade the given absolute screen column was painted. */
    const ShadeAtColumn = (context : ISystemContext, screenColumn : number) => {
      const panel = FindPanel(context)!

      return panel.multiTile.paletteIndices[screenColumn - panel.screen.x]
    }

    // A column both panels cover, near the middle of the screen.
    const sharedColumn = Math.floor(GameWidth / 2)

    expect(ShadeAtColumn(narrow, sharedColumn)).toBe(ShadeAtColumn(wide, sharedColumn))
  })

  // One entity, not one per cell -- it is rebuilt every time the cursor moves.
  it("is a single entity", () => {
    const context = BuildContext()

    BuildSmallMenu(context)
    Frame(context)

    let panelCount = 0
    context.registry.ForEachEntityWith([ScreenPosition, MultiTileRepresentation], ()=>{ panelCount++ })

    expect(panelCount).toBe(1)
  })

  it("goes away with the menu", () => {
    const context = BuildContext()
    const menu = BuildSmallMenu(context)

    Frame(context)
    CloseMenu(context, menu)

    expect(FindPanel(context)).toBeUndefined()
  })
})

describe("MenuBuilder.Open", () => {
  it("pushes a blackout layer and a menu layer, in that order", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).AddCloseItem("Back").Open()

    // The world layer, then the blackout, then the menu's own on top.
    expect(context.resources.Input.layerStack).toHaveLength(3)
  })

  it("puts the menu layer above the blackout, so the menu still hears itself", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer).AddCloseItem("Back").Open()

    // The menu listens on the topmost layer; the blackout is the one below it.
    expect(context.registry.GetComponent(menu, ActionListener)?.layer).toBe(context.resources.Input.layerStack.at(-1))

    Frame(context, [KeyDown("Space")])

    // Interacting with the only row closed it, which it could not do unless it heard.
    expect(context.registry.IsAlive(menu)).toBe(false)
  })

  it("skips the blackout when asked", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).Blackout(false).AddCloseItem("Back").Open()

    expect(context.resources.Input.layerStack).toHaveLength(2)
  })

  it("pushes its own loop layer, so the world stops simulating", () => {
    const context = BuildContext()

    new MenuBuilder(context, BuildStubMenuLoopLayer).AddCloseItem("Back").Open()

    expect(context.resources.Schedule.ActiveLayer()?.name).toBe("Menu")
  })

  it("marks static rows unselectable and menu items selectable", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer)
      .AddStaticRow("Listing")
      .AddCloseItem("Back")
      .Open()

    expect(StateOf(context, menu).items.map((item)=>item.selectable)).toEqual([false, true])
  })
})

describe("CloseMenu", () => {
  it("leaves both stacks exactly as it found them", () => {
    const context = BuildContext()

    const inputBefore = [...context.resources.Input.layerStack]
    const loopBefore = [...context.resources.Schedule.stack]

    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer).AddCloseItem("Back").Open()

    CloseMenu(context, menu)

    expect(context.resources.Input.layerStack).toEqual(inputBefore)
    expect(context.resources.Schedule.stack).toEqual(loopBefore)
  })

  it("destroys the menu and its glyphs", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer).SetTitle("PAUSED").AddCloseItem("Back").Open()

    Frame(context)
    expect(DrawnText(context)).toContain("PAUSED")

    CloseMenu(context, menu)

    expect(context.registry.IsAlive(menu)).toBe(false)
    expect(DrawnText(context)).toBe("")
  })
})

describe("navigation", () => {
  const BuildThreeRowMenu = (context : ISystemContext) => new MenuBuilder(context, BuildStubMenuLoopLayer)
    .AddMenuItem("First", ()=>{})
    .AddMenuItem("Second", ()=>{})
    .AddMenuItem("Third", ()=>{})
    .Open()

  it("moves down", () => {
    const context = BuildContext()
    const menu = BuildThreeRowMenu(context)

    Press(context, "ArrowDown")

    expect(StateOf(context, menu).selectedIndex).toBe(1)
  })

  it("wraps past the end", () => {
    const context = BuildContext()
    const menu = BuildThreeRowMenu(context)

    Press(context, "ArrowDown")
    Press(context, "ArrowDown")
    Press(context, "ArrowDown")

    expect(StateOf(context, menu).selectedIndex).toBe(0)
  })

  it("wraps backwards past the start", () => {
    const context = BuildContext()
    const menu = BuildThreeRowMenu(context)

    Press(context, "ArrowUp")

    expect(StateOf(context, menu).selectedIndex).toBe(2)
  })

  // A keybindings screen is mostly listing, and a cursor that could land on a
  // row that does nothing when confirmed would look broken.
  it("skips rows that are only text", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer)
      .AddMenuItem("First", ()=>{})
      .AddStaticRow("Listing")
      .AddStaticRow("Listing")
      .AddMenuItem("Last", ()=>{})
      .Open()

    Press(context, "ArrowDown")

    expect(StateOf(context, menu).selectedIndex).toBe(3)
  })

  it("stays put on a screen with nothing selectable at all", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer).AddStaticRow("One").AddStaticRow("Two").Open()

    Press(context, "ArrowDown")

    expect(StateOf(context, menu).selectedIndex).toBe(0)
  })

  it("does not move the camera's keys", () => {
    const context = BuildContext()
    const menu = BuildThreeRowMenu(context)

    Press(context, "KeyS")

    expect(StateOf(context, menu).selectedIndex).toBe(0)
  })
})

describe("confirming", () => {
  it("invokes the selected row", () => {
    const context = BuildContext()
    const invoked : string[] = []

    new MenuBuilder(context, BuildStubMenuLoopLayer)
      .AddMenuItem("First", ()=>{ invoked.push("First") })
      .AddMenuItem("Second", ()=>{ invoked.push("Second") })
      .Open()

    Press(context, "ArrowDown")
    Press(context, "Space")

    expect(invoked).toEqual(["Second"])
  })

  it("hands the callback the menu it belongs to", () => {
    const context = BuildContext()
    let received : Entity | undefined

    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer)
      .AddMenuItem("Row", (_context, owner)=>{ received = owner })
      .Open()

    Press(context, "Space")

    expect(received).toBe(menu)
  })
})

describe("submenus", () => {
  const BuildParent = (context : ISystemContext) => new MenuBuilder(context, BuildStubMenuLoopLayer)
    .SetTitle("PARENT")
    .AddSubMenuItem("Open child", (child)=>{ child.SetTitle("CHILD").AddCloseItem("Back") })
    .Open()

  it("stacks a second pair of input layers and a second loop layer", () => {
    const context = BuildContext()

    BuildParent(context)
    const inputDepth = context.resources.Input.layerStack.length
    const loopDepth = context.resources.Schedule.stack.length

    Press(context, "Space")

    expect(context.resources.Input.layerStack).toHaveLength(inputDepth + 2)
    expect(context.resources.Schedule.stack).toHaveLength(loopDepth + 1)
  })

  // The submenu case the layer stack exists for: closing the child restores the
  // parent exactly, without the parent having been rebuilt.
  it("pops only itself, leaving the parent intact", () => {
    const context = BuildContext()
    const parent = BuildParent(context)

    const inputDepth = context.resources.Input.layerStack.length
    const loopDepth = context.resources.Schedule.stack.length

    Press(context, "Space")
    Press(context, "Space")

    expect(context.registry.IsAlive(parent)).toBe(true)
    expect(context.resources.Input.layerStack).toHaveLength(inputDepth)
    expect(context.resources.Schedule.stack).toHaveLength(loopDepth)
  })

  // Both menus' glyphs exist as entities at once, so the buried one has to come
  // down or the two would overlap at the same anchor.
  it("shows only the top menu", () => {
    const context = BuildContext()

    BuildParent(context)
    Frame(context)
    expect(DrawnText(context)).toContain("PARENT")

    Press(context, "Space")
    Frame(context)

    expect(DrawnText(context)).toContain("CHILD")
    expect(DrawnText(context)).not.toContain("PARENT")
  })

  // The frame the submenu opens on, the parent's body comes down. If the child
  // were not drawn on that same frame there would be a blank flash between them.
  it("never leaves the screen empty on the frame it opens", () => {
    const context = BuildContext()

    BuildParent(context)
    Frame(context)

    // The press and the open happen inside this one frame.
    Frame(context, [KeyDown("Space")])

    expect(DrawnText(context)).toContain("CHILD")
  })

  it("draws the parent again once the child closes", () => {
    const context = BuildContext()

    BuildParent(context)
    Press(context, "Space")
    Press(context, "Space")
    Frame(context)

    expect(DrawnText(context)).toContain("PARENT")
  })
})

describe("escape", () => {
  it("closes the menu", () => {
    const context = BuildContext()
    const menu = new MenuBuilder(context, BuildStubMenuLoopLayer).AddCloseItem("Back").Open()

    Press(context, "Escape")

    expect(context.registry.IsAlive(menu)).toBe(false)
  })

  it("closes only the submenu, not its parent", () => {
    const context = BuildContext()

    const parent = new MenuBuilder(context, BuildStubMenuLoopLayer)
      .AddSubMenuItem("Open child", (child)=>{ child.AddCloseItem("Back") })
      .Open()

    Press(context, "Space")
    Press(context, "Escape")

    expect(context.registry.IsAlive(parent)).toBe(true)
  })
})

describe("the keybindings screen", () => {
  it("lists every action with the key bound to it", () => {
    const context = BuildContext()
    const builder = new MenuBuilder(context, BuildStubMenuLoopLayer)

    BuildKeybindingsMenu(builder)
    builder.Open()

    Frame(context)
    const drawn = DrawnText(context)

    expect(drawn).toContain("KEYBINDINGS")
    expect(drawn).toContain("PanCameraUp")
    expect(drawn).toContain("KeyW")
    expect(drawn).toContain("Escape")
  })

  // Read off KeyBindings rather than hand-written, so it cannot drift.
  it("reflects a rebind", () => {
    const context = BuildContext()

    context.resources.Input.bindings.Rebind("PanCameraUp", ["KeyZ"])

    const builder = new MenuBuilder(context, BuildStubMenuLoopLayer)

    BuildKeybindingsMenu(builder)
    builder.Open()

    Frame(context)

    expect(DrawnText(context)).toContain("KeyZ")
  })

  // The widest screen in the game, against the smallest dimension it has to fit
  // in. This is the test that fails first if GameWidth is lowered again, rather
  // than the menu quietly rendering half off the edge -- IsOutsideViewport drops
  // out-of-bounds cells silently, so nothing else would complain.
  it("fits inside the viewport", () => {
    const context = BuildContext()
    const builder = new MenuBuilder(context, BuildStubMenuLoopLayer)

    BuildKeybindingsMenu(builder)
    builder.Open()
    Frame(context)

    const cells : Array<{ x : number, y : number }> = []

    context.registry.ForEachEntityWith([ScreenPosition], (_entity, screen) => { cells.push({ x: screen.x, y: screen.y }) })

    expect(cells.length).toBeGreaterThan(0)
    expect(Math.min(...cells.map((cell)=>cell.x))).toBeGreaterThanOrEqual(0)
    expect(Math.min(...cells.map((cell)=>cell.y))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...cells.map((cell)=>cell.x))).toBeLessThan(GameWidth)
    expect(Math.max(...cells.map((cell)=>cell.y))).toBeLessThan(GameWidth)
  })

  it("leaves only Back selectable", () => {
    const context = BuildContext()
    const builder = new MenuBuilder(context, BuildStubMenuLoopLayer)

    BuildKeybindingsMenu(builder)

    const menu = builder.Open()
    const state = StateOf(context, menu)

    expect(state.items.filter((item)=>item.selectable).map((item)=>item.label)).toEqual(["Back"])
  })
})
