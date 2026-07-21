/**
 * A pawn that has reached the last rank and is waiting for its owner to say what it
 * becomes. While any entity carries this, play is suspended: input, turn switching and
 * win detection all stand down until the choice is made.
 */
export class PendingPromotion {}
