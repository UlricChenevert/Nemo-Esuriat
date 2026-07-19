import { BackgroundColor, TileSizePixels, UndefinedLayer } from "../Configuration/DisplayConstants";
import { FontStyle, GameWidth } from "../Configuration/GameConstants";
import { Color } from "../Contracts/Color";
import { Layer } from "../Contracts/Layer";
import { Position } from "../Contracts/Position";
import { Representation } from "../Contracts/Representation";
import type { RenderingResources } from "../Contracts/SystemResources";
import type { IRegistry } from "../Interfaces/IRegistry";
import { isNotWithinGameBorder } from "../Utilities/PositionUtilities";

export function RenderCanvas(registry: IRegistry, resources: RenderingResources) {
    // 1. Performance Init: Flattened typed arrays avoid O(N²) layout loops
    const totalCells = GameWidth * GameWidth;
    const layerRegistry = new Int16Array(totalCells).fill(UndefinedLayer);
    
    // Track entity references that won the Z-layer battle to minimize execution overdraw
    const winnerIndices: number[] = [];
    const entityList: Array<{ representation: typeof Representation.prototype }> = [];

    // Clear screen for a fresh frame draw
    resources.canvasContext.fillStyle = BackgroundColor.ToHex();
    resources.canvasContext.fillRect(0, 0, resources.canvasElement.width, resources.canvasElement.height);

    // 2. Process components and resolve layering depth rules
    registry.ForEachEntityWith([Position, Layer, Representation], (entity, position, layer, representation) => {
        const x = position.x;
        const y = position.y;

        // Strict Bounds protection checks
        if (isNotWithinGameBorder(position)) return

        const index = x * GameWidth + y;

        // Skip calculations if an entity on a higher layer index is already registered
        if (layerRegistry[index]! > layer.layerIndex) {
            return;
        }

        // Overwrite standard positioning map
        if (layerRegistry[index] === UndefinedLayer) {
            winnerIndices.push(index);
        }
        
        layerRegistry[index] = layer.layerIndex;
        entityList[index] = { representation };
    });

    // 3. Single-pass blitting pipeline to GPU
    const halfCell = TileSizePixels / 2;
    const length = winnerIndices.length;

    for (let i = 0; i < length; i++) {
        const index = winnerIndices[i]!;
        const data = entityList[index];
        if (!data) continue;

        // Reconstitute 2D indices explicitly
        const x = Math.floor(index / GameWidth);
        const y = index % GameWidth;

        // Map abstract array indexing to concrete Canvas drawing positions
        const canvasX = x * TileSizePixels + halfCell; // Centered X alignment matching our textAlign
        const canvasY = y * TileSizePixels;

        const rep = data.representation;
        const { red, green, blue, opacity } = rep.color;

        // Update drawing context metrics strictly when necessary
        resources.canvasContext.fillStyle = `rgba(${red},${green},${blue},${opacity})`;
        resources.canvasContext.fillText(rep.model, canvasX, canvasY);
    }
}