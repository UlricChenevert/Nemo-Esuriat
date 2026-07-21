import type { Entity } from "./Entity.ts";

/** One glyph of the promotion picker: the piece it offers and the pawn it would replace. */
export class PromotionOption {
    constructor (public letter : string, public pawn : Entity) {}
}
