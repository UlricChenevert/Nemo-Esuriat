import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import type { RenderingResources } from "../../Contracts/SystemResources.ts";

export interface DrawnGlyph {
    model : string
    canvasX : number
    canvasY : number
    fillStyle : string
}

/** A solid tile, or the full-canvas clear at the top of a frame. */
export interface DrawnRect {
    canvasX : number
    canvasY : number
    width : number
    height : number
    fillStyle : string
}

/** The game's native backing store, derived so it cannot drift from the constants. */
const NativeResolution = GameWidth * TileSizePixels

/**
 * Rendering resources backed by a recorder instead of a real canvas.
 *
 * Built as a plain object rather than through the RenderingResources
 * constructor, which calls getContext("2d") and would drag a DOM implementation
 * into tests that only need to know which glyphs were drawn where.
 */
export function CreateRecordingRenderingResources(width = NativeResolution, height = NativeResolution) {
    const drawnGlyphs : DrawnGlyph[] = []
    const drawnRects : DrawnRect[] = []
    let currentFillStyle = ""
    let fillStyleWriteCount = 0

    const canvasContext = {
        set fillStyle(value : string) { currentFillStyle = value; fillStyleWriteCount++ },
        get fillStyle() { return currentFillStyle },
        fillRect: (canvasX : number, canvasY : number, rectWidth : number, rectHeight : number) => {
            drawnRects.push({ canvasX, canvasY, width: rectWidth, height: rectHeight, fillStyle: currentFillStyle })
        },
        fillText: (model : string, canvasX : number, canvasY : number) => {
            drawnGlyphs.push({ model, canvasX, canvasY, fillStyle: currentFillStyle })
        },
    }

    // No camera here: it is an entity now, so RenderCanvas finds it in the
    // registry. Tests that care where the view points add one with
    // AddCameraViewing.
    const resources = {
        canvasElement: { width, height },
        canvasContext,
    } as unknown as RenderingResources

    return {
        resources,
        drawnGlyphs,
        /**
         * Solid fills, in draw order. The first is the frame's background clear,
         * which spans the whole canvas; the rest are cell-filling tiles.
         */
        drawnRects,
        /** Counts writes to fillStyle, so the colour-run memoisation can be asserted. */
        GetFillStyleWriteCount: () => fillStyleWriteCount,
    }
}
