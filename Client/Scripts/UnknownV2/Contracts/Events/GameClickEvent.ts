import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import { Position } from "../Components/Position.ts";

export class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";

    position : Position

    constructor(pointerEvent : MouseEvent, canvasElement : HTMLCanvasElement) {
        const canvasPositioningRectangle = canvasElement.getBoundingClientRect()

        // The click arrives in CSS pixels relative to the element; scale into the
        // canvas backing-store size (in case CSS stretches the canvas), then divide
        // by the tile size to land on a grid cell. Entities carry grid coordinates,
        // so pixel coordinates would never match a tile.
        const scaleX = canvasElement.width / canvasPositioningRectangle.width
        const scaleY = canvasElement.height / canvasPositioningRectangle.height

        const pixelX = (pointerEvent.clientX - canvasPositioningRectangle.left) * scaleX
        const pixelY = (pointerEvent.clientY - canvasPositioningRectangle.top) * scaleY

        this.position = new Position(Math.floor(pixelX / TileSizePixels), Math.floor(pixelY / TileSizePixels))
    }

}