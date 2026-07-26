import { TileSizePixels } from "../../Configuration/DisplayConstants.js";
import { Position } from "../Components/Position.js";
export class GameClickEvent {
    type = "ClickEvent";
    position;
    constructor(pointerEvent, canvasElement) {
        const canvasPositioningRectangle = canvasElement.getBoundingClientRect();
        // The click arrives in CSS pixels relative to the element; scale into the
        // canvas backing-store size (in case CSS stretches the canvas), then divide
        // by the tile size to land on a grid cell. Entities carry grid coordinates,
        // so pixel coordinates would never match a tile.
        const scaleX = canvasElement.width / canvasPositioningRectangle.width;
        const scaleY = canvasElement.height / canvasPositioningRectangle.height;
        const pixelX = (pointerEvent.clientX - canvasPositioningRectangle.left) * scaleX;
        const pixelY = (pointerEvent.clientY - canvasPositioningRectangle.top) * scaleY;
        this.position = new Position(Math.floor(pixelX / TileSizePixels), Math.floor(pixelY / TileSizePixels));
    }
}
//# sourceMappingURL=GameClickEvent.js.map