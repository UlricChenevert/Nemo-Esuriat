import { BackgroundColor, TileSizePixels, UndefinedLayer } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { ScreenPosition } from "../Contracts/Components/ScreenPosition.ts";
import type { RenderingResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { IsOutsideViewport } from "../Utilities/PositionUtilities.ts";
import { CameraTileOrigin, FindCameraPosition } from "../Utilities/CameraUtilities.ts";

export function RenderCanvas(registry: IRegistry, resources: RenderingResources) {
    // 1. Performance Init: Flattened typed arrays avoid O(N²) layout loops
    const totalCells = GameWidth * GameWidth;

    // Two channels per cell rather than one winner, because a cell legitimately
    // holds two things at once: an opaque background and a character on top of
    // it. With a single winner the higher layer REPLACED the lower one, so a
    // menu's text beat the panel behind it and the panel was never painted --
    // leaving every letter sitting in a black hole punched through the menu,
    // showing the frame's opening clear.
    //
    // Only two are needed, not an arbitrary stack: fills are opaque, so the
    // topmost one is all that can ever be seen, and one glyph per cell is all a
    // character grid can express.
    const fillLayers = new Int16Array(totalCells).fill(UndefinedLayer);
    const fillRepresentations: Representation[] = [];
    const glyphLayers = new Int16Array(totalCells).fill(UndefinedLayer);
    const glyphRepresentations: Representation[] = [];

    // Cells holding anything in either channel, so the blit walks what was drawn
    // to rather than the whole grid.
    const touchedIndices: number[] = [];

    // Clear screen for a fresh frame draw
    resources.canvasContext.fillStyle = BackgroundColor.ToHex();
    resources.canvasContext.fillRect(0, 0, resources.canvasElement.width, resources.canvasElement.height);

    /**
     * Files a representation into its channel for one screen cell, if nothing
     * higher already holds that channel. Shared by all the queries below so the
     * single-tile, multi-tile, and screen-anchored paths resolve depth by exactly
     * the same rule.
     */
    const TryPlaceRepresentation = (screenX: number, screenY: number, layerIndex: number, representation: Representation) => {
        // Strict Bounds protection checks
        if (IsOutsideViewport(screenX, screenY)) return;

        // Floored for the same reason EnqueueCollision floors: screen coordinates
        // are continuous once an entity is mid-step, and a fractional index into
        // the layer arrays silently reads undefined and drops the write, so a
        // moving entity would disappear between tiles rather than draw.
        const index = Math.floor(screenX) * GameWidth + Math.floor(screenY);

        // Which channel this belongs to. fillsCell is already the "background,
        // not a character" distinction -- see Representation.
        const layers = representation.fillsCell ? fillLayers : glyphLayers;

        // Skip calculations if something higher already holds this channel
        if (layers[index]! > layerIndex) return;

        // Recorded before either channel is written, so a cell that takes a fill
        // and then a glyph is listed once rather than twice.
        if (fillLayers[index] === UndefinedLayer && glyphLayers[index] === UndefinedLayer) touchedIndices.push(index);

        layers[index] = layerIndex;

        if (representation.fillsCell) fillRepresentations[index] = representation;
        else glyphRepresentations[index] = representation;
    };

    /**
     * Claims the block of cells a multi-tile entity covers, given where its
     * top-left corner lands on screen.
     *
     * Shared by the world and screen-anchored paths: the only difference between
     * them is whether the camera origin was subtracted to get that corner, and
     * duplicating the clipping arithmetic to express that would be two copies of
     * the fiddliest loop in the renderer.
     */
    const PlaceMultiTile = (screenOriginX: number, screenOriginY: number, layerIndex: number, multiTile: MultiTileRepresentation) => {
        // Clip to the viewport before iterating. Without this, every loaded
        // chunk costs width*height iterations whether or not any of it is on
        // screen — nine chunks would be 22,500 iterations to draw at most 10,000
        // tiles, and an entirely off-screen chunk would cost as much as a
        // visible one.
        const startLocalX = Math.max(0, -screenOriginX);
        const endLocalX = Math.min(multiTile.width, GameWidth - screenOriginX);
        const startLocalY = Math.max(0, -screenOriginY);
        const endLocalY = Math.min(multiTile.height, GameWidth - screenOriginY);

        for (let localY = startLocalY; localY < endLocalY; localY++) {
            const rowOffset = localY * multiTile.width;

            for (let localX = startLocalX; localX < endLocalX; localX++) {
                const representation = multiTile.palette[multiTile.paletteIndices[rowOffset + localX] ?? 0];
                if (representation === undefined) continue;

                TryPlaceRepresentation(screenOriginX + localX, screenOriginY + localY, layerIndex, representation);
            }
        }
    };

    // 2. Process components and resolve layering depth rules.
    //
    // The camera is an entity, so the renderer looks it up rather than being
    // handed one. With none there is no viewpoint to draw the world from -- but
    // the screen-anchored pass below does not need one, so this skips the world
    // rather than abandoning the frame: a menu shown before a camera exists
    // still draws, over the cleared background.
    const cameraPosition = FindCameraPosition(registry);

    if (cameraPosition !== undefined) {
        // Floored once, here, and used for every world screen coordinate below. The
        // camera position is fractional while panning; subtracting it raw made terrain
        // screen origins fractional too, which turned the paletteIndices lookup below
        // into a fractional index into a Uint8Array -- undefined, swallowed by the
        // ?? 0, so an entire chunk drew as palette[0] and read as unloaded ground.
        const { originX: cameraOriginX, originY: cameraOriginY } = CameraTileOrigin(cameraPosition);

        // Multi-tile entities go first: they are almost always the backdrop, so
        // resolving them before the entities standing on them means the common case
        // takes the cheap overwrite branch rather than the compare-and-reject one.
        registry.ForEachEntityWith([Position, Layer, MultiTileRepresentation], (_entity, position, layer, multiTile) => {
            PlaceMultiTile(position.x - cameraOriginX, position.y - cameraOriginY, layer.layerIndex, multiTile);
        });

        registry.ForEachEntityWith([Position, Layer, Representation], (_entity, position, layer, representation) => {
            TryPlaceRepresentation(position.x - cameraOriginX, position.y - cameraOriginY, layer.layerIndex, representation);
        });
    }

    // Screen-anchored entities -- menus and anything else nailed to the display
    // rather than to the world. The camera origin is deliberately not subtracted:
    // that subtraction IS what "in the world" means, and a pause screen that
    // slid away when the camera panned would be a bug. Depth still goes through
    // the same Z-buffer, so a menu covers the world by virtue of MenuLayer being
    // the highest layer, not by drawing last.
    // Blocks first, matching the world path above and for the same reason: a
    // menu's panel is the backdrop its text is resolved against.
    registry.ForEachEntityWith([ScreenPosition, Layer, MultiTileRepresentation], (_entity, screenPosition, layer, multiTile) => {
        PlaceMultiTile(screenPosition.x, screenPosition.y, layer.layerIndex, multiTile);
    });

    registry.ForEachEntityWith([ScreenPosition, Layer, Representation], (_entity, screenPosition, layer, representation) => {
        TryPlaceRepresentation(screenPosition.x, screenPosition.y, layer.layerIndex, representation);
    });

    // 3. Single-pass blitting pipeline to GPU
    const halfCell = TileSizePixels / 2;
    const length = touchedIndices.length;

    // Terrain draws thousands of tiles from a 32-entry shaded palette, and the
    // noise field is spatially smooth, so neighbouring tiles usually share a
    // shade. Tracking the last style collapses one context write per tile into
    // one per colour run. Menu cells alternate between their fill's colour and
    // their text's and so defeat it, but there are only a few hundred of those
    // against ten thousand tiles of terrain.
    let lastFillStyle = "";

    const UseFillStyle = (fillStyle: string) => {
        if (fillStyle === lastFillStyle) return;

        resources.canvasContext.fillStyle = fillStyle;
        lastFillStyle = fillStyle;
    };

    for (let i = 0; i < length; i++) {
        const index = touchedIndices[i]!;

        // Reconstitute 2D indices explicitly
        const x = Math.floor(index / GameWidth);
        const y = index % GameWidth;

        const fill = fillRepresentations[index];
        const glyph = glyphRepresentations[index];

        // Background first. Painted edge to edge rather than drawn as a
        // character, because a glyph only ever covers its advance width -- about
        // six tenths of a cell in a monospace font -- so a panel built from
        // characters comes out striped. Anchored at the cell corner, since
        // fillRect measures from the corner and fillText does not.
        if (fill !== undefined) {
            UseFillStyle(fill.FillStyle());
            resources.canvasContext.fillRect(x * TileSizePixels, y * TileSizePixels, TileSizePixels, TileSizePixels);
        }

        if (glyph === undefined) continue;

        // A fill is opaque, so a glyph beneath one is behind it and must not
        // draw -- that is what stops terrain showing through a menu panel. With
        // no fill the layer reads UndefinedLayer (-1) and any real layer beats
        // it, so a lone glyph still draws.
        if (glyphLayers[index]! < fillLayers[index]!) continue;

        UseFillStyle(glyph.FillStyle());

        // Map abstract array indexing to concrete Canvas drawing positions
        const canvasX = x * TileSizePixels + halfCell; // Centered X alignment matching textAlign:"center"
        const canvasY = y * TileSizePixels + halfCell; // Centered Y alignment matching textBaseline:"middle"

        resources.canvasContext.fillText(glyph.model, canvasX, canvasY);
    }
}
