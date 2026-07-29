import { Observable } from "../../Framework/Knockout/knockout.js";
import { ko } from "../../Framework/Knockout/ko.js";
import { StartGame } from "../../UnknownV2/Game.js";
import { IDispose } from "../../UnknownV2/Interfaces/IDispose.js";
import { GameWidth } from "../../UnknownV2/Configuration/GameConstants.js";
import { TileSizePixels } from "../../UnknownV2/Configuration/DisplayConstants.js";

const MAIN_VIEW_ID = "main-view"
const HTML_GAME_ID = "UnknownV2Game"

export class UnknownV2Model implements IHTMLInjectable<void> {
    readonly ViewUrl = "WebPlugins/UnknownV2View.html";
    isLoading: Observable<boolean>;
    HTMLandKnockoutRequestCallback : Promise<void>

    private canvasElement? : HTMLCanvasElement
    private stopGame? : IDispose

    constructor () {
        this.isLoading = ko.observable(true)
        this.HTMLandKnockoutRequestCallback = Promise.resolve()
    }

    async Init() {
        await this.HTMLandKnockoutRequestCallback

        let parentElement = document.getElementById(MAIN_VIEW_ID)
        if (!parentElement) {
            console.error(MAIN_VIEW_ID + " not found! Please fix id in Unknown V2 model!")
            parentElement = document.body
        }

        const canvasElement = document.createElement("canvas")
        canvasElement.id = HTML_GAME_ID

        // The rendering pipeline draws with the backing-store size (canvas.width/height),
        // which is fixed at the world's native resolution. CSS then scales the display up;
        // GameClickEvent rescales pointer coords back down, so input stays aligned.
        canvasElement.width = GameWidth * TileSizePixels
        canvasElement.height = GameWidth * TileSizePixels
        // As large as the viewport allows while staying square. No pixel cap:
        // the backing store is 1600px, so a cap only shrinks the playfield on
        // exactly the large monitors that have room for it. #main-view is a
        // flex column, so `margin: auto` centres on both axes.
        const displaySize = "min(95vw, 92vh)"
        canvasElement.style.width = displaySize
        canvasElement.style.height = displaySize
        canvasElement.style.display = "block"
        canvasElement.style.margin = "auto"
        canvasElement.style.imageRendering = "pixelated"
        canvasElement.style.outline = "none"

        parentElement.appendChild(canvasElement)
        this.canvasElement = canvasElement

        console.log("Unknown V2 starting up!");

        this.stopGame = StartGame(canvasElement)

        // Keyboard listeners are bound to the canvas, not the document, so camera
        // panning stays dead until the canvas holds focus. Grab it up front rather
        // than making the player guess that they have to click first.
        canvasElement.focus()

        this.isLoading(false)

        return Promise.resolve()
    }

    Destruction() {
        this.stopGame?.()
        this.canvasElement?.remove()
    }
}
