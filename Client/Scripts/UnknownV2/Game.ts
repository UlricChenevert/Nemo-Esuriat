import { CharacterRepresentation, GameColors, PlayerLayer, TileSizePixels } from "./Configuration/DisplayConstants.ts";
import { AnimalSpeed, GameWidth, HumanSpeed } from "./Configuration/GameConstants.ts";
import { ChunkCoordinate } from "./Contracts/Components/ChunkCoordinate.ts";
import { IsSelectable } from "./Contracts/Components/IsSelectible.ts";
import { MultiTileRepresentation } from "./Contracts/Components/MultiTileRepresentation.ts";
import { Layer } from "./Contracts/Components/Layer.ts";
import { OwnedBy } from "./Contracts/Components/OwnedBy.ts";
import { Owns } from "./Contracts/Components/Owns.ts";
import { Position } from "./Contracts/Components/Position.ts";
import { Representation } from "./Contracts/Components/Representation.ts";
import { SelectionState } from "./Contracts/Components/SelectionState.ts";
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
import { LinkedList } from "./Libraries/FastList/FastList.ts";
import { EnqueueCollision } from "./Systems.EventHandlers/EnqueueCollision.ts";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.ts";
import { EntityBuilder } from "./Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "./Systems.Framework/EventQueue.ts";
import { GlobalRegistry } from "./Systems.Framework/Registry.ts";
import { HandleInputEvents } from "./Systems.Gameloop/HandleInputEvents.ts";
import { RenderCanvas } from "./Systems.Gameloop/RenderCanvas.ts";
import { CreateWorldStreamingResources } from "./Systems.World/CreateWorldStreamingResources.ts";
import { StreamChunks } from "./Systems.World/StreamChunks.ts";
import { CentreCameraOnPlayer } from "./Systems.World/CentreCameraOnPlayer.ts";
import { PanCamera, ReleaseAllKeys } from "./Systems.World/PanCamera.ts";
import { MovementFlag } from "./Contracts/Tags/MovementFlag.ts";
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.ts";
import { TargetLocation } from "./Contracts/Components/TargetLocation.ts";
import { HandleMovement } from "./Systems.Gameloop/HandleMovement.ts";

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
        .RegisterComponentRegistry(IsSelectable, new HashMapComponentRegistry(IsSelectable))
        .RegisterComponentRegistry(SelectionState, new HashMapComponentRegistry(SelectionState))
        .RegisterComponentRegistry(MultiTileRepresentation, new HashMapComponentRegistry(MultiTileRepresentation))
        .RegisterComponentRegistry(ChunkCoordinate, new HashMapComponentRegistry(ChunkCoordinate))
        .RegisterComponentRegistry(OwnedBy, new HashMapComponentRegistry(OwnedBy))
        .RegisterComponentRegistry(Owns, new HashMapComponentRegistry(Owns))
        .RegisterComponentRegistry(MovementFlag, new HashMapComponentRegistry(MovementFlag))
        .RegisterComponentRegistry(TargetLocation, new HashMapComponentRegistry(TargetLocation))
    
    const keyDownListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, true))}
    const keyUpListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, false))}
    const clickEventListener = (event: PointerEvent)=>{eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement, resources.Rendering.Camera))}

    // Losing focus swallows the keyup, so a key held while alt-tabbing away
    // would otherwise still be "down" when the player came back and the camera
    // would scroll on its own.
    const blurListener = ()=>{ReleaseAllKeys(resources.Input)}

    resources.Rendering.canvasElement.addEventListener("keydown", keyDownListener)
    resources.Rendering.canvasElement.addEventListener("keyup", keyUpListener)
    resources.Rendering.canvasElement.addEventListener("blur", blurListener)
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener)

    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .GetEntity()
        
    new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddTags(true, true, false)
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddOwner(player)

    new EntityBuilder(registry)
        .AddPosition(new Position(40, 40))
        .AddRepresentation(new Representation(CharacterRepresentation.Animal, GameColors.Animal))
        .AddMovement(AnimalSpeed)
        .AddTags(false, true, false)
        .AddLayer(new Layer(PlayerLayer))


    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keydown", keyDownListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keyup", keyUpListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("blur", blurListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener))

    // The one time anything aims the camera at the player. From here it is the
    // keyboard's, and StreamChunks follows it rather than them.
    CentreCameraOnPlayer(registry, resources.Rendering.Camera)

    return { registry, eventQueue, resources, disposalFunctions }
}

export function GameLoop (registry : IRegistry, eventQueue : IEventQueue, Resources : Resources) {
    HandleInputEvents(registry, eventQueue)
    PanCamera(eventQueue, Resources.Input, Resources.Rendering.Camera, Resources.Time)
    HandleMovement(registry, eventQueue, Resources.Time)
    EnqueueCollision(registry, eventQueue)

    // After the pan, and before rendering: streaming reacts to where the camera
    // now points, so the chunks it just scrolled onto exist by the time they are
    // drawn. Running it ahead of PanCamera would show a blank strip for a frame.
    StreamChunks(registry, Resources.World, Resources.Rendering.Camera)

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
    const resources = new Resources(new RenderingResources(canvasElement), CreateWorldStreamingResources())
    const context = Initialization(resources)

    // The canvas must be focusable to receive keydown events.
    if (!canvasElement.hasAttribute("tabindex")) canvasElement.tabIndex = 0

    let frameHandle = 0
    let running = true

    // requestAnimationFrame hands the callback the frame's timestamp, which is
    // what the tick length is measured from -- Date.now would also pick up any
    // delay between the frame being scheduled and this callback running.
    const tick = (frameMilliseconds : number) => {
        if (!running) return

        context.resources.Time.Advance(frameMilliseconds)

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

    // The backing store is the game's native resolution, not the container's
    // size. CSS scales the result up for display, and GameClickEvent scales
    // clicks back down. Sizing from the container would tie the number of
    // drawable pixels to the layout -- and #GameContainer has no height of its
    // own, so clientHeight is 0 and nothing could be drawn at all.
    canvas.width = GameWidth * TileSizePixels
    canvas.height = GameWidth * TileSizePixels
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