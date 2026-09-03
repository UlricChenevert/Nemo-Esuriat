import { Color } from "../Contracts/Components/Color.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
// This import closes a cycle: ColorUtilites reads ColorTranslation from here.
// It is safe because ColorUtilites exports only hoisted function declarations,
// so whichever module evaluates first, ScaleColorBrightness is already bound by
// the time the palette below calls it.
import { MixColors, ScaleColorBrightness } from "../Utilities/ColorUtilites.ts";

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
/**
 * A menu, above everything else: its panel, and its text on the panel.
 *
 * A pause screen that anything could draw over would be a pause screen the
 * player could lose track of, so these are the top of the stack by definition.
 *
 * Two layers rather than one because both occupy the same cells and the renderer
 * now draws both -- the panel as a background, the text over it. On one layer
 * they would be two fills competing for the same channel and only one would
 * survive.
 */
/**
 * A full-screen picture behind a menu -- the title screen's artwork.
 *
 * Below the panel, so the panel and its text still read against it; above
 * everything in the world, so the art replaces the view rather than sharing it.
 */
export const MenuArtLayer = 7
export const MenuBackdropLayer = 8
export const MenuLayer = 9

/** The row the cursor is on. */
export const MenuSelectedColor = new Color(255, 210, 90)
/** Rows that are listing rather than choices -- the keybindings screen. */
export const MenuMutedColor = new Color(150, 150, 160)

/**
 * Columns per stripe in a menu's panel.
 *
 * 1 alternates every column. Widen it for a broader, calmer pattern.
 */
export const MenuPanelStripeWidth = 1

/** The two shades a menu's panel alternates between. Defined with the palette
 *  below, which cannot be built before CharacterRepresentation exists. */
export const MenuPanelDarkColor = new Color(0, 0, 0)
export const MenuPanelLightColor = new Color(28, 28, 34)

/** The glyph a legal destination is marked with, in the moving side's colour. */
export const MoveHintGlyph = "."

/**
 * How many backing-store pixels one tile is drawn into.
 *
 * Resolution, not apparent size: the canvas is scaled to the window by CSS, so
 * this decides how crisp a tile is rather than how big it looks. GameWidth is
 * what controls the latter.
 */
export const TileSizePixels = 24;

/**
 * Glyph height as a fraction of the tile.
 *
 * Just under 1 so a descender has somewhere to go without colliding with the row
 * beneath. This was the ratio the fixed "14px" carried at a 16px tile; naming it
 * is what stops the two drifting apart the next time either moves.
 */
export const FontScalePerTile = 0.875

/**
 * The canvas font, sized from the tile.
 *
 * Derived rather than written out, because a font that does not track
 * TileSizePixels is the whole bug: raising the tile without raising this leaves
 * the same small glyphs floating in bigger cells, which looks exactly like the
 * change having done nothing.
 */
export const FontStyle = `${Math.round(TileSizePixels * FontScalePerTile)}px monospace`

/**
 * Glyphs drawn on the canvas.
 *
 * These must be real characters, not HTML entity text. The canvas draws through
 * fillText, which has no notion of HTML escaping and would render "&#x1338;"
 * literally, as nine characters. Unicode escapes are used where the intended
 * character is not obvious from the glyph alone.
 */
export const CharacterRepresentation = {
    Blank : " ",
    Character : "ጸ",
    NPC : "ጰ",
    Water : "_",
    Animal : "Ћ",
    Path : ".",
    PineTree : "↟",
    Hill : "^",
    Mountain : "A",
    Grass : ",",
    Shrine : "ቾ",
    Farmland : "▃",
    SmallHouse : "⇑",
    Hut : "π",
    LargeHouse : "∏",
    LoadingBar : "o",
    Panel : "█",
    /** A fresh body, with meat still on it. */
    DeadAnimal : "ፌ",
    /** The same body once it has been eaten down to nothing. */
    PickedCarcass : "ፆ",
    /** One filled cell of a needs bar. A bar is a bracketed run of these. */
    BarFilled : "0"
    // Ħ
    // ፚ sleeping animals
    // ጬ elephant
    // ኗ Animal eatting
}

/**
 * A menu's panel: alternating columns of two shades, behind its text.
 *
 * Both entries fill their cell, so the text drawn over them composites onto the
 * pattern rather than replacing it.
 *
 * One shared palette, never mutated, as MultiTileRepresentation requires --
 * every menu's panel points at this same array rather than building its own.
 */
export const MenuPanelPalette : readonly Representation[] = [
    new Representation(CharacterRepresentation.Panel, MenuPanelDarkColor, true),
    new Representation(CharacterRepresentation.Panel, MenuPanelLightColor, true)
]

export const GameColors = {
    Background : new Color(0, 0, 0),
    Player: new Color(255, 0, 0),
    Villages: new Color(0, 255, 0),
    NPC: new Color(0, 0, 255),
    Animal: new Color(0, 0, 255),
    Water: new Color(48, 88, 160),
    Grass: new Color(56, 120, 56),
    Hill: new Color(120, 116, 72),
    Mountain: new Color(148, 148, 156),
    // Bare earth at the foot of the hills. Its own colour rather than something
    // mixed from the four above, because brown needs red to lead green and none
    // of the terrain hues are red-dominant — every blend of them lands on olive.
    Earth: new Color(104, 74, 44),
    // Blood red, and the only red in the world palette besides the player's own.
    // A corpse has to be findable again after walking away from it, which a
    // desaturated brown on brown ground would not be.
    Carcass: new Color(200, 30, 30)
}

