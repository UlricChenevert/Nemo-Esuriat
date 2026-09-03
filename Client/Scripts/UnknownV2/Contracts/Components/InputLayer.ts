/**
 * Marks an entity as one level of the input stack.
 *
 * A layer is an entity rather than a plain record in a resource for the reason
 * the camera is: something has to own it. A menu that owns its layers is torn
 * down by one DestroyEntity, and the Owns cascade pops them for free -- no
 * separate "remember to unwind the stack" step that a return-early path can
 * skip.
 *
 * Layers are transparent by default: they intercept only the actions their
 * listeners claim, and everything else falls through to the layer beneath. That
 * is what lets a submenu take Up/Down/Confirm while the menu under it keeps its
 * own bindings intact for when the submenu pops.
 */
export class InputLayer {
    /**
     * A blackout layer claims every action and discards it.
     *
     * Transparency composes well between menus but is wrong at the boundary
     * between the menu stack and the game: with only transparent layers, a key
     * no menu happens to claim still reaches the camera and the world scrolls
     * behind a pause screen. Rather than force every menu to enumerate the
     * actions it wants to suppress -- a list that grows every time an action is
     * added -- a blackout layer is pushed under the first menu and stops
     * everything at that seam.
     */
    constructor (public blackout = false) {}
}
