import { Camera, type RenderingResources } from "../../Contracts/SystemResources.ts";

export interface DrawnGlyph {
    model : string
    canvasX : number
    canvasY : number
    fillStyle : string
}

/**
 * Rendering resources backed by a recorder instead of a real canvas.
 *
 * Built as a plain object rather than through the RenderingResources
 * constructor, which calls getContext("2d") and would drag a DOM implementation
 * into tests that only need to know which glyphs were drawn where.
 */
export function CreateRecordingRenderingResources(width = 1600, height = 1600) {
    const drawnGlyphs : DrawnGlyph[] = []
    let currentFillStyle = ""
    let fillStyleWriteCount = 0

    const canvasContext = {
        set fillStyle(value : string) { currentFillStyle = value; fillStyleWriteCount++ },
        get fillStyle() { return currentFillStyle },
        fillRect: () => {},
        fillText: (model : string, canvasX : number, canvasY : number) => {
            drawnGlyphs.push({ model, canvasX, canvasY, fillStyle: currentFillStyle })
        },
    }

    const resources = {
        canvasElement: { width, height },
        canvasContext,
        Camera: new Camera(),
    } as unknown as RenderingResources

    return {
        resources,
        drawnGlyphs,
        /** Counts writes to fillStyle, so the colour-run memoisation can be asserted. */
        GetFillStyleWriteCount: () => fillStyleWriteCount,
    }
}