/****************************************/
//
//     The needs readout
//
/****************************************/

/**
 * How many cells one need's bar is wide.
 *
 * Also the resolution of the whole readout: a bar redraws when a need crosses a
 * twentieth of its range, which at the water drain rate is about every four
 * seconds. Widening it makes the bars smoother and the rebuilds more frequent.
 */
export const HudBarCells = 20

/** Rows of screen the readout occupies, along the bottom edge. */
export const HudHeightRows = 4

/** Screen column the labels start at, inside the panel. */
export const HudTextColumn = 2

/****************************************/
//
//     Terrain
//
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
export const TerrainThresholds = {
    Mountain : 0.66,
    Hill : 0.53,
    Grassland : 0.36,
    /**
     * Below this, water is too deep to stand in.
     *
     * A gameplay boundary INSIDE the water band rather than a fifth terrain: it
     * draws no differently and has no glyph of its own, because the band's
     * existing depth shading already makes it visible -- water is drawn dark at
     * the bottom of its range and light at the top, so the deep half looks deep
     * without needing to be a separate kind.
     *
     * Water spans [0, Grassland] and is roughly 15% of the world, so this puts
     * about half of that out of bounds and leaves a wadeable shore wide enough
     * for an animal to actually reach and stand in.
     *
     * Like its neighbours above, this is a percentile of the real noise field and
     * not a round number. Change the noise configuration in WorldConstants and it
     * must be re-measured.
     */
    Ocean : 0.22
}

/**
 * Indices into TerrainPalette. A plain object rather than an enum because
 * isolatedModules forbids const enums, and a regular enum would emit a runtime
 * object anyway.
 */
export const TerrainKind = {
    Water : 0,
    Grass : 1,
    Hill : 2,
    Mountain : 3
} as const

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
export const TerrainShadeCount = 8

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
export const TerrainBands = [
    {
        glyph : CharacterRepresentation.Water,
        lowColour : ScaleColorBrightness(GameColors.Water, 0.62),
        highColour : ScaleColorBrightness(GameColors.Water, 1.32),
        lowerBound : 0,
        upperBound : TerrainThresholds.Grassland
    },
    {
        glyph : CharacterRepresentation.Grass,
        lowColour : ScaleColorBrightness(GameColors.Grass, 1.25),
        // Most of the way to hill, then darkened: a shaded, earthy olive rather
        // than the bright green that used to run right up to the boundary.
        highColour : ScaleColorBrightness(MixColors(GameColors.Grass, GameColors.Hill, 0.8), 0.6),
        lowerBound : TerrainThresholds.Grassland,
        upperBound : TerrainThresholds.Hill
    },
    {
        glyph : CharacterRepresentation.Hill,
        // Bare brown earth, not the tan the base hill colour gives. The foot of a
        // hill sat brighter and yellower than the grass it rose out of, which read
        // as a lighting change rather than a change of ground. Brown makes the
        // switch obvious while staying in the same dark, earthy family as the
        // olive grass directly below it.
        lowColour : GameColors.Earth,
        // Nearly all the way to mountain, which drains the yellow out of the tan
        // and leaves bare grey stone just below the peaks.
        highColour : ScaleColorBrightness(MixColors(GameColors.Hill, GameColors.Mountain, 0.85), 0.85),
        lowerBound : TerrainThresholds.Hill,
        upperBound : TerrainThresholds.Mountain
    },
    {
        glyph : CharacterRepresentation.Mountain,
        lowColour : ScaleColorBrightness(GameColors.Mountain, 0.72),
        highColour : ScaleColorBrightness(GameColors.Mountain, 1.38),
        lowerBound : TerrainThresholds.Mountain,
        upperBound : 1
    }
] as const

/**
 * The glyph and colour for every terrain shade, indexed by
 * kind * TerrainShadeCount + shade, where shade 0 sits at the band's lowerBound.
 *
 * Built once at module load and shared across every chunk rather than copied per
 * tile. A chunk stores one byte per tile indexing into this table, so all of
 * terrain costs 32 Representation objects in total instead of one per tile.
 */
export const TerrainPalette : readonly Representation[] = TerrainBands.flatMap((band) =>
    Array.from({ length : TerrainShadeCount }, (_unused, shade) => {
        // Inclusive of both ends, so the first shade is exactly lowColour and the
        // last exactly highColour.
        const position = shade / (TerrainShadeCount - 1)

        return new Representation(band.glyph, MixColors(band.lowColour, band.highColour, position))
    })
)

/** The TerrainKind a shaded palette index belongs to. */
export function TerrainKindOfPaletteIndex (paletteIndex : number) : number {
    return Math.floor(paletteIndex / TerrainShadeCount)
}

/**
 * What each TerrainKind is called, indexed by the kind itself.
 *
 * So that "what ground am I standing on" can be answered in words rather than as
 * the integer 2. Kept beside TerrainKind so a new terrain cannot be added
 * without a name showing up as undefined here.
 */
export const TerrainKindNames : readonly string[] = ["Water", "Grass", "Hill", "Mountain"]