import { Observable } from "../../Framework/Knockout/knockout.js";
import { ko } from "../../Framework/Knockout/ko.js";
import { StartGame } from "../../Chess/Game.js";
import { IDispose } from "../../Chess/Interfaces/IDispose.js";
import { GameWidth } from "../../Chess/Configuration/GameConstants.js";
import { TileSizePixels } from "../../Chess/Configuration/DisplayConstants.js";

const MAIN_VIEW_ID = "main-view"
const HTML_GAME_ID = "ChessGame"

export class ChessModel implements IHTMLInjectable<void> {
    readonly ViewUrl = "WebPlugins/ChessView.html";
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
            console.error(MAIN_VIEW_ID + " not found! Please fix id in Chess model!")
            parentElement = document.body
        }

        const canvasElement = document.createElement("canvas")
        canvasElement.id = HTML_GAME_ID

        // The rendering pipeline draws with the backing-store size (canvas.width/height),
        // which is fixed at the board's native resolution. CSS then scales the display up;
        // GameClickEvent rescales pointer coords back down, so input stays aligned.
        canvasElement.width = GameWidth * TileSizePixels
        canvasElement.height = GameWidth * TileSizePixels
        canvasElement.style.width = "min(80vmin, 512px)"
        canvasElement.style.height = "min(80vmin, 512px)"
        canvasElement.style.display = "block"
        canvasElement.style.margin = "auto"
        canvasElement.style.imageRendering = "pixelated"

        parentElement.appendChild(canvasElement)
        this.canvasElement = canvasElement

        console.log("Chess starting up!");

        this.stopGame = StartGame(canvasElement)

        this.isLoading(false)

        return Promise.resolve()
    }

    Destruction() {
        this.stopGame?.()
        this.canvasElement?.remove()
    }
}
