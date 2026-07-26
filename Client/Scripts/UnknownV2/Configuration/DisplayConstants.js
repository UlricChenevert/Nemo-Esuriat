import { Color } from "../Contracts/Components/Color.js";
import { Representation } from "../Contracts/Components/Representation.js";
export const BoardColorMain = new Color(35, 35, 40);
export const BoardColorAlternate = new Color(55, 55, 62);
export const BackgroundColor = new Color(0, 0, 0);
export const PrimaryPieceColor = new Color(230, 33, 0);
export const ColorTranslation = 25;
export const SecondaryPieceColor = new Color(32, 194, 14);
export const TextColor = new Color(255, 255, 255);
export const UndefinedLayer = -1;
export const BackgroundLayer = 0;
/** Move hints sit over the board but under the pieces, so a piece is never hidden. */
export const MoveHintLayer = 1;
export const AnimalLayer = 2;
export const PlayerLayer = 3;
export const TextLayer = 5;
/** Above everything: the picker has to be clickable over whatever it covers. */
export const PromotionPickerLayer = 6;
/** The glyph a legal destination is marked with, in the moving side's colour. */
export const MoveHintGlyph = ".";
export const TileSizePixels = 16;
/**
 * Glyphs drawn on the canvas.
 *
 * These must be real characters, not HTML entity text. The canvas draws through
 * fillText, which has no notion of HTML escaping and would render "&#x1338;"
 * literally, as nine characters. Unicode escapes are used where the intended
 * character is not obvious from the glyph alone.
 */
export const CharacterRepresentation = {
    Blank: " ",
    Character: "ጸ",
    NPC: "ጰ",
    Water: "_",
    Animal: "Ћ",
    Path: ".",
    PineTree: "↟",
    Hill: "^",
    Mountain: "A",
    Grass: ",",
    Shrine: "ቾ",
    Farmland: "▃",
    SmallHouse: "⇑",
    Hut: "π",
    LargeHouse: "∏",
    LoadingBar: "o"
};
export const GameColors = {
    Background: new Color(0, 0, 0),
    Player: new Color(255, 0, 0),
    Villages: new Color(0, 255, 0),
    NPC: new Color(28, 92, 28),
    Water: new Color(48, 88, 160),
    Grass: new Color(56, 120, 56),
    Hill: new Color(120, 116, 72),
    Mountain: new Color(148, 148, 156)
};
/****************************************/
//
//     Terrain
//
/****************************************/
/**
 * Noise values above each threshold produce that terrain, tested from highest to
 * lowest. The comparison is strictly greater-than, so a noise value of exactly
 * 0.6 is a Hill rather than a Mountain; the boundary is pinned by test so it
 * cannot drift unnoticed.
 */
export const TerrainThresholds = {
    Mountain: 0.6,
    Hill: 0.5,
    Grassland: 0.3
};
/**
 * Indices into TerrainPalette. A plain object rather than an enum because
 * isolatedModules forbids const enums, and a regular enum would emit a runtime
 * object anyway.
 */
export const TerrainKind = {
    Water: 0,
    Grass: 1,
    Hill: 2,
    Mountain: 3
};
/**
 * The glyph and colour for each terrain kind, indexed by TerrainKind.
 *
 * Shared across every chunk rather than copied per tile. A chunk stores one byte
 * per tile indexing into this table, so terrain costs four Representation
 * objects in total instead of one per tile.
 */
export const TerrainPalette = [
    new Representation(CharacterRepresentation.Water, GameColors.Water),
    new Representation(CharacterRepresentation.Grass, GameColors.Grass),
    new Representation(CharacterRepresentation.Hill, GameColors.Hill),
    new Representation(CharacterRepresentation.Mountain, GameColors.Mountain)
];
//# sourceMappingURL=DisplayConstants.js.map