import { OpenPauseMenu } from "../Configuration/Menus.ts";
import type { GameAction } from "../Contracts/Actions/GameActions.ts";
import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";

/**
 * The actions a player entity claims.
 *
 * Interaction, not movement: units are commanded by clicking, and the camera
 * moves under its own listener. What is left is the player asking the game for
 * something -- pausing, and interacting with whatever they are standing on.
 */
export const PlayerActions : GameAction[] = ["OpenMenu", "Interact"]

/**
 * Turns the player's triggered actions into whatever they mean.
 *
 * Triggered rather than held throughout: these are all one-per-keystroke, and a
 * held Escape that reopened the pause menu at the OS repeat rate would be
 * unusable.
 */
export function HandlePlayerActions (context : ISystemContext) {
    const { registry } = context

    // Collected first: opening a menu creates entities, and the registry only
    // promises that removing the entity currently being visited is safe.
    const players : Entity[] = []

    registry.ForEachEntityWith([IsPlayer, ActionListener], (player) => { players.push(player) })

    for (const player of players) {
        const listener = registry.GetComponent(player, ActionListener)

        if (listener === undefined) continue

        if (listener.triggered.has("OpenMenu")) {
            OpenPauseMenu(context)

            // One menu, however many players claimed the action. Anything after
            // this would be acting on a frame that is now a menu frame.
            return
        }
    }
}
