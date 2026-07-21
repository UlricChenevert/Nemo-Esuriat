import { BackgroundLayer } from "../Configuration/DisplayConstants.ts";
import { AiSearchDepth, CurrentGameMode } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { IsCurrentTurn } from "../Contracts/IsCurrentTurn.ts";
import { IsPlayer } from "../Contracts/IsPlayer.ts";
import { SelectionState } from "../Contracts/IsSelected.ts";
import { Layer } from "../Contracts/Layer.ts";
import { Position } from "../Contracts/Position.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { IsGameOver } from "../Utilities/GameStateUtilities.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";
import { FindBestMove } from "./Ai/Search.ts";
import { HasPendingPromotion } from "./HandlePromotionChoice.ts";

/**
 * Drives the computer side. When it is the turn of a conscious side that carries no
 * IsPlayer, it searches for a move and stages it exactly as a human click would — a
 * SelectionState on the moving side — so HandleMovement (next in the loop) validates and
 * plays it through the identical path. The AI gets no shortcut around the rules.
 */
export function HandleAiTurn (registry : IRegistry, _eventQueue : IEventQueue) {
    if (CurrentGameMode !== "vs-ai") return
    if (IsGameOver(registry)) return
    if (HasPendingPromotion(registry)) return

    let side : Entity | undefined
    registry.ForEachEntityWith([IsCurrentTurn], (entity)=>{ side ??= entity })

    if (side === undefined) return
    // A side with a human at the controls moves itself.
    if (registry.GetComponent(side, IsPlayer) !== undefined) return
    // A move is already staged; let HandleMovement consume it before searching again.
    if (registry.GetComponent(side, SelectionState) !== undefined) return

    const move = FindBestMove(registry, side, AiSearchDepth)

    if (move === undefined) return

    const destinationTile = FindTileAt(registry, move.to)

    if (destinationTile === undefined) return

    registry.RegisterEntity(side, SelectionState, new SelectionState(move.piece, destinationTile))
}

/**
 * The board tile occupying `square`. HandleMovement reads the destination's Position off
 * an entity, and the tile is the one thing guaranteed present on every square whether or
 * not a piece stands there.
 */
function FindTileAt (registry : IRegistry, square : Position) : Entity | undefined {
    let tile : Entity | undefined

    registry.ForEachEntityWith([Position, Layer], (entity, position, layer)=>{
        if (tile !== undefined) return
        if (layer.layerIndex !== BackgroundLayer) return
        if (isSamePosition(position, square)) tile = entity
    })

    return tile
}
