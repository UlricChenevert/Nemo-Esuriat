import { TileSizePixels } from "../../Configuration/DisplayConstants.js";
import { WorldTileOfScreenTile } from "../../Utilities/CameraUtilities.js";
export class GameClickEvent {
    type = "ClickEvent";
    /**
     * WORLD space, not screen space.
     *
     * Every consumer compares this against entity positions or writes it into a
     * TargetLocation, all of which are world coordinates. Leaving it in screen
     * space -- which it was until the camera could pan -- meant clicking the same
     * visible tile twice commanded two different destinations.
     */
    position;
    constructor(pointerEvent, canvasElement, camera) {
        const canvasPositioningRectangle = canvasElement.getBoundingClientRect();
        // The click arrives in CSS pixels relative to the element; scale into the
        // canvas backing-store size (in case CSS stretches the canvas), then divide
        // by the tile size to land on a grid cell. Entities carry grid coordinates,
        // so pixel coordinates would never match a tile.
        const scaleX = canvasElement.width / canvasPositioningRectangle.width;
        const scaleY = canvasElement.height / canvasPositioningRectangle.height;
        const pixelX = (pointerEvent.clientX - canvasPositioningRectangle.left) * scaleX;
        const pixelY = (pointerEvent.clientY - canvasPositioningRectangle.top) * scaleY;
        this.position = WorldTileOfScreenTile(camera, Math.floor(pixelX / TileSizePixels), Math.floor(pixelY / TileSizePixels));
    }
}
//# sourceMappingURL=GameClickEvent.js.map