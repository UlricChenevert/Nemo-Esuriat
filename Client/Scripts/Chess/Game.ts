import type { Resources } from "./Contracts/SystemResources";
import type { IEventQueue } from "./Interfaces/IEventQueue";
import type { IRegistry } from "./Interfaces/IRegistry";
import { HandleCollision } from "./Systems/HandleCollision";
import {  HandleInputEvents } from "./Systems/HandleInputEvents";
import { HandleMovement } from "./Systems/HandleMovement";
import { RenderCanvas } from "./Systems/RenderCanvas";
import { HashMapComponentRegistry } from "./Systems/ComponentRegistry";
import { Layer } from "./Contracts/Layer";
import { Position } from "./Contracts/Position";
import { Representation } from "./Contracts/Representation";
import { LinkedList } from "./libraries/FastList/FastList";
import { BuildScene } from "./Systems/BuildBoard";
import { EventQueue } from "./Systems/EventQueue";
import { GlobalRegistry } from "./Systems/Registry";
import { GameKeyboardEvent } from "./Contracts/KeyBoardEvent";
import type { IDispose } from "./Interfaces/IDispose";
import { GameClickEvent } from "./Contracts/GameClickEvent";
import { IsSelected } from "./Contracts/IsSelected";
import { IsCollidable } from "./Contracts/IsCollideable";
import { IsMoveable } from "./Contracts/IsMovable";
import { IsSelectable } from "./Contracts/IsSelectible";
import { IsPlayer } from "./Contracts/IsPlayer";
import { IsConscious } from "./Contracts/IsConcious";
import { EntityBuilder } from "./Systems/EntityBuilder";

export function Initialization (resources: Resources) : IDispose[] {
    const registry = new GlobalRegistry()
    const eventQueue = new EventQueue(new LinkedList())
    const disposalFunctions : IDispose[] = []

    registry
        .RegisterComponentRegistry(Position, new HashMapComponentRegistry(Position))
        .RegisterComponentRegistry(Layer, new HashMapComponentRegistry(Layer))
        .RegisterComponentRegistry(Representation, new HashMapComponentRegistry(Representation))
        .RegisterComponentRegistry(IsSelected, new HashMapComponentRegistry(IsSelected))
        .RegisterComponentRegistry(IsCollidable, new HashMapComponentRegistry(IsCollidable))
        .RegisterComponentRegistry(IsMoveable, new HashMapComponentRegistry(IsMoveable))
        .RegisterComponentRegistry(IsSelectable, new HashMapComponentRegistry(IsSelectable))
        .RegisterComponentRegistry(IsPlayer, new HashMapComponentRegistry(IsPlayer))
        .RegisterComponentRegistry(IsConscious, new HashMapComponentRegistry(IsConscious))
    
    
    BuildScene(registry)

    new EntityBuilder(registry)
        .AddIsConsciousness(true)

    new EntityBuilder(registry)
        .AddIsConsciousness(false)
    
    const keyEventListener = (keyEvent: KeyboardEvent)=>{eventQueue.EnqueueEvent(new GameKeyboardEvent(keyEvent))}
    const clickEventListener = (event: PointerEvent)=>{eventQueue.EnqueueEvent(new GameClickEvent(event, resources.Rendering.canvasElement))}

    resources.Rendering.canvasElement.addEventListener("keydown", keyEventListener)
    resources.Rendering.canvasElement.addEventListener("pointerdown", clickEventListener)

    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("keydown", keyEventListener))
    disposalFunctions.push(()=>resources.Rendering.canvasElement.removeEventListener("pointerdown", clickEventListener))

    return disposalFunctions
}

export function GameLoop (registry : IRegistry, eventQueue : IEventQueue, Resources : Resources) {
    HandleInputEvents(registry, eventQueue)
    HandleMovement(registry, eventQueue) // if there are two selected entities, try moving and check against validation
    
    HandleCollision(registry, eventQueue)
    
    RenderCanvas(registry, Resources.Rendering)
    eventQueue.Clear()
}

export function Teardown (disposalFunctions : IDispose[]) {
    disposalFunctions.forEach((dispose)=>dispose())
}