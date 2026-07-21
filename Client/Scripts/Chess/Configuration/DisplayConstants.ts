import { Color } from "../Contracts/Color.ts";

export const KingRepresentationLetter = "K"
export const QueenRepresentationLetter = "Q"
export const BishopRepresentationLetter = "B"
export const CavalryRepresentationLetter = "C"
export const RookRepresentationLetter = "R"
export const PawnRepresentationLetter = "P"

export const BoardColorMain = new Color(35, 35, 40)
export const BoardColorAlternate = new Color(55, 55, 62)
export const BackgroundColor = new Color(0, 0, 0)

export const PrimaryPieceColor = new Color(230, 33, 0)

export const ColorTranslation = 25

export const SecondaryPieceColor = new Color(32,194,14)

export const TextColor = new Color(255, 255, 255)

export const UndefinedLayer = -1
export const BackgroundLayer = 0
/** Move hints sit over the board but under the pieces, so a piece is never hidden. */
export const MoveHintLayer = 1
export const ChessPieceLayer = 2
export const TextLayer = 5
/** Above everything: the picker has to be clickable over whatever it covers. */
export const PromotionPickerLayer = 6

/** The glyph a legal destination is marked with, in the moving side's colour. */
export const MoveHintGlyph = "."

export const TileSizePixels = 16;
