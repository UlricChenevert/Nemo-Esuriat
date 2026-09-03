import { MenuMutedColor, MenuSelectedColor, TextColor } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { MenuState } from "../Contracts/Components/MenuState.ts";
import { ScreenPosition } from "../Contracts/Components/ScreenPosition.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { EntityBuilder } from "../Systems.Framework/EntityBuilder.ts";
import { CloseMenu } from "../Systems.Framework/MenuBuilder.ts";

/** Blank line between the title and the first row. */
const TitleGap = 2
/** Cells of panel around the text on every side. */
const PanelPadding = 2
/** Room for the "> " cursor, so rows do not shift sideways as it moves. */
const CursorPrefix = "> "
const NoCursorPrefix = "  "

/**
 * Drives whatever menu currently has the player's attention, and keeps its
 * glyphs matching its state.
 *
 * Which menu that is never has to be worked out from the stack for input
 * purposes: ResolveInputActions has already decided, and a menu on a buried
 * layer simply has an empty triggered set. Drawing does need to know, because
 * every open menu's characters exist simultaneously and two of them at the same
 * anchor would overlap -- so the menus that are not on top have their bodies
 * taken down and rebuilt when they surface again.
 */
export function HandleMenuActions (context : ISystemContext) {
    const { registry, resources } = context

    // Collected before anything runs: confirming a row can destroy this menu or
    // create another, and IComponentRegistry only promises that removing the
    // entity currently being visited is safe.
    const menus : Entity[] = []

    registry.ForEachEntityWith([MenuState, ActionListener], (menu) => { menus.push(menu) })

    for (const menu of menus) {
        if (!registry.IsAlive(menu)) continue

        const state = registry.GetComponent(menu, MenuState)
        const listener = registry.GetComponent(menu, ActionListener)

        if (state === undefined || listener === undefined) continue
        if (listener.triggered.size === 0) continue

        if (listener.triggered.has("NavigateUp")) MoveSelection(state, -1)
        if (listener.triggered.has("NavigateDown")) MoveSelection(state, 1)

        // Escape is OpenMenu everywhere; on an open menu it means "back", which
        // is the same key doing the same thing one level down.
        if (listener.triggered.has("OpenMenu")) { CloseMenu(context, menu); continue }

        // Interact is "act on what is in front of me", and on a menu the thing in
        // front of you is the selected row. The player's own Interact never
        // arrives here: this menu's input layer sits above the world's and claims
        // the action for as long as it is open.
        if (listener.triggered.has("Interact")) {
            const item = state.items[state.selectedIndex]

            // Invoking may close this menu, so nothing may touch `state` after.
            if (item?.selectable) item.invoke(context, menu)
        }
    }

    const topMenu = FindTopMenu(registry, resources.Input.layerStack)

    // Re-collected rather than reusing the list above, which was taken before
    // any row ran: confirming a row can open a submenu, and drawing from the
    // stale list would leave the new menu undrawn for a frame while the parent
    // it replaced was already taken down -- one frame of nothing on screen.
    const openMenus : Entity[] = []

    registry.ForEachEntityWith([MenuState], (menu) => { openMenus.push(menu) })

    for (const menu of openMenus) {
        const state = registry.GetComponent(menu, MenuState)

        if (state === undefined) continue

        if (menu !== topMenu) { TakeDownBody(context, state); continue }
        if (state.isDirty) DrawMenu(context, menu, state)
    }
}

/**
 * Steps the cursor to the next selectable row, wrapping.
 *
 * Bounded by the item count so a screen with no selectable rows at all -- a pure
 * listing -- stops rather than spinning forever looking for one.
 */
function MoveSelection (state : MenuState, direction : number) {
    const count = state.items.length

    if (count === 0) return

    for (let step = 1; step <= count; step++) {
        const candidate = (((state.selectedIndex + direction * step) % count) + count) % count

        if (!state.items[candidate]?.selectable) continue

        state.selectedIndex = candidate
        state.isDirty = true

        return
    }
}

/**
 * The menu whose input layer sits highest, or undefined if none is open.
 *
 * Walks from the top of the stack down, so the first menu found is the one the
 * player is looking at.
 */
function FindTopMenu (registry : ISystemContext["registry"], layerStack : readonly Entity[]) : Entity | undefined {
    const menuByLayer = new Map<Entity, Entity>()

    registry.ForEachEntityWith([MenuState, ActionListener], (menu, _state, listener) => { menuByLayer.set(listener.layer, menu) })

    for (let index = layerStack.length - 1; index >= 0; index--) {
        const menu = menuByLayer.get(layerStack[index]!)

        if (menu !== undefined) return menu
    }

    return undefined
}

/** Destroys the drawn glyphs, leaving the menu to redraw when it resurfaces. */
function TakeDownBody (context : ISystemContext, state : MenuState) {
    if (state.body === undefined) return

    context.registry.DestroyEntity(state.body)
    state.body = undefined
    state.isDirty = true
}

/**
 * Rebuilds every glyph from the menu's state.
 *
 * Whole-body rather than a diff: a menu is a few hundred one-character entities
 * and is redrawn only when something changed, so the simplest thing that is
 * obviously correct wins over anything that has to reason about which cells
 * moved. The body is its own entity, owned by the root, precisely so this is one
 * DestroyEntity -- destroying the root's children directly would take the input
 * layers with them.
 */
function DrawMenu (context : ISystemContext, menu : Entity, state : MenuState) {
    TakeDownBody(context, state)

    const rows = [state.title, "", ...state.items.map((item, index)=>
        (item.selectable ? (index === state.selectedIndex ? CursorPrefix : NoCursorPrefix) : NoCursorPrefix) + item.label
    )]

    const width = rows.reduce((widest, row)=>Math.max(widest, row.length), 0)

    // Centred on the text block that was just laid out, not on a guess made
    // before it existed. Every row is padded to the same width by the panel, so
    // centring the block centres the panel around it too.
    const anchorX = state.anchorX ?? Math.floor((GameWidth - width) / 2)
    const anchorY = state.anchorY ?? Math.floor((GameWidth - rows.length) / 2)

    const body = new EntityBuilder(context.registry).AddOwner(menu)

    // Behind the panel, and only if this menu has one. The picture is a single
    // entity over a shared buffer, so rebuilding it with the rest of the body on
    // every cursor move costs one entity rather than a screenful.
    if (state.art !== undefined) body.AddScreenArt(state.art)

    body.AddScreenPanel(
        anchorX - PanelPadding,
        anchorY - PanelPadding,
        width + PanelPadding * 2,
        rows.length + PanelPadding * 2
    )

    body.AddScreenText(state.title, new ScreenPosition(anchorX, anchorY), TextColor)

    state.items.forEach((item, index)=>{
        const color = !item.selectable ? MenuMutedColor
            : index === state.selectedIndex ? MenuSelectedColor
            : TextColor

        body.AddScreenText(rows[index + TitleGap]!, new ScreenPosition(anchorX, anchorY + index + TitleGap), color)
    })

    state.body = body.GetEntity()
    state.isDirty = false
}
