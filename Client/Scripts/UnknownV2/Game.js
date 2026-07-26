import { CharacterRepresentation, GameColors, PlayerLayer, TileSizePixels } from "./Configuration/DisplayConstants.js";
import { GameWidth } from "./Configuration/GameConstants.js";
import { ChunkCoordinate } from "./Contracts/Components/ChunkCoordinate.js";
import { IsSelectable } from "./Contracts/Components/IsSelectible.js";
import { MultiTileRepresentation } from "./Contracts/Components/MultiTileRepresentation.js";
import { Layer } from "./Contracts/Components/Layer.js";
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
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.js";
import { HandleMovement } from "./Systems.EventHandlers/HandleMovement.js";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.js";
import { EntityBuilder } from "./Systems.Framework/EntityBuilder.js";
import { EventQueue } from "./Systems.Framework/EventQueue.js";
import { GlobalRegistry } from "./Systems.Framework/Registry.js";
import { HandleInputEvents } from "./Systems.Gameloop/HandleInputEvents.js";
import { RenderCanvas } from "./Systems.Gameloop/RenderCanvas.js";
import { CreateWorldStreamingResources } from "./Systems.World/CreateWorldStreamingResources.js";
import { StreamChunks } from "./Systems.World/StreamChunks.js";
import { UpdateCamera } from "./Systems.World/UpdateCamera.js";
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
        .RegisterComponentRegistry(ChunkCoordinate, new HashMapComponentRegistry(ChunkCoordinate));
    const keyEventListener = (keyEvent) => { eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent)); };
    const clickEventListener = (event) => { eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement)); };
    resources.Rendering.canvasElement.addEventListener("keydown", keyEventListener);
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener);
    new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddRepresentation(new Representation(CharacterRepresentation.Character, GameColors.Player))
        .AddTags(true, true, true, true, true)
        .AddLayer(new Layer(PlayerLayer));
    new EntityBuilder(registry)
        .AddPosition(new Position(10, 0))
        .AddRepresentation(new Representation(CharacterRepresentation.NPC, GameColors.NPC))
        .AddLayer(new Layer(PlayerLayer));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("keydown", keyEventListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener));
    return { registry, eventQueue, resources, disposalFunctions };
}
export function GameLoop(registry, eventQueue, Resources) {
    HandleInputEvents(registry, eventQueue);
    HandleMovement(registry, eventQueue);
    HandleCollision(registry, eventQueue);
    // Both react to the position movement just wrote, and both must run before
    // rendering: streaming first so the chunk the player just entered exists,
    // then the camera so it points at where the player actually is. Rendering
    // ahead of either would show a gap for one frame.
    StreamChunks(registry, Resources.World);
    UpdateCamera(registry, Resources.Rendering.Camera);
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
    const tick = () => {
        if (!running)
            return;
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
document.addEventListener("DOMContentLoaded", () => {
    const gameContainer = document.getElementById("GameContainer");
    if (gameContainer === null)
        throw new Error("Could not find game html element!");
    const canvas = document.createElement("canvas");
    // The backing store is the game's native resolution, not the container's
    // size. CSS scales the result up for display, and GameClickEvent scales
    // clicks back down. Sizing from the container would tie the number of
    // drawable pixels to the layout -- and #GameContainer has no height of its
    // own, so clientHeight is 0 and nothing could be drawn at all.
    canvas.width = GameWidth * TileSizePixels;
    canvas.height = GameWidth * TileSizePixels;
    canvas.id = "game";
    canvas.tabIndex = 0;
    gameContainer.append(canvas);
    const stopGame = StartGame(canvas);
    canvas.focus();
    const unloadEventListener = () => {
        stopGame();
        gameContainer.removeChild(canvas);
        window.removeEventListener("beforeunload", unloadEventListener);
    };
    window.addEventListener("beforeunload", unloadEventListener);
});
//# sourceMappingURL=Game.js.map