import { Color } from "../Contracts/Components/Color.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
export declare const BoardColorMain: Color;
export declare const BoardColorAlternate: Color;
export declare const BackgroundColor: Color;
export declare const PrimaryPieceColor: Color;
export declare const ColorTranslation = 25;
export declare const SecondaryPieceColor: Color;
export declare const TextColor: Color;
export declare const UndefinedLayer = -1;
export declare const BackgroundLayer = 0;
/** Move hints sit over the board but under the pieces, so a piece is never hidden. */
export declare const MoveHintLayer = 1;
export declare const AnimalLayer = 2;
export declare const PlayerLayer = 3;
export declare const TextLayer = 5;
/** Above everything: the picker has to be clickable over whatever it covers. */
export declare const PromotionPickerLayer = 6;
/** The glyph a legal destination is marked with, in the moving side's colour. */
export declare const MoveHintGlyph = ".";
export declare const TileSizePixels = 16;
/**
 * Glyphs drawn on the canvas.
 *
 * These must be real characters, not HTML entity text. The canvas draws through
 * fillText, which has no notion of HTML escaping and would render "&#x1338;"
 * literally, as nine characters. Unicode escapes are used where the intended
 * character is not obvious from the glyph alone.
 */
export declare const CharacterRepresentation: {
    Blank: string;
    Character: string;
    NPC: string;
    Water: string;
    Animal: string;
    Path: string;
    PineTree: string;
    Hill: string;
    Mountain: string;
    Grass: string;
    Shrine: string;
    Farmland: string;
    SmallHouse: string;
    Hut: string;
    LargeHouse: string;
    LoadingBar: string;
};
export declare const GameColors: {
    Background: Color;
    Player: Color;
    Villages: Color;
    NPC: Color;
    Water: Color;
    Grass: Color;
    Hill: Color;
    Mountain: Color;
};
/****************************************/
/****************************************/
/**
 * Noise values above each threshold produce that terrain, tested from highest to
 * lowest. The comparison is strictly greater-than, so a noise value of exactly
 * 0.6 is a Hill rather than a Mountain; the boundary is pinned by test so it
 * cannot drift unnoticed.
 */
export declare const TerrainThresholds: {
    Mountain: number;
    Hill: number;
    Grassland: number;
};
/**
 * Indices into TerrainPalette. A plain object rather than an enum because
 * isolatedModules forbids const enums, and a regular enum would emit a runtime
 * object anyway.
 */
export declare const TerrainKind: {
    readonly Water: 0;
    readonly Grass: 1;
    readonly Hill: 2;
    readonly Mountain: 3;
};
/**
 * The glyph and colour for each terrain kind, indexed by TerrainKind.
 *
 * Shared across every chunk rather than copied per tile. A chunk stores one byte
 * per tile indexing into this table, so terrain costs four Representation
 * objects in total instead of one per tile.
 */
export declare const TerrainPalette: readonly Representation[];
//# sourceMappingURL=DisplayConstants.d.ts.map