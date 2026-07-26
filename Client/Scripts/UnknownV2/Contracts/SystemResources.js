import { FontStyle } from "../Configuration/GameConstants.js";
export class Resources {
    Rendering;
    constructor(Rendering) {
        this.Rendering = Rendering;
    }
}
export class RenderingResources {
    canvasElement;
    canvasContext;
    constructor(canvasElement) {
        this.canvasElement = canvasElement;
        const temp = canvasElement.getContext("2d", { alpha: false });
        if (temp === undefined || temp === null)
            throw "Could not get context for canvas!";
        temp.font = FontStyle;
        temp.textBaseline = "middle";
        temp.textAlign = "center";
        // Stop touch gestures (scroll / pinch-zoom / long-press menu) from
        // hijacking taps on the board so pointer input stays responsive on mobile.
        canvasElement.style.touchAction = "none";
        this.canvasContext = temp;
    }
}
//# sourceMappingURL=SystemResources.js.map