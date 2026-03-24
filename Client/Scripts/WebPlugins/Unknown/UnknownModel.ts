import {UnknownClassInstances} from "../../Unknown/Libraries/BuildContainer.js"
import { Observable } from "../../Framework/Knockout/knockout.js";
import { ko } from "../../Framework/Knockout/ko.js";
import { ModeHandler } from "../../Unknown/Mode/ModeHandler.js";
import { GraphicsConfig } from "../../Unknown/State/Config/GraphicsConfig.js";

const MAIN_VIEW_ID = "main-view"
const HTML_GAME_ID = "Game"

export class UnknownModel implements IHTMLInjectable<void> {
    readonly ViewUrl = "WebPlugins/UnknownView.html";
    isLoading: Observable<boolean>;
    HTMLandKnockoutRequestCallback : Promise<void>
    modeHandler : ModeHandler

    constructor () {
        this.isLoading = ko.observable(true)

        this.HTMLandKnockoutRequestCallback = Promise.resolve()

        this.modeHandler = <ModeHandler>UnknownClassInstances.resolve(ModeHandler)
    }

    async Init() {
        await this.HTMLandKnockoutRequestCallback

        let parentElement = document.getElementById(MAIN_VIEW_ID)
        if (!parentElement) {
            console.error(MAIN_VIEW_ID + " not found! Please fix id in Unknown model!")
            parentElement = document.body
        }
        
        let displayElement = document.createElement("div")
        displayElement.id = HTML_GAME_ID
        parentElement.appendChild(displayElement)
        
        console.log("Game starting up!");

        // Set up width
        this.setUpScreen(displayElement)


        // Set up event handlers
        document.addEventListener('keyup',this.handleKeyUp); 
        document.addEventListener('keydown', this.blockKeyDown, { passive: false }); 
        document.addEventListener("wheel", this.blockScroll, { passive: false })

        // // Disable scrolling
        // var x=window.scrollX;
        // var y=window.scrollY;
        // window.onscroll=function(){window.scrollTo(x, y);};
        
        this.modeHandler.handleStartup()
        this.Loop(displayElement, this.modeHandler)

        this.isLoading(false)

        return Promise.resolve()
    }

    Loop = (displayElement : HTMLElement, modeHandler : ModeHandler) => {
        setInterval(()=>{
            modeHandler.requestFrame(displayElement);
            modeHandler.step()
        }, GraphicsConfig.GameSpeedMilliseconds)

        // requestAnimationFrame(()=>Loop(lastUpdate, displayElement, modeHandler)); // loop
    }

    Destruction() {
        // Tear down event handlers and Enable scrolling
        document.removeEventListener('keydown', this.blockKeyDown); 
        document.removeEventListener('keyup', this.handleKeyUp); 
        document.removeEventListener("wheel", this.blockScroll)

        this.modeHandler.handleTearDown()
    }

    setUpScreen = (displayElement : HTMLElement) => {
        const containerElementStyle = window.getComputedStyle(<HTMLElement>displayElement.parentElement)

        displayElement.style.setProperty('--game-width', containerElementStyle.width);
        displayElement.style.setProperty('--game-height', containerElementStyle.height);
    }

    handleKeyUp = (event : KeyboardEvent) => this.modeHandler.handleKeyEvent(event)
    blockKeyDown = (event : KeyboardEvent) => event.preventDefault()
    blockScroll = (event : WheelEvent) => {event.preventDefault();}
}
