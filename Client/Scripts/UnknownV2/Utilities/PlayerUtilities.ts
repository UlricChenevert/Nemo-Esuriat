import type { Entity } from "../Contracts/Components/Entity.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Human } from "../Contracts/Tags/Human.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * The position of the acting player, or undefined when there is none.
 *
 * Both the camera and chunk streaming need this every frame, so it lives here
 * rather than being duplicated in each. If more than one entity carries the
 * IsPlayer tag the first found wins, matching how HandleInputEvents picks the
 * acting player.
 */
export function FindPlayerPosition(registry : IRegistry) : Position | undefined {
    let playerPosition : Position | undefined

    // ForEachEntityWith has no early exit, so this keeps the first match rather
    // than the last.
    registry.ForEachEntityWith([IsPlayer, Position], (_entity, _isPlayer, position) => { playerPosition ??= position })

    return playerPosition
}

/**
 * The acting player, or undefined when there is none.
 *
 * First found wins, matching FindPlayerPosition and HandleInputEvents. The player
 * entity is a bodiless controller: it holds the tag, the input listener and the
 * selection, and owns the bodies that actually stand somewhere.
 */
export function FindActingPlayer(registry : IRegistry) : Entity | undefined {
    let actingPlayer : Entity | undefined

    registry.ForEachEntityWith([IsPlayer], (player) => { actingPlayer ??= player })

    return actingPlayer
}

/**
 * The live human bodies `player` controls.
 *
 * Owns is not a list of bodies -- it holds movement flags, text glyphs and
 * anything else AddOwner attached, and it is never pruned when a child dies, so
 * entries can be stale. Both filters are load-bearing, and they are applied here
 * once rather than by each caller, the way SenseHerd owns the equivalent rule for
 * herd members.
 *
 * The player is deliberately not identified with any one body. Losing the body you
 * were driving is a setback; having none left is the end of the game, and only
 * this can tell those two apart.
 */
export function FindPlayerHumans(registry : IRegistry, player : Entity) : Entity[] {
    const owns = registry.GetComponent(player, Owns)

    if (!owns) return []

    return owns.entities.filter((owned)=>
        registry.IsAlive(owned) && registry.GetComponent(owned, Human) !== undefined
    )
}
