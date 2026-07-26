import { Color } from "../Contracts/Components/Color.ts";

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
export const AnimalLayer = 2
export const PlayerLayer = 3
export const TextLayer = 5
/** Above everything: the picker has to be clickable over whatever it covers. */
export const PromotionPickerLayer = 6

/** The glyph a legal destination is marked with, in the moving side's colour. */
export const MoveHintGlyph = "."

export const TileSizePixels = 16;

export const CharacterRepresentation = {
    Blank : '&#x0020;',
    Character : '&#x1338;',
    NPC : '&#x1330;',
    Water : '_',//&#x2248;
    Null : "&#x0000;",
    Animal : "&#x040B;", // I really want "&#x12B8;"
    Path : ".",
    PineTree : "&#x219F;",
    Hill : "^", //
    Mountain : "A", //&#x22C0;
    Grass : " ", // &#x02F5;
    Shrine : "&#x127E;",
    Farmland:"&#x2583;",
    SmallHouse:"&#x21D1;",
    Hut:"&#x03C0;",
    LargeHouse:"&#x220F;",
    LoadingBar : "o"
}

export const GameColors = {
    Background : new Color(0, 0, 0),
    Player: new Color(255, 0, 0),
    Villages: new Color(0, 255, 0),
    NPC: new Color(28, 92, 28)
}