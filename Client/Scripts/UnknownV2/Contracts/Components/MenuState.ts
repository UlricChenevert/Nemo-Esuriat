import type { ISystemContext } from "../../Interfaces/ISystemContext.ts";
import type { GameLoopLayer } from "../Schedule.ts";
import type { Entity } from "./Entity.ts";
import type { MultiTileRepresentation } from "./MultiTileRepresentation.ts";

/** One row of a menu. */
export interface MenuItem {
    label : string

    /**
     * Whether the cursor may land here.
     *
     * False for rows that are text and nothing else -- the action/key pairs on
     * the keybindings screen. Navigation skips them, so a screen that is mostly
     * listing cannot trap the cursor on a row that does nothing when confirmed.
     */
    selectable : boolean

    /** Runs when the row is confirmed. `menu` is the root entity it belongs to. */
    invoke : (context : ISystemContext, menu : Entity) => void
}

/**
 * A menu, as data.
 *
 * The glyphs on screen are a projection of this, not the source of truth:
 * HandleMenuActions rebuilds them from here whenever isDirty is set, so moving
 * the cursor is one integer change rather than an edit to a hundred character
 * entities.
 *
 * Callbacks living in a component is unusual for this codebase but not new --
 * GameContext.disposalFunctions is a list of closures for the same reason. What
 * a menu row does is genuinely per-row behaviour, and the alternative, an
 * action enum with a switch somewhere else, would put every menu's behaviour in
 * one file that grows with each screen added.
 */
export class MenuState {
    /**
     * The entity owning the currently drawn glyphs, or undefined before the
     * first draw.
     *
     * A layer of indirection between the menu root and its characters so a
     * redraw can destroy the whole body in one call. Destroying the root's
     * children directly would take the input layers with them, since the root
     * owns those too.
     */
    body : Entity | undefined

    /** Set whenever the drawn glyphs no longer match this state. */
    isDirty = true

    constructor (
        public title : string,
        public items : MenuItem[],
        /**
         * Top-left corner in screen tiles, or undefined to centre.
         *
         * Undefined by default, and resolved at draw time rather than when the
         * menu is built, because centring needs the width of the rendered rows --
         * which includes the cursor prefix and, for the keybindings screen,
         * whatever the bindings happen to be. A fixed offset guessed up front
         * centres exactly one screen and leaves every other one sitting off to
         * the side.
         */
        public anchorX : number | undefined,
        public anchorY : number | undefined,
        /**
         * The gameloop layer this menu pushed.
         *
         * Held here so closing is one lookup rather than an assumption about
         * stack order: a menu whose owner is destroyed out from under it may no
         * longer be on top, and popping blindly would take somebody else's
         * layer. Input layers need no equivalent -- those are entities, and the
         * Owns cascade already knows which belong to this menu.
         */
        public loopLayer : GameLoopLayer,
        public selectedIndex = 0,
        /**
         * A picture to show behind this menu, or undefined for none.
         *
         * The title screen wants one and a mid-game pause screen does not, so it
         * is per-menu rather than a property of menus in general.
         */
        public art : MultiTileRepresentation | undefined = undefined
    ) {}
}
