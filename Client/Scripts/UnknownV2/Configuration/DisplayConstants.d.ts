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
    Animal: Color;
    Water: Color;
    Grass: Color;
    Hill: Color;
    Mountain: Color;
    Earth: Color;
};
/****************************************/
/****************************************/
/**
 * Noise values above each threshold produce that terrain, tested from highest to
 * lowest. The comparison is strictly greater-than, so a noise value of exactly
 * 0.66 is a Hill rather than a Mountain; the boundary is pinned by test so it
 * cannot drift unnoticed.
 *
 * These are percentiles of the actual noise field, not round numbers. They were
 * previously 0.3/0.5/0.6, chosen as if the generator returned something uniform
 * over [0, 1] — it does not, and the field never descended far enough to reach
 * the water band at all. Measured over the full world period with NoiseGain
 * applied, these produce roughly 15% water, 45% grass, 28% hill, 12% mountain.
 *
 * They are only valid against the noise configuration in WorldConstants. Change
 * NoiseOctaves, NoisePersistence, or NoiseGain and these must be re-measured.
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
 * How many brightness steps each terrain band is divided into.
 *
 * Terrain used to be four flat colours, which read as dull blocks with no sense
 * of elevation: the generator computed a continuous height and then threw all of
 * it away except which of four buckets it fell in. Shading recovers that detail —
 * deep water reads darker than shoreline, valley grass darker than upland grass.
 *
 * Eight steps is enough that a slope gradates smoothly at a 16px tile without
 * banding, while keeping the whole palette at 32 entries — well inside the one
 * byte per tile that MultiTileRepresentation stores.
 */
export declare const TerrainShadeCount = 8;
/**
 * Each terrain band: its glyph, the colour at each end of its noise range, and
 * the range itself.
 *
 * A band is not a single hue shaded up and down. Its high end leans toward the
 * terrain above it, so approaching a boundary reads as approaching it: grass
 * dries to earthy brown before it becomes hill, and hill greys to stone before
 * it becomes mountain, rather than staying vivid green or yellow right up to the
 * switch and then jumping. Water and mountain have no terrain above them worth
 * leaning into, so they are plain brightness ramps — depth for one, snowline for
 * the other.
 *
 * lowColour is the colour at lowerBound and highColour the colour at upperBound;
 * for grass that means lowColour is the *lighter* of the two, since grass darkens
 * as it climbs.
 *
 * The bounds are derived from TerrainThresholds rather than retyped so the two
 * cannot drift apart — the thresholds remain the single source of truth for
 * where terrain changes. Water has no lower threshold and mountain no upper one,
 * so they take the ends of the noise generator's normalized [0, 1] output.
 */
export declare const TerrainBands: readonly [{
    readonly glyph: string;
    readonly lowColour: Color;
    readonly highColour: Color;
    readonly lowerBound: 0;
    readonly upperBound: number;
}, {
    readonly glyph: string;
    readonly lowColour: Color;
    readonly highColour: Color;
    readonly lowerBound: number;
    readonly upperBound: number;
}, {
    readonly glyph: string;
    readonly lowColour: Color;
    readonly highColour: Color;
    readonly lowerBound: number;
    readonly upperBound: number;
}, {
    readonly glyph: string;
    readonly lowColour: Color;
    readonly highColour: Color;
    readonly lowerBound: number;
    readonly upperBound: 1;
}];
/**
 * The glyph and colour for every terrain shade, indexed by
 * kind * TerrainShadeCount + shade, where shade 0 sits at the band's lowerBound.
 *
 * Built once at module load and shared across every chunk rather than copied per
 * tile. A chunk stores one byte per tile indexing into this table, so all of
 * terrain costs 32 Representation objects in total instead of one per tile.
 */
export declare const TerrainPalette: readonly Representation[];
/** The TerrainKind a shaded palette index belongs to. */
export declare function TerrainKindOfPaletteIndex(paletteIndex: number): number;
//# sourceMappingURL=DisplayConstants.d.ts.map