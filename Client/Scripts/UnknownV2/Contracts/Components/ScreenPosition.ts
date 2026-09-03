/**
 * A fixed spot on the screen, in tiles from the top-left corner.
 *
 * The counterpart to Position: where Position says where a thing is in the
 * world and the renderer subtracts the camera to find it, this says where a
 * thing is on the display and the camera is not consulted at all. Menus need
 * that -- a pause screen that scrolled away when the camera panned would be a
 * bug, not a feature.
 *
 * Deliberately a separate component rather than a flag on Position: an entity
 * is anchored to the world or to the screen, never both, and the renderer's
 * queries stay a straight component match instead of a per-entity branch.
 */
export class ScreenPosition {
    constructor(public x : number, public y : number) {}

    Copy() {
        return new ScreenPosition(this.x, this.y)
    }
}
