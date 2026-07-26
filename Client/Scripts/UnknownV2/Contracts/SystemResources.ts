import { FontStyle } from "../Configuration/GameConstants.ts";

export class Resources {
    constructor(public Rendering : RenderingResources) {}
}

export class RenderingResources {
    canvasContext : CanvasRenderingContext2D
    constructor(public canvasElement : HTMLCanvasElement) {
        const temp = canvasElement.getContext("2d", { alpha: false })

        if (temp === undefined || temp === null) throw "Could not get context for canvas!"
        temp.font = FontStyle;
        temp.textBaseline = "middle";
        temp.textAlign = "center";

        // Stop touch gestures (scroll / pinch-zoom / long-press menu) from
        // hijacking taps on the board so pointer input stays responsive on mobile.
        canvasElement.style.touchAction = "none";

        this.canvasContext = temp
    }
}