import { CharacterRepresentation, GameColors, PlayerLayer } from "./Configuration/DisplayConstants.ts";
import { Debug, HumanSpeed } from "./Configuration/GameConstants.ts";
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
import type { ISystemContext } from "./Interfaces/ISystemContext.ts";
import { LinkedList } from "./Libraries/FastList/FastList.ts";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.ts";
import { EntityBuilder } from "./Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "./Systems.Framework/EventQueue.ts";
import { GlobalRegistry } from "./Systems.Framework/Registry.ts";
import { CreateWorldStreamingResources } from "./Utilities/CreateWorldStreamingResources.ts";
import { CentreCameraOnPlayer } from "./Utilities/CameraUtilities.ts";
import { CameraActions, ReleaseAllKeys } from "./Systems.Gameloop/PanCamera.ts";
import { IsCamera } from "./Contracts/Tags/IsCamera.ts";
import { MovementFlag } from "./Contracts/Tags/MovementFlag.ts";
import { TargetLocation } from "./Contracts/Components/TargetLocation.ts";
import { HerdOwner } from "./Contracts/Components/HerdOwner.ts";
import { HerdGoal } from "./Contracts/Components/HerdGoal.ts";
import { Needs } from "./Contracts/Components/Needs.ts";
import { CollectingResource } from "./Contracts/Components/CollectingResource.ts";
import { IsPredator } from "./Contracts/Components/IsPredator.ts";
import { Human } from "./Contracts/Tags/Human.ts";
import { ActionListener } from "./Contracts/Components/ActionListener.ts";
import { ClickListener } from "./Contracts/Components/ClickListener.ts";
import { ClickGesture } from "./Contracts/Actions/GameActions.ts";
import { InputLayer } from "./Contracts/Components/InputLayer.ts";
import { MenuState } from "./Contracts/Components/MenuState.ts";
import { HudState } from "./Contracts/Components/HudState.ts";
import { Carcass } from "./Contracts/Components/Carcass.ts";
import { Consumable } from "./Contracts/Components/Consumable.ts";
import { ScreenPosition } from "./Contracts/Components/ScreenPosition.ts";
import { BuildGameplayLoopLayer } from "./Configuration/GameLoopLayers.ts";
import { OpenStartMenu } from "./Configuration/Menus.ts";
import { PushLoopLayer } from "./Systems.Framework/GameLoopStack.ts";
import { PushInputLayer } from "./Systems.Framework/InputLayerStack.ts";
import { PlayerActions } from "./Systems.Gameloop/HandlePlayerActions.ts";

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
        .RegisterComponentRegistry(IsCamera, new HashMapComponentRegistry(IsCamera))
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
        // The herd AI: what a herd is doing, what its animals want, which of them
        // are stopped to feed or drink, and what they are afraid of.
        .RegisterComponentRegistry(HerdGoal, new HashMapComponentRegistry(HerdGoal))
        .RegisterComponentRegistry(Needs, new HashMapComponentRegistry(Needs))
        .RegisterComponentRegistry(CollectingResource, new HashMapComponentRegistry(CollectingResource))
        .RegisterComponentRegistry(IsPredator, new HashMapComponentRegistry(IsPredator))
        // Dying, and being eaten afterwards. Consumable is carried by the living
        // too; Carcass is what says a body is dead and fair game.
        .RegisterComponentRegistry(Consumable, new HashMapComponentRegistry(Consumable))
        .RegisterComponentRegistry(Carcass, new HashMapComponentRegistry(Carcass))
        // Input routing, menus, and the needs readout.
        .RegisterComponentRegistry(ActionListener, new HashMapComponentRegistry(ActionListener))
        .RegisterComponentRegistry(ClickListener, new HashMapComponentRegistry(ClickListener))
        .RegisterComponentRegistry(InputLayer, new HashMapComponentRegistry(InputLayer))
        .RegisterComponentRegistry(ScreenPosition, new HashMapComponentRegistry(ScreenPosition))
        .RegisterComponentRegistry(MenuState, new HashMapComponentRegistry(MenuState))
        .RegisterComponentRegistry(HudState, new HashMapComponentRegistry(HudState))

    const keyDownListener = (keyEvent: KeyboardEvent)=>{
        // Arrow keys scroll the page and space scrolls it a screenful. On the
        // standalone harness there is nothing to scroll, but embedded in the site
        // the game would slide out from under the player the moment they tried to
        // pan. Only keys the game has a use for are swallowed, so browser
        // shortcuts still work.
        //
        // Asked of the bindings rather than of any one system's keymap: which
        // keys matter is exactly the set that resolves to an action, and the DOM
        // layer has no business knowing that W means "pan the camera up".
        if (resources.Input.bindings.ActionForCode(keyEvent.code) !== undefined && !keyEvent.ctrlKey && !keyEvent.altKey && !keyEvent.metaKey) keyEvent.preventDefault()

        eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, true))
    }
    const keyUpListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, false))}
    // No camera here on purpose: the event records which screen tile was clicked
    // and HandleInputEvents turns that into a world tile on the frame it handles
    // it, against the same camera origin the renderer is about to use.
    const clickEventListener = (event: PointerEvent)=>{eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement))}

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

    // The bottom of the input stack: what the world itself hears. Ownerless,
    // because it outlives every entity on it -- a player can die and be replaced
    // without the game going deaf.
    const worldInputLayer = PushInputLayer(registry, resources.Input)

    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .AddActionListener(worldInputLayer, ...PlayerActions)
        // Ordinary clicks are the world's, and this is what HandleInputEvents reads. A
        // layer pushed above this one can take the gesture away without either system
        // knowing the other exists -- which is the whole reason clicks go through the
        // stack now instead of being read off the queue.
        .AddClickListener(worldInputLayer, ClickGesture.Plain)
        .GetEntity()

    // The debug inspector: a layer of its own, above the world's, claiming ONLY the
    // control gesture. Because layers are transparent -- they intercept just what their
    // listeners claim -- a plain click falls straight past it to the player below, so
    // turning debugging on costs the ordinary controls nothing.
    if (Debug) {
        const inspectorLayer = PushInputLayer(registry, resources.Input)

        resources.Input.debugInspector = new EntityBuilder(registry)
            .AddClickListener(inspectorLayer, ClickGesture.Control)
            .GetEntity()
    }

    // The camera is an ordinary entity: a Position marking the centre of the
    // viewport, and nothing else. Bodiless -- no Layer, no Representation -- so
    // the renderer's queries never pick it up. Parked at the origin here and
    // aimed at the player by CentreCameraOnPlayer below, once there is one.
    //
    // It claims the pan actions itself rather than a system claiming them on its
    // behalf, which is what lets a menu's blackout layer stop the pan without
    // either the camera or the menu knowing the other exists.
    new EntityBuilder(registry)
        .AddPosition(new Position(0, 0))
        .AddCamera()
        .AddActionListener(worldInputLayer, ...CameraActions)

    // The body, owned by the controller above. Appetites go here rather than on the
    // controller: this is the thing that starves, so HandleNeedsDecay reaches it
    // with no special case, and the controller outlives it holding the input layer.
    // It is also worth eating, like anything else with a body.
    new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddTags(true, true, false)
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddHuman()
        .AddNeeds()
        .AddConsumable()
        .AddOwner(player)

    // new EntityBuilder(registry)
    //     .MakeHerd(new Position(70, 70), 15, CharacterRepresentation.Animal)

    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keydown", keyDownListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keyup", keyUpListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("blur", blurListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("wheel", wheelListener))

    // The one time anything aims the camera at the player. From here it is the
    // keyboard's, and StreamChunks follows it rather than them.
    CentreCameraOnPlayer(registry)

    // Gameplay goes on the bottom of the schedule and the start menu on top of
    // it, so the world is fully built and simply dormant behind the first
    // screen. Closing that menu does not start anything; it reveals what was
    // already there.
    PushLoopLayer(resources.Schedule, eventQueue, BuildGameplayLoopLayer())
    OpenStartMenu({ registry, eventQueue, resources })

    return { registry, eventQueue, resources, disposalFunctions }
}

/**
 * Runs one frame of whichever mode is on top of the schedule.
 *
 * The loop used to be this list, written out. It is a stack of lists now
 * because "what runs" turned out to be a thing the game needed to change at
 * runtime -- pausing, menus, and any mode that is gameplay minus a system --
 * and a fixed sequence of calls can only be changed by editing it.
 */
export function GameLoop (registry : IRegistry, eventQueue : IEventQueue, resources : Resources) {
    const context : ISystemContext = { registry, eventQueue, resources }

    // Snapshotted before anything runs. A system may push a layer mid-frame, and
    // the new layer must not start until the next one: otherwise opening a menu
    // would run the menu's input handler on the same frame as -- and against the
    // same events as -- the keypress that opened it, and it would immediately
    // read that Escape as "close me".
    const scheduledSystems = resources.Schedule.ActiveLayer()?.EnabledSystems() ?? []

    for (const system of scheduledSystems) system.run(context)

    // Outside the layers, deliberately. Draining the queue is the frame's job,
    // not any mode's, and a new layer that forgot the call would silently pile
    // up events until nothing could tell which frame they came from.
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
