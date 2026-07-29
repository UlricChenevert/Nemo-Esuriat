import { CharacterRepresentation, GameColors, PlayerLayer } from "./Configuration/DisplayConstants.js";
import { AnimalSpeed, HumanSpeed } from "./Configuration/GameConstants.js";
import { ChunkCoordinate } from "./Contracts/Components/ChunkCoordinate.js";
import { IsSelectable } from "./Contracts/Components/IsSelectible.js";
import { MultiTileRepresentation } from "./Contracts/Components/MultiTileRepresentation.js";
import { Layer } from "./Contracts/Components/Layer.js";
import { OwnedBy } from "./Contracts/Components/OwnedBy.js";
import { Owns } from "./Contracts/Components/Owns.js";
import { Position } from "./Contracts/Components/Position.js";
import { Representation } from "./Contracts/Components/Representation.js";
import { SelectionState } from "./Contracts/Components/SelectionState.js";
import { GameClickEvent } from "./Contracts/Events/GameClickEvent.js";
import { GameKeyboardEvent } from "./Contracts/Events/KeyBoardEvent.js";
import { RenderingResources, Resources } from "./Contracts/SystemResources.js";
import { DecidesMovement } from "./Contracts/Tags/DecidesMovement.js";
import { IsCollidable } from "./Contracts/Tags/IsCollideable.js";
import { IsMoveable } from "./Contracts/Tags/IsMovable.js";
import { IsPlayer } from "./Contracts/Tags/IsPlayer.js";
import { LinkedList } from "./Libraries/FastList/FastList.js";
import { EnqueueCollision } from "./Systems.EventHandlers/EnqueueCollision.js";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.js";
import { EntityBuilder } from "./Systems.Framework/EntityBuilder.js";
import { EventQueue } from "./Systems.Framework/EventQueue.js";
import { GlobalRegistry } from "./Systems.Framework/Registry.js";
import { HandleInputEvents } from "./Systems.Gameloop/HandleInputEvents.js";
import { RenderCanvas } from "./Systems.Gameloop/RenderCanvas.js";
import { CreateWorldStreamingResources } from "./Systems.World/CreateWorldStreamingResources.js";
import { StreamChunks } from "./Systems.World/StreamChunks.js";
import { PopulateHerds } from "./Systems.World/PopulateHerds.js";
import { CentreCameraOnPlayer } from "./Systems.World/CentreCameraOnPlayer.js";
import { PanByKeyCode, PanCamera, ReleaseAllKeys } from "./Systems.World/PanCamera.js";
import { MovementFlag } from "./Contracts/Tags/MovementFlag.js";
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.js";
import { TargetLocation } from "./Contracts/Components/TargetLocation.js";
import { HandleMovement } from "./Systems.Gameloop/HandleMovement.js";
import { HerdOwner } from "./Contracts/Components/HerdOwner.js";
import { HandleAIMovement } from "./Systems.Gameloop/HandleAIMovement.js";
import { Human } from "./Contracts/Tags/Human.js";
export function Initialization(resources) {
    const registry = new GlobalRegistry();
    const eventQueue = new EventQueue(new LinkedList());
    const disposalFunctions = [];
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
        .RegisterComponentRegistry(Human, new HashMapComponentRegistry(Human));
    const keyDownListener = (keyEvent) => {
        // Arrow keys scroll the page by default. On the standalone harness there
        // is nothing to scroll, but embedded in the site the game would slide out
        // from under the player the moment they tried to pan. Only the pan keys
        // are swallowed, so browser shortcuts still work.
        if (PanByKeyCode[keyEvent.code] !== undefined && !keyEvent.ctrlKey && !keyEvent.altKey && !keyEvent.metaKey)
            keyEvent.preventDefault();
        eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, true));
    };
    const keyUpListener = (keyEvent) => { eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent, false)); };
    const clickEventListener = (event) => { eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement, resources.Rendering.Camera)); };
    // Losing focus swallows the keyup, so a key held while alt-tabbing away
    // would otherwise still be "down" when the player came back and the camera
    // would scroll on its own.
    const blurListener = () => { ReleaseAllKeys(resources.Input); };
    // The game does not use the wheel, but the page underneath it does: without
    // this, scrolling over the board scrolls the board off the screen. Only
    // events over the canvas reach here, so the rest of the page still scrolls.
    // Must be non-passive or preventDefault is ignored.
    const wheelListener = (event) => { event.preventDefault(); };
    resources.Rendering.canvasElement.addEventListener("keydown", keyDownListener);
    resources.Rendering.canvasElement.addEventListener("keyup", keyUpListener);
    resources.Rendering.canvasElement.addEventListener("blur", blurListener);
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener);
    resources.Rendering.canvasElement.addEventListener("wheel", wheelListener, { passive: false });
    const player = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddTags(false, false, true)
        .GetEntity();
    new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddTags(true, true, false)
        .AddLayer(new Layer(PlayerLayer))
        .AddMovement(HumanSpeed)
        .AddHuman()
        .AddOwner(player);
    new EntityBuilder(registry)
        .AddPosition(new Position(40, 40))
        .AddRepresentation(new Representation(CharacterRepresentation.Animal, GameColors.Animal))
        .AddMovement(AnimalSpeed)
        .AddTags(false, true, false)
        .AddLayer(new Layer(PlayerLayer));
    new EntityBuilder(registry)
        .MakeHerd(new Position(70, 70), 15, CharacterRepresentation.Animal);
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("keydown", keyDownListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("keyup", keyUpListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("blur", blurListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("wheel", wheelListener));
    // The one time anything aims the camera at the player. From here it is the
    // keyboard's, and StreamChunks follows it rather than them.
    CentreCameraOnPlayer(registry, resources.Rendering.Camera);
    return { registry, eventQueue, resources, disposalFunctions };
}
export function GameLoop(registry, eventQueue, Resources) {
    HandleInputEvents(registry, eventQueue);
    PanCamera(eventQueue, Resources.Input, Resources.Rendering.Camera, Resources.Time);
    HandleMovement(registry, eventQueue, Resources.Time);
    EnqueueCollision(registry, eventQueue);
    HandleAIMovement(registry);
    // After the pan, and before rendering: streaming reacts to where the camera
    // now points, so the chunks it just scrolled onto exist by the time they are
    // drawn. Running it ahead of PanCamera would show a blank strip for a frame.
    StreamChunks(registry, Resources.World, Resources.Rendering.Camera);
    // Immediately after streaming, which is the only point in the frame where
    // the list of chunks it just loaded is still standing.
    PopulateHerds(registry, Resources.World, Resources.Rendering.Camera, Resources.Random);
    HandleCollision(registry, eventQueue);
    RenderCanvas(registry, Resources.Rendering);
    eventQueue.Clear();
}
export function Teardown(disposalFunctions) {
    disposalFunctions.forEach((dispose) => dispose());
}
/**
 * Bootstraps the game onto a canvas and drives it with requestAnimationFrame.
 * Returns a teardown function that stops the loop and removes all listeners.
 */
export function StartGame(canvasElement) {
    const resources = new Resources(new RenderingResources(canvasElement), CreateWorldStreamingResources());
    const context = Initialization(resources);
    // The canvas must be focusable to receive keydown events.
    if (!canvasElement.hasAttribute("tabindex"))
        canvasElement.tabIndex = 0;
    let frameHandle = 0;
    let running = true;
    // requestAnimationFrame hands the callback the frame's timestamp, which is
    // what the tick length is measured from -- Date.now would also pick up any
    // delay between the frame being scheduled and this callback running.
    const tick = (frameMilliseconds) => {
        if (!running)
            return;
        context.resources.Time.Advance(frameMilliseconds);
        GameLoop(context.registry, context.eventQueue, context.resources);
        frameHandle = requestAnimationFrame(tick);
    };
    frameHandle = requestAnimationFrame(tick);
    return () => {
        running = false;
        cancelAnimationFrame(frameHandle);
        Teardown(context.disposalFunctions);
    };
}
//# sourceMappingURL=Game.js.map