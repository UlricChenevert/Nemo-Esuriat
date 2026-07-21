export const GameWidth = 8
export const FontStyle = "14px monospace"

/** "hotseat": two humans share the board. "vs-ai": the second side is the computer. */
export type GameMode = "hotseat" | "vs-ai"
// `as GameMode` keeps the type the full union so mode comparisons elsewhere stay live.
export const CurrentGameMode = "vs-ai" as GameMode

/**
 * In hotseat, every side is click-driven, so input is never withheld for not being
 * "the player". In vs-ai only the human side carries IsPlayer, and that check gates the
 * computer's turn away from the mouse.
 */
export const HotSeat = CurrentGameMode === "hotseat"

/**
 * How many plies the computer looks ahead. 3 is the practical ceiling for this engine:
 * with no move ordering yet, the worst case (the opening) blocks the loop for ~1.5s of
 * "thinking", and 4 blows out past 15s. Drop to 2 for snappier, weaker play.
 */
export const AiSearchDepth = 3