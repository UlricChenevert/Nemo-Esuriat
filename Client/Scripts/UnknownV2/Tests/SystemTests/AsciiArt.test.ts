import { describe, it, expect } from "vitest";
import { BuildAsciiArt, MaxPaletteSize } from "../../Utilities/AsciiArtUtilities.ts";

/**
 * Art is authored as four-character cells: three hex digits of colour, then the
 * glyph. Everything below builds art small enough to state exactly, because the
 * point is the packing rules rather than any particular picture.
 */
describe("reading packed art", () => {
  it("reads the grid's dimensions from the rows", () => {
    const art = BuildAsciiArt(["f00#0f0#00f#", "f00#0f0#00f#"])

    expect([art.width, art.height]).toEqual([3, 2])
  })

  it("expands three-digit colour across the full range", () => {
    const art = BuildAsciiArt(["fff#000#"])

    // Doubled, not shifted: 0xf has to come back as 255, or white greys out.
    expect(art.palette[0]).toMatchObject({ color: { red: 255, green: 255, blue: 255 } })
    expect(art.palette[1]).toMatchObject({ color: { red: 0, green: 0, blue: 0 } })
  })

  it("keeps the glyph of each cell", () => {
    const art = BuildAsciiArt(["f00#f00*f00="])

    expect(art.palette.map((entry) => entry.model)).toEqual(["#", "*", "="])
  })

  // Every entry is a background, not a character: this is a picture, and a glyph
  // covers only its advance width, so drawing it as text would leave gaps.
  it("marks every entry as filling its cell", () => {
    const art = BuildAsciiArt(["f00#0f0*00f="])

    expect(art.palette.every((entry) => entry.fillsCell)).toBe(true)
  })

  it("indexes cells in row-major order, as the renderer walks them", () => {
    const art = BuildAsciiArt(["f00#0f0#", "00f#ff0#"])

    // Four distinct colours, so index n is the nth cell read left-to-right.
    expect([...art.paletteIndices]).toEqual([0, 1, 2, 3])
  })
})

describe("the palette", () => {
  it("shares one entry between repeated cells", () => {
    const art = BuildAsciiArt(["f00#f00#f00#f00#"])

    expect(art.palette).toHaveLength(1)
    expect([...art.paletteIndices]).toEqual([0, 0, 0, 0])
  })

  it("treats the same colour with a different glyph as its own entry", () => {
    const art = BuildAsciiArt(["f00#f00*"])

    expect(art.palette).toHaveLength(2)
  })

  /**
   * Indices are a Uint8Array -- one byte per tile is the whole reason the compact
   * form exists -- so more than 256 distinct cells cannot each have an entry.
   * Overflow maps to the nearest colour already present rather than throwing, so
   * a photograph-dense picture degrades in shade instead of failing to load.
   */
  describe("when the art has more distinct cells than a byte can index", () => {
    /** 300 visibly distinct greys, which is more than the palette can hold. */
    const BuildOversizedArt = () => {
      const cells : string[] = []

      for (let index = 0; index < 300; index++) {
        // Cycles the hex digits so successive cells genuinely differ.
        const digits = "0123456789abcdef"
        const red = digits[index % 16]!
        const green = digits[Math.floor(index / 16) % 16]!
        const blue = digits[Math.floor(index / 256) % 16]!

        cells.push(`${red}${green}${blue}#`)
      }

      return BuildAsciiArt([cells.join("")])
    }

    it("stops at the byte ceiling", () => {
      expect(BuildOversizedArt().palette.length).toBeLessThanOrEqual(MaxPaletteSize)
    })

    it("still gives every cell an index a byte can hold", () => {
      const art = BuildOversizedArt()

      expect(art.paletteIndices).toHaveLength(300)
      expect([...art.paletteIndices].every((index) => index < art.palette.length)).toBe(true)
    })

    /**
     * A palette holding 255 shades on '#' plus a single distant white '*', then
     * one cell too many.
     */
    const BuildFullPaletteThenOverflow = (overflowCell : string) => {
      const cells : string[] = []

      for (let red = 0; red < 16; red++) {
        for (let green = 0; green < 16; green++) {
          // One short of 256, leaving room for the '*' below.
          if (red === 15 && green === 15) continue

          cells.push(`${red.toString(16)}${green.toString(16)}0#`)
        }
      }

      cells.push("fff*")
      cells.push(overflowCell)

      const art = BuildAsciiArt([cells.join("")])

      return art.palette[art.paletteIndices[art.paletteIndices.length - 1]!]!
    }

    // The glyph carries the drawing and the colour only tints it, so a
    // substitution changes the shade and keeps the shape -- even when a
    // different-glyph entry is far closer in colour. Here black-star's nearest
    // colour by far is the black '#', and it must still resolve to the white '*'.
    it("substitutes a colour rather than a glyph", () => {
      expect(BuildFullPaletteThenOverflow("000*").model).toBe("*")
    })

    // The honest limit: preferring the same glyph is only possible when some
    // entry already uses it. A glyph that never made it into a full palette has
    // to borrow another's shape.
    it("falls back to the nearest colour when no entry shares the glyph", () => {
      const substituted = BuildFullPaletteThenOverflow("000:")

      expect(substituted.model).not.toBe(":")
      expect(substituted.color).toMatchObject({ red: 0, green: 0, blue: 0 })
    })
  })
})

describe("malformed art", () => {
  it("rejects a row that is not a whole number of cells", () => {
    expect(()=>BuildAsciiArt(["f00#0f"])).toThrow()
  })

  it("rejects rows of differing widths", () => {
    expect(()=>BuildAsciiArt(["f00#0f0#", "f00#"])).toThrow()
  })

  it("accepts empty art without throwing", () => {
    expect(()=>BuildAsciiArt([])).not.toThrow()
  })
})
