import { Layer } from "./Contracts/Components/Layer.ts";
import { Position } from "./Contracts/Components/Position.ts";
import { Representation } from "./Contracts/Components/Representation.ts";
import { GameClickEvent } from "./Contracts/Events/GameClickEvent.ts";
import { GameKeyboardEvent } from "./Contracts/Events/KeyBoardEvent.ts";
import { RenderingResources, Resources } from "./Contracts/SystemResources.ts";
import { DecidesMovement } from "./Contracts/Tags/DecidesMovement.ts";
import { IsCollidable } from "./Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "./Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "./Contracts/Tags/IsPlayer.ts";
import type { IDispose } from "./Interfaces/IDispose.ts";
import type { IEventQueue } from "./Interfaces/IEventQueue.ts";
import type { IRegistry } from "./Interfaces/IRegistry.ts";
import { LinkedList } from "./libraries/FastList/FastList.ts";
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.ts";
import { HandleMovement } from "./Systems.EventHandlers/HandleMovement.ts";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.ts";
import { EventQueue } from "./Systems.Framework/EventQueue.ts";
import { GlobalRegistry } from "./Systems.Framework/Registry.ts";
import { HandleInputEvents } from "./Systems.Gameloop/HandleInputEvents.ts";
import { RenderCanvas } from "./Systems.Gameloop/RenderCanvas.ts";

export interface GameContext {
    registry : GlobalRegistry
    eventQueue : EventQueue
    resources : Resources
    disposalFunctions : IDispose[]
}

export function Initialization (resources: Resources) : GameContext {
    const registry = new GlobalRegistry()
    const eventQueue = new EventQueue(new LinkedList())
    const disposalFunctions : IDispose[] = []

    registry
        .RegisterComponentRegistry(Position, new HashMapComponentRegistry(Position))
        .RegisterComponentRegistry(Layer, new HashMapComponentRegistry(Layer))
        .RegisterComponentRegistry(Representation, new HashMapComponentRegistry(Representation))
        .RegisterComponentRegistry(IsCollidable, new HashMapComponentRegistry(IsCollidable))
        .RegisterComponentRegistry(IsMoveable, new HashMapComponentRegistry(IsMoveable))
        .RegisterComponentRegistry(IsPlayer, new HashMapComponentRegistry(IsPlayer))
        .RegisterComponentRegistry(DecidesMovement, new HashMapComponentRegistry(DecidesMovement))
    
    const keyEventListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent))}
    const clickEventListener = (event: PointerEvent)=>{eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement))}

    resources.Rendering.canvasElement.addEventListener("keydown", keyEventListener)
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener)

    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keydown", keyEventListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener))

    return { registry, eventQueue, resources, disposalFunctions }
}

export function GameLoop (registry : IRegistry, eventQueue : IEventQueue, Resources : Resources) {
    HandleInputEvents(registry, eventQueue)
    HandleMovement(registry, eventQueue)

    HandleCollision(registry, eventQueue)

    RenderCanvas(registry, Resources.Rendering)
    eventQueue.Clear()
}

export function Teardown (disposalFunctions : IDispose[]) {
    disposalFunctions.forEach((dispose)=>dispose())
}

/**
 * Bootstraps the game onto a canvas and drives it with requestAnimationFrame.
 * Returns a teardown function that stops the loop and removes all listeners.
 */
export function StartGame (canvasElement : HTMLCanvasElement) : IDispose {
    const resources = new Resources(new RenderingResources(canvasElement))
    const context = Initialization(resources)

    // The canvas must be focusable to receive keydown events.
    if (!canvasElement.hasAttribute("tabindex")) canvasElement.tabIndex = 0

    let frameHandle = 0
    let running = true

    const tick = () => {
        if (!running) return
        GameLoop(context.registry, context.eventQueue, context.resources)
        frameHandle = requestAnimationFrame(tick)
    }

    frameHandle = requestAnimationFrame(tick)

    return () => {
        running = false
        cancelAnimationFrame(frameHandle)
        Teardown(context.disposalFunctions)
    }
}

document.addEventListener("DOMContentLoaded", ()=>{
    const gameContainer = document.getElementById("GameContainer") as HTMLElement | null
    if (gameContainer === null) throw new Error("Could not find game html element!")

    const canvas = document.createElement("canvas")
    canvas.width = gameContainer.clientWidth
    canvas.height = gameContainer.clientHeight
    canvas.id = "game"
    canvas.tabIndex = 0
    gameContainer.append(canvas)

    const stopGame = StartGame(canvas);
    
    canvas.focus();

    const unloadEventListener = ()=>{
        stopGame()
        gameContainer.removeChild(canvas)
        window.removeEventListener("beforeunload", unloadEventListener)
    }

    window.addEventListener("beforeunload", unloadEventListener);
})