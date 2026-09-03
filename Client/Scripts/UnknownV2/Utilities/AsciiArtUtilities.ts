import { Color } from "../Contracts/Components/Color.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Representation } from "../Contracts/Components/Representation.ts";

/**
 * How many entries a MultiTileRepresentation palette may hold.
 *
 * Its indices are a Uint8Array -- one byte per tile is the whole reason the
 * compact form exists -- so 256 is a hard ceiling, not a tuning knob.
 */
export const MaxPaletteSize = 256

/**
 * One cell of ASCII art: four characters, being three hex digits of colour and
 * then the glyph.
 *
 * Twelve-bit colour rather than twenty-four. A backdrop drawn in a handful of
 * glyph shapes cannot show the difference, it halves the size of the art in
 * source, and it collapses thousands of near-identical shades into a few hundred
 * before the palette fitting below ever runs.
 */
export const CellLength = 4

/** Expands a three-digit hex colour, as #59a -> rgb(85, 153, 170). */
function ParseShortHex (shortHex : string) : Color {
    // Each digit is the high nibble of its channel, so it is doubled rather than
    // shifted -- 0xf must come back as 255 and not 240, or white greys out.
    const expand = (digit : string) => {
        const value = Number.parseInt(digit, 16)

        return value * 16 + value
    }

    return new Color(expand(shortHex[0]!), expand(shortHex[1]!), expand(shortHex[2]!))
}

/** How far apart two colours are, squared. Squared because only ordering matters. */
function ColorDistanceSquared (first : Color, second : Color) : number {
    const redDelta = first.red - second.red
    const greenDelta = first.green - second.green
    const blueDelta = first.blue - second.blue

    return redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta
}

/**
 * Turns rows of packed cells into a MultiTileRepresentation.
 *
 * The palette is built from the distinct glyph-and-colour pairs the art actually
 * uses, which is normally far fewer than the cell count. When a picture has more
 * than a byte can index, the overflow is mapped to the nearest colour already in
 * the palette -- preferring an entry with the same glyph, since the glyph carries
 * the drawing and the colour only tints it. That degrades gracefully instead of
 * throwing, and it means art can be dropped in without first being counted.
 *
 * Every entry fills its cell: this is a picture, not text, and a glyph covers
 * only its advance width, so drawing it as characters would leave the background
 * showing through in vertical gaps.
 */
export function BuildAsciiArt (rows : readonly string[]) : MultiTileRepresentation {
    const height = rows.length
    const width = (rows[0]?.length ?? 0) / CellLength

    if (!Number.isInteger(width)) throw new Error(`ASCII art rows must be a whole number of ${CellLength}-character cells.`)

    for (const row of rows) {
        if (row.length !== width * CellLength) throw new Error(`ASCII art rows must all be ${width * CellLength} characters; found one of ${row.length}.`)
    }

    const palette : Representation[] = []
    const indexByKey = new Map<string, number>()
    const indices = new Uint8Array(width * height)

    for (let y = 0; y < height; y++) {
        const row = rows[y]!

        for (let x = 0; x < width; x++) {
            const cell = row.slice(x * CellLength, (x + 1) * CellLength)
            const existing = indexByKey.get(cell)

            if (existing !== undefined) {
                indices[y * width + x] = existing
                continue
            }

            const color = ParseShortHex(cell)
            const glyph = cell[3]!

            if (palette.length < MaxPaletteSize) {
                indexByKey.set(cell, palette.length)
                indices[y * width + x] = palette.length
                palette.push(new Representation(glyph, color, true))
                continue
            }

            const nearest = FindNearestEntry(palette, glyph, color)

            indexByKey.set(cell, nearest)
            indices[y * width + x] = nearest
        }
    }

    return new MultiTileRepresentation(width, height, indices, palette)
}

/**
 * The palette entry closest to a colour, preferring ones drawn with the same
 * glyph so a substitution changes the shade rather than the shape.
 */
function FindNearestEntry (palette : readonly Representation[], glyph : string, color : Color) : number {
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    let bestMatchesGlyph = false

    for (let index = 0; index < palette.length; index++) {
        const entry = palette[index]!
        const matchesGlyph = entry.model === glyph

        // A same-glyph entry always beats a different-glyph one, however much
        // closer the other colour is.
        if (bestMatchesGlyph && !matchesGlyph) continue

        const distance = ColorDistanceSquared(entry.color, color)

        if (matchesGlyph && !bestMatchesGlyph) {
            bestIndex = index
            bestDistance = distance
            bestMatchesGlyph = true
            continue
        }

        if (distance >= bestDistance) continue

        bestIndex = index
        bestDistance = distance
        bestMatchesGlyph = matchesGlyph
    }

    return bestIndex
}
