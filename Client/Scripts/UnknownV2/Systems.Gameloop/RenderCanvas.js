import { BackgroundColor, TileSizePixels, UndefinedLayer } from "../Configuration/DisplayConstants.js";
import { GameWidth } from "../Configuration/GameConstants.js";
import { Layer } from "../Contracts/Components/Layer.js";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.js";
import { Position } from "../Contracts/Components/Position.js";
import { Representation } from "../Contracts/Components/Representation.js";
import { IsOutsideViewport } from "../Utilities/PositionUtilities.js";
export function RenderCanvas(registry, resources) {
    // 1. Performance Init: Flattened typed arrays avoid O(N²) layout loops
    const totalCells = GameWidth * GameWidth;
    const layerRegistry = new Int16Array(totalCells).fill(UndefinedLayer);
    // Track the cells that won the Z-layer battle to minimize execution overdraw
    const winnerIndices = [];
    const winningRepresentations = [];
    const camera = resources.Camera;
    // Clear screen for a fresh frame draw
    resources.canvasContext.fillStyle = BackgroundColor.ToHex();
    resources.canvasContext.fillRect(0, 0, resources.canvasElement.width, resources.canvasElement.height);
    /**
     * Claims a screen cell for a representation if nothing higher already holds
     * it. Shared by both queries below so the single-tile and multi-tile paths
     * resolve depth by exactly the same rule.
     */
    const TryPlaceRepresentation = (screenX, screenY, layerIndex, representation) => {
        // Strict Bounds protection checks
        if (IsOutsideViewport(screenX, screenY))
            return;
        const index = screenX * GameWidth + screenY;
        // Skip calculations if an entity on a higher layer index is already registered
        if (layerRegistry[index] > layerIndex)
            return;
        // Overwrite standard positioning map
        if (layerRegistry[index] === UndefinedLayer)
            winnerIndices.push(index);
        layerRegistry[index] = layerIndex;
        winningRepresentations[index] = representation;
    };
    // 2. Process components and resolve layering depth rules.
    //
    // Multi-tile entities go first: they are almost always the backdrop, so
    // resolving them before the entities standing on them means the common case
    // takes the cheap overwrite branch rather than the compare-and-reject one.
    registry.ForEachEntityWith([Position, Layer, MultiTileRepresentation], (_entity, position, layer, multiTile) => {
        const screenOriginX = position.x - camera.worldOriginX;
        const screenOriginY = position.y - camera.worldOriginY;
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
                if (representation === undefined)
                    continue;
                TryPlaceRepresentation(screenOriginX + localX, screenOriginY + localY, layer.layerIndex, representation);
            }
        }
    });
    registry.ForEachEntityWith([Position, Layer, Representation], (_entity, position, layer, representation) => {
        TryPlaceRepresentation(position.x - camera.worldOriginX, position.y - camera.worldOriginY, layer.layerIndex, representation);
    });
    // 3. Single-pass blitting pipeline to GPU
    const halfCell = TileSizePixels / 2;
    const length = winnerIndices.length;
    // Terrain draws thousands of tiles in a handful of colours, so tracking the
    // last style collapses one context write per tile into one per colour run.
    let lastFillStyle = "";
    for (let i = 0; i < length; i++) {
        const index = winnerIndices[i];
        const representation = winningRepresentations[index];
        if (!representation)
            continue;
        // Reconstitute 2D indices explicitly
        const x = Math.floor(index / GameWidth);
        const y = index % GameWidth;
        // Map abstract array indexing to concrete Canvas drawing positions
        const canvasX = x * TileSizePixels + halfCell; // Centered X alignment matching textAlign:"center"
        const canvasY = y * TileSizePixels + halfCell; // Centered Y alignment matching textBaseline:"middle"
        const { red, green, blue, opacity } = representation.color;
        const fillStyle = `rgba(${red},${green},${blue},${opacity})`;
        // Update drawing context metrics strictly when necessary
        if (fillStyle !== lastFillStyle) {
            resources.canvasContext.fillStyle = fillStyle;
            lastFillStyle = fillStyle;
        }
        resources.canvasContext.fillText(representation.model, canvasX, canvasY);
    }
}
//# sourceMappingURL=RenderCanvas.js.map