import { Layer } from "./Contracts/Components/Layer.js";
import { Position } from "./Contracts/Components/Position.js";
import { Representation } from "./Contracts/Components/Representation.js";
import { GameClickEvent } from "./Contracts/Events/GameClickEvent.js";
import { GameKeyboardEvent } from "./Contracts/Events/KeyBoardEvent.js";
import { RenderingResources, Resources } from "./Contracts/SystemResources.js";
import { DecidesMovement } from "./Contracts/Tags/DecidesMovement.js";
import { IsCollidable } from "./Contracts/Tags/IsCollideable.js";
import { IsMoveable } from "./Contracts/Tags/IsMovable.js";
import { IsPlayer } from "./Contracts/Tags/IsPlayer.js";
import { LinkedList } from "./libraries/FastList/FastList.js";
import { HandleCollision } from "./Systems.EventHandlers/HandleCollision.js";
import { HandleMovement } from "./Systems.EventHandlers/HandleMovement.js";
import { HashMapComponentRegistry } from "./Systems.Framework/ComponentRegistry.js";
import { EventQueue } from "./Systems.Framework/EventQueue.js";
import { GlobalRegistry } from "./Systems.Framework/Registry.js";
import { HandleInputEvents } from "./Systems.Gameloop/HandleInputEvents.js";
import { RenderCanvas } from "./Systems.Gameloop/RenderCanvas.js";
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
        .RegisterComponentRegistry(DecidesMovement, new HashMapComponentRegistry(DecidesMovement));
    const keyEventListener = (keyEvent) => { eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent)); };
    const clickEventListener = (event) => { eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement)); };
    resources.Rendering.canvasElement.addEventListener("keydown", keyEventListener);
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener);
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("keydown", keyEventListener));
    disposalFunctions.push(() => resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener));
    return { registry, eventQueue, resources, disposalFunctions };
}
export function GameLoop(registry, eventQueue, Resources) {
    HandleInputEvents(registry, eventQueue);
    HandleMovement(registry, eventQueue);
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
    const resources = new Resources(new RenderingResources(canvasElement));
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
    canvas.width = gameContainer.clientWidth;
    canvas.height = gameContainer.clientHeight;
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