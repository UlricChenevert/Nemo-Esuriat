import { GameOver } from "../Contracts/GameOver.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * Whether the game has already been decided. The GameOver tag is written by
 * HandleWinCondition onto the side that ran out of legal moves; every system that
 * would otherwise keep accepting play has to check it, so the scan lives here rather
 * than being repeated at each call site.
 */
export function IsGameOver (registry : IRegistry) : boolean {
    let decided = false

    registry.ForEachEntityWith([GameOver], ()=>{ decided = true })

    return decided
}
