import { Resources, RenderingResources } from "./Contracts/SystemResources.ts";
import type { IEventQueue } from "./Interfaces/IEventQueue.ts";
import type { IRegistry } from "./Interfaces/IRegistry.ts";
import { HandleCollision } from "./Systems/HandleCollision.ts";
import {  HandleInputEvents } from "./Systems/HandleInputEvents.ts";
import { HandleMovement } from "./Systems/HandleMovement.ts";
import { RenderCanvas } from "./Systems/RenderCanvas.ts";
import { HashMapComponentRegistry } from "./Systems/ComponentRegistry.ts";
import { Layer } from "./Contracts/Layer.ts";
import { Position } from "./Contracts/Position.ts";
import { Representation } from "./Contracts/Representation.ts";
import { LinkedList } from "./libraries/FastList/FastList.ts";
import { BuildScene } from "./Systems/BuildBoard.ts";
import { EventQueue } from "./Systems/EventQueue.ts";
import { GlobalRegistry } from "./Systems/Registry.ts";
import { GameKeyboardEvent } from "./Contracts/KeyBoardEvent.ts";
import type { IDispose } from "./Interfaces/IDispose.ts";
import { GameClickEvent } from "./Contracts/GameClickEvent.ts";
import { SelectionState } from "./Contracts/IsSelected.ts";
import { IsCollidable } from "./Contracts/IsCollideable.ts";
import { IsMoveable } from "./Contracts/IsMovable.ts";
import { IsSelectable } from "./Contracts/IsSelectible.ts";
import { IsPlayer } from "./Contracts/IsPlayer.ts";
import { IsConscious } from "./Contracts/IsConcious.ts";
import { EntityBuilder } from "./Systems/EntityBuilder.ts";
import { OwnedBy } from "./Contracts/OwnedBy.ts";
import { HandleChessCollision } from "./Systems/HandleChessCollision.ts";
import { IsChessPiece } from "./Contracts/IsChessPiece.ts";
import { Owns } from "./Contracts/Owns.ts";
import { HandleWinCondition } from "./Systems/HandleWinCondition.ts";
import { IsCurrentTurn } from "./Contracts/IsCurrentTurn.ts";
import { HandleTurnSwitching } from "./Systems/HandleTurnSwitching.ts";
import { MovementRules } from "./Contracts/MovementRules.ts";
import { IsGoingDown } from "./Contracts/IsGoingDown.ts";
import { HasMoved } from "./Contracts/HasMoved.ts";
import { JustDoubleStepped } from "./Contracts/JustDoubleStepped.ts";
import { GameOver } from "./Contracts/GameOver.ts";
import { HandleSpecialMoves } from "./Systems/HandleSpecialMoves.ts";
import { HandleColorChanges } from "./Systems/HandleColorChanges.ts";
import { PendingPromotion } from "./Contracts/PendingPromotion.ts";
import { PromotionOption } from "./Contracts/PromotionOption.ts";
import { HandlePromotionChoice } from "./Systems/HandlePromotionChoice.ts";
import { MoveHint } from "./Contracts/MoveHint.ts";
import { HandleMoveHints } from "./Systems/HandleMoveHints.ts";

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
        .RegisterComponentRegistry(SelectionState, new HashMapComponentRegistry(SelectionState))
        .RegisterComponentRegistry(IsCollidable, new HashMapComponentRegistry(IsCollidable))
        .RegisterComponentRegistry(IsMoveable, new HashMapComponentRegistry(IsMoveable))
        .RegisterComponentRegistry(IsSelectable, new HashMapComponentRegistry(IsSelectable))
        .RegisterComponentRegistry(IsPlayer, new HashMapComponentRegistry(IsPlayer))
        .RegisterComponentRegistry(IsConscious, new HashMapComponentRegistry(IsConscious))
        .RegisterComponentRegistry(OwnedBy, new HashMapComponentRegistry(OwnedBy))
        .RegisterComponentRegistry(IsChessPiece, new HashMapComponentRegistry(IsChessPiece))
        .RegisterComponentRegistry(Owns, new HashMapComponentRegistry(Owns))
        .RegisterComponentRegistry(IsCurrentTurn, new HashMapComponentRegistry(IsCurrentTurn))
        .RegisterComponentRegistry(MovementRules, new HashMapComponentRegistry(MovementRules))
        .RegisterComponentRegistry(IsGoingDown, new HashMapComponentRegistry(IsGoingDown))
        .RegisterComponentRegistry(HasMoved, new HashMapComponentRegistry(HasMoved))
        .RegisterComponentRegistry(JustDoubleStepped, new HashMapComponentRegistry(JustDoubleStepped))
        .RegisterComponentRegistry(GameOver, new HashMapComponentRegistry(GameOver))
        .RegisterComponentRegistry(PendingPromotion, new HashMapComponentRegistry(PendingPromotion))
        .RegisterComponentRegistry(PromotionOption, new HashMapComponentRegistry(PromotionOption))
        .RegisterComponentRegistry(MoveHint, new HashMapComponentRegistry(MoveHint))
    
    BuildScene(registry, new EntityBuilder(registry).AddIsConsciousness(true, true).GetEntity(), new EntityBuilder(registry).AddIsConsciousness(false).GetEntity())

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
    HandleMovement(registry, eventQueue) // if there are two selected entities, try moving and check against validation
    HandleSpecialMoves(registry, eventQueue) // castling rook relocation, en passant capture, promotion
    HandlePromotionChoice(registry, eventQueue) // offers the picker, and applies what it answers

    HandleCollision(registry, eventQueue)
    HandleChessCollision(registry, eventQueue)
    HandleColorChanges(registry, eventQueue)
    HandleMoveHints(registry, eventQueue) // marks the selected piece's legal squares, clears them on release

    // Win detection asks whether the side to move has a reply, so the turn has to have
    // switched first — otherwise it interrogates the player who just moved.
    HandleTurnSwitching(registry, eventQueue)
    HandleWinCondition(registry, eventQueue)

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