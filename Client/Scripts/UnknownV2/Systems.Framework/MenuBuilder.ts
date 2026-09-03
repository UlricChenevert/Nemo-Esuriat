import type { GameAction } from "../Contracts/Actions/GameActions.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { MenuState, type MenuItem } from "../Contracts/Components/MenuState.ts";
import type { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import type { GameLoopLayer } from "../Contracts/Schedule.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { EntityBuilder } from "./EntityBuilder.ts";
import { PushLoopLayer, RemoveLoopLayer } from "./GameLoopStack.ts";
import { PruneDeadLayers, PushInputLayer } from "./InputLayerStack.ts";

/**
 * The actions every menu claims. Declared once so a new screen cannot forget one
 * and end up unable to close itself.
 */
export const MenuActions : GameAction[] = ["NavigateUp", "NavigateDown", "Interact", "OpenMenu"]

/** How a menu's own gameloop layer is produced. See the class comment. */
export type LoopLayerFactory = () => GameLoopLayer

/**
 * Builds a menu the way EntityBuilder builds an entity: a chain of what you
 * want, and none of how it is wired.
 *
 * A menu is four things that have to agree -- a gameloop layer so the world
 * stops simulating, an input layer so it hears the arrows, a blackout layer
 * beneath it so the camera does not, and a tree of glyph entities. Each is
 * push/pop symmetric, and each is a chance to leak a layer that swallows input
 * for the rest of the session. Open and CloseMenu are the only two places that
 * know the sequence, so call sites read as a list of rows and nothing else:
 *
 *     new MenuBuilder(context, BuildMenuLoopLayer)
 *         .SetTitle("Paused")
 *         .AddCloseItem("Return to Game")
 *         .AddSubMenuItem("Show Keybindings", BuildKeybindingsMenu)
 *         .Open()
 *
 * The loop layer arrives as a factory, not an instance, for two reasons:
 * building one means naming gameplay systems, which a framework builder has no
 * business importing; and a submenu needs its own layer object, since two menus
 * sharing one would be the same entry twice on the stack and closing either
 * would remove the wrong one.
 */
export class MenuBuilder {
    /** The menu root. Named to match EntityBuilder.entity. */
    readonly entity : Entity

    private _title = ""
    private _items : MenuItem[] = []
    private _blackout = true
    private _anchorX : number | undefined
    private _anchorY : number | undefined
    private _art : MultiTileRepresentation | undefined

    constructor (readonly context : ISystemContext, private buildLoopLayer : LoopLayerFactory) {
        this.entity = context.registry.CreateEntity()
    }

    SetTitle(title : string) {
        this._title = title

        return this
    }

    /**
     * A selectable row. `invoke` runs when it is confirmed, and is handed the
     * context and this menu's root so it can close or replace itself.
     */
    AddMenuItem(label : string, invoke : (context : ISystemContext, menu : Entity) => void) {
        this._items.push({ label, selectable: true, invoke })

        return this
    }

    /** A row that closes this menu. */
    AddCloseItem(label : string) {
        return this.AddMenuItem(label, CloseMenu)
    }

    /**
     * A row that opens a menu on top of this one.
     *
     * `build` describes the child; layers, ownership and the loop push are this
     * method's problem. The child is independent -- closing it removes only its
     * own layers and leaves this menu exactly as it was, which is the submenu
     * case the layer stack exists for.
     */
    AddSubMenuItem(label : string, build : (builder : MenuBuilder) => void) {
        const buildLoopLayer = this.buildLoopLayer

        return this.AddMenuItem(label, (context)=>{
            const child = new MenuBuilder(context, buildLoopLayer)

            build(child)
            child.Open()
        })
    }

    /**
     * A row that is text and nothing else -- what a keybindings listing is made
     * of. Navigation skips it, so a screen of these cannot trap the cursor.
     */
    AddStaticRow(label : string) {
        this._items.push({ label, selectable: false, invoke: ()=>{} })

        return this
    }

    /**
     * Pins the menu's top-left corner to a screen tile.
     *
     * Without this a menu centres itself on its own content, which is what every
     * screen in the game wants; this is the escape hatch for one that does not.
     */
    AnchorAt(screenX : number, screenY : number) {
        this._anchorX = screenX
        this._anchorY = screenY

        return this
    }

    /**
     * Shows a picture behind this menu, centred on the viewport.
     *
     * Passed in rather than named here, so the framework does not have to know
     * which artwork the game happens to own.
     */
    WithArt(art : MultiTileRepresentation) {
        this._art = art

        return this
    }

    /**
     * Whether to push a blackout layer beneath this menu. On by default.
     *
     * Turn it off for a menu meant to sit over live gameplay -- a panel that
     * takes Interact but leaves the camera pannable.
     */
    Blackout(enabled : boolean) {
        this._blackout = enabled

        return this
    }

    /**
     * Commits the menu: layers pushed, listener registered, state attached.
     *
     * The glyphs are not drawn here. MenuState starts dirty and HandleMenuActions
     * draws it on the first frame it runs, so exactly one place turns menu state
     * into characters rather than one for the first draw and another for redraws.
     */
    Open() : Entity {
        const { registry, eventQueue, resources } = this.context

        // Blackout first so it ends up UNDER the menu layer. Above it, the
        // blackout would eat the menu's own arrows before the menu saw them.
        // Owned by the root, so one DestroyEntity takes both layers with it.
        if (this._blackout) PushInputLayer(registry, resources.Input, this.entity, true)

        const inputLayer = PushInputLayer(registry, resources.Input, this.entity)

        new EntityBuilder(registry, this.entity).AddActionListener(inputLayer, ...MenuActions)

        // Left undefined unless AnchorAt was called, which means "centre me".
        // HandleMenuActions resolves it once it knows how wide the rows came out.
        const loopLayer = PushLoopLayer(resources.Schedule, eventQueue, this.buildLoopLayer())

        registry.RegisterEntity(this.entity, MenuState, new MenuState(this._title, this._items, this._anchorX, this._anchorY, loopLayer, 0, this._art))

        return this.entity
    }
}

/**
 * Tears a menu down.
 *
 * Destroying the root does most of it: Owns cascades to the glyph body and to
 * both input layer entities. The loop layer is not an entity, so it comes off
 * explicitly -- by identity rather than by popping, because a menu closed
 * out of order is not necessarily the top of the stack.
 *
 * Shaped as an (context, menu) callback so it can be a MenuItem.invoke directly.
 */
export function CloseMenu (context : ISystemContext, menu : Entity) : void {
    const { registry, eventQueue, resources } = context

    const state = registry.GetComponent(menu, MenuState)

    registry.DestroyEntity(menu)

    if (state !== undefined) RemoveLoopLayer(resources.Schedule, eventQueue, state.loopLayer)

    // ResolveInputActions prunes dead layers at the top of each frame, but the
    // menu can be closed by a system that runs after it. Pruning now keeps the
    // stack honest for the rest of this frame too.
    PruneDeadLayers(registry, resources.Input)
}
