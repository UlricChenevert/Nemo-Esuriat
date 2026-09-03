import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";
import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";

export class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";

    /**
     * SCREEN space: which tile of the viewport was clicked, with (0, 0) at the
     * top-left corner regardless of where the camera is pointing.
     *
     * Consumers all want world coordinates -- they compare against entity
     * positions or write into a TargetLocation -- but the conversion needs the
     * camera, and the camera is an entity now, so a DOM listener has nothing to
     * convert with. HandleInputEvents does it instead, through
     * WorldTileOfScreenTile.
     *
     * That is also more correct than converting here was. This object is built
     * the instant the pointer goes down, but it is handled on the next frame;
     * converting at construction resolved the click against an origin the camera
     * had already panned away from, so a click during a pan commanded a
     * destination a tile or two from the glyph it landed on.
     */
    readonly screenX : number
    readonly screenY : number

    /**
     * Whether control was held, which is what makes this a different GESTURE rather than
     * the same click with a flag on it.
     *
     * Recorded here and read only by ResolveClickTargets, which turns it into a
     * ClickGesture and routes on that. No gameplay system tests this: "was ctrl down" is
     * a question about the input device, and a system asking it directly would be
     * reimplementing the layer stack's job of deciding who hears what.
     */
    readonly ctrlKey : boolean

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

        this.screenX = Math.floor(pixelX / TileSizePixels)
        this.screenY = Math.floor(pixelY / TileSizePixels)
        this.ctrlKey = pointerEvent.ctrlKey
    }

}
