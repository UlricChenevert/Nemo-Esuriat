import type { IGameEvent } from "../Interfaces/IGameEvent";
import { Position } from "./Position";

export class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";

    position : Position

    constructor(pointerEvent : MouseEvent, canvasElement : HTMLCanvasElement) {
        const canvasPositioningRectangle = canvasElement.getBoundingClientRect()

        this.position = new Position(pointerEvent.clientX - canvasPositioningRectangle.left, pointerEvent.clientY - canvasPositioningRectangle.top)
    }

}