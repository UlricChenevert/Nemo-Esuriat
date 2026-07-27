import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import { WorldTileOfScreenTile } from "../../Utilities/CameraUtilities.ts";
import type { Position } from "../Components/Position.ts";
import type { Camera } from "../SystemResources.ts";

export class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";

    /**
     * WORLD space, not screen space.
     *
     * Every consumer compares this against entity positions or writes it into a
     * TargetLocation, all of which are world coordinates. Leaving it in screen
     * space -- which it was until the camera could pan -- meant clicking the same
     * visible tile twice commanded two different destinations.
     */
    position : Position

    constructor(pointerEvent : MouseEvent, canvasElement : HTMLCanvasElement, camera : Camera) {
        const canvasPositioningRectangle = canvasElement.getBoundingClientRect()

        // The click arrives in CSS pixels relative to the element; scale into the
        // canvas backing-store size (in case CSS stretches the canvas), then divide
        // by the tile size to land on a grid cell. Entities carry grid coordinates,
        // so pixel coordinates would never match a tile.
        const scaleX = canvasElement.width / canvasPositioningRectangle.width
        const scaleY = canvasElement.height / canvasPositioningRectangle.height

        const pixelX = (pointerEvent.clientX - canvasPositioningRectangle.left) * scaleX
        const pixelY = (pointerEvent.clientY - canvasPositioningRectangle.top) * scaleY

        this.position = WorldTileOfScreenTile(camera, Math.floor(pixelX / TileSizePixels), Math.floor(pixelY / TileSizePixels))
    }

}