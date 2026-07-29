import { CharacterRepresentation, GameColors, PlayerLayer } from "./Configuration/DisplayConstants.ts";
import { AnimalSpeed, HumanSpeed } from "./Configuration/GameConstants.ts";
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
import { PopulateHerds } from "./Systems.World/PopulateHerds.ts";
import { CentreCameraOnPlayer } from "./Systems.World/CentreCameraOnPlayer.ts";
import { PanByKeyCode, PanCamera, ReleaseAllKeys } from "./Systems.World/PanCamera.ts";
import { MovementFlag } from "./Contracts/Tags/MovementFlag.ts";
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.ts";
import { TargetLocation } from "./Contracts/Components/TargetLocation.ts";
import { HandleMovement } from "./Systems.Gameloop/HandleMovement.ts";
import { HerdOwner } from "./Contracts/Components/HerdOwner.ts";
import { HandleAIMovement } from "./Systems.Gameloop/HandleAIMovement.ts";
import { Human } from "./Contracts/Tags/Human.ts";

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
        .RegisterComponentRegistry(HerdOwner, new HashMapComponentRegistry(HerdOwner))
        .RegisterComponentRegistry(Human, new HashMapComponentRegistry(Human))
    
    const keyDownListener = (keyEvent: KeyboardEvent)=>{
        // Arrow keys scroll the page by default. On the standalone harness there
        // is nothing to scroll, but embedded in the site the game would slide out
        // from under the player the moment they tried to pan. Only the pan keys
        // are swallowed, so browser shortcuts still work.
        if (PanByKeyCode[keyEvent.code] !== undefined && !keyEvent.ctrlKey && !keyEvent.altKey && !keyEvent.metaKey) keyEvent.preventDefault()

        eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, true))
    }
    const keyUpListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, false))}
    const clickEventListener = (event: PointerEvent)=>{eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement, resources.Rendering.Camera))}

    // Losing focus swallows the keyup, so a key held while alt-tabbing away
    // would otherwise still be "down" when the player came back and the camera
    // would scroll on its own.
    const blurListener = ()=>{ReleaseAllKeys(resources.Input)}

    // The game does not use the wheel, but the page underneath it does: without
    // this, scrolling over the board scrolls the board off the screen. Only
    // events over the canvas reach here, so the rest of the page still scrolls.
    // Must be non-passive or preventDefault is ignored.
    const wheelListener = (event: WheelEvent)=>{event.preventDefault()}

    resources.Rendering.canvasElement.addEventListener("keydown", keyDownListener)
    resources.Rendering.canvasElement.addEventListener("keyup", keyUpListener)
    resources.Rendering.canvasElement.addEventListener("blur", blurListener)
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener)
    resources.Rendering.canvasElement.addEventListener("wheel", wheelListener, { passive: false })

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
        .AddHuman()
        .AddOwner(player)

    new EntityBuilder(registry)
        .AddPosition(new Position(40, 40))
        .AddRepresentation(new Representation(CharacterRepresentation.Animal, GameColors.Animal))
        .AddMovement(AnimalSpeed)
        .AddTags(false, true, false)
        .AddLayer(new Layer(PlayerLayer))

    new EntityBuilder(registry)
        .MakeHerd(new Position(70, 70), 15, CharacterRepresentation.Animal)

    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keydown", keyDownListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keyup", keyUpListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("blur", blurListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("wheel", wheelListener))

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
    HandleAIMovement(registry)

    // After the pan, and before rendering: streaming reacts to where the camera
    // now points, so the chunks it just scrolled onto exist by the time they are
    // drawn. Running it ahead of PanCamera would show a blank strip for a frame.
    StreamChunks(registry, Resources.World, Resources.Rendering.Camera)

    // Immediately after streaming, which is the only point in the frame where
    // the list of chunks it just loaded is still standing.
    PopulateHerds(registry, Resources.World, Resources.Rendering.Camera, Resources.Random)

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
