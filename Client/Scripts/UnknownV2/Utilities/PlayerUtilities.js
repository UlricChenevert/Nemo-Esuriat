import { Position } from "../Contracts/Components/Position.js";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.js";
/**
 * The position of the acting player, or undefined when there is none.
 *
 * Both the camera and chunk streaming need this every frame, so it lives here
 * rather than being duplicated in each. If more than one entity carries the
 * IsPlayer tag the first found wins, matching how HandleInputEvents picks the
 * acting player.
 */
export function FindPlayerPosition(registry) {
    let playerPosition;
    // ForEachEntityWith has no early exit, so this keeps the first match rather
    // than the last.
    registry.ForEachEntityWith([IsPlayer, Position], (_entity, _isPlayer, position) => { playerPosition ??= position; });
    return playerPosition;
}
//# sourceMappingURL=PlayerUtilities.js.map