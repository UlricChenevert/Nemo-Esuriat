import type { Entity } from "./Entity.ts";

/**
 * The needs readout drawn along the bottom of the screen, and what it currently
 * says.
 *
 * Registered on the acting player only while something is selected, and removed
 * the moment nothing is -- which is why every field is required rather than
 * optional. The component's PRESENCE is "there is a readout on screen", so a
 * half-built one with an undefined body would be a third state that nothing in
 * UpdateHud knows how to read.
 *
 * The two cell counts are what was last drawn, and the whole reason they are
 * stored: the bars only change when a need crosses a twentieth of its range, so
 * comparing them is what turns a rebuild every frame into a rebuild every few
 * seconds. Same retained-mode bargain as MenuState.body, minus the dirty flag --
 * here the drawn values ARE the flag.
 */
export class HudState {
    constructor (
        /** The entity owning the drawn glyphs. Destroying it clears the readout. */
        public body : Entity,
        public hungerCells : number,
        public waterCells : number
    ) {}
}
