import { CameraPanSpeed } from "../Configuration/GameConstants.ts";
import type { GameAction } from "../Contracts/Actions/GameActions.ts";
import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import { Position } from "../Contracts/Components/Position.ts";
import type { InputResources, TimeResources } from "../Contracts/SystemResources.ts";
import { IsCamera } from "../Contracts/Tags/IsCamera.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * Pan direction per action.
 *
 * Actions, not key codes: which key produces PanCameraUp is KeyBindings'
 * business, and the camera has no opinion on it. This is what makes the pan keys
 * rebindable without touching this file, and what lets a menu take them away by
 * claiming the action on a higher input layer.
 *
 * Y grows downward, matching how RenderCanvas maps a tile to a canvas row, so
 * "up" is negative.
 */
export const PanByAction : Partial<Record<GameAction, { deltaX : number, deltaY : number }>> = {
    PanCameraUp: { deltaX: 0, deltaY: -1 },
    PanCameraDown: { deltaX: 0, deltaY: 1 },
    PanCameraLeft: { deltaX: -1, deltaY: 0 },
    PanCameraRight: { deltaX: 1, deltaY: 0 }
}

/** The actions a camera entity must claim for this system to be able to move it. */
export const CameraActions : GameAction[] = ["PanCameraUp", "PanCameraDown", "PanCameraLeft", "PanCameraRight"]

/**
 * Scrolls the viewport while a pan action is held.
 *
 * The camera is free: it goes where the input puts it and nothing pulls it back
 * to the player. Units are commanded by clicking rather than walked directly, so
 * the view and the thing being controlled are separate concerns -- an entity can
 * be sent somewhere off screen while the player watches elsewhere.
 *
 * Held actions rather than one nudge per keystroke, because the browser sends a
 * single keydown and then nothing until release: reacting per event would tie
 * scroll speed to the OS key-repeat rate, which the game does not control and
 * which pauses for half a second before the first repeat.
 *
 * This used to drain the event queue and maintain the held-key set itself.
 * ResolveInputActions owns both now, so the camera reads only its own
 * ActionListener -- which means a blackout layer under a menu stops the pan
 * without this system knowing menus exist.
 */
export function PanCamera (registry : IRegistry, time : TimeResources) {
    registry.ForEachEntityWith([IsCamera, Position, ActionListener], (_entity, _isCamera, cameraPosition, listener) => {
        let totalDeltaX = 0
        let totalDeltaY = 0

        for (const action of listener.held) {
            const pan = PanByAction[action]

            if (pan === undefined) continue

            totalDeltaX += pan.deltaX
            totalDeltaY += pan.deltaY
        }

        if (totalDeltaX === 0 && totalDeltaY === 0) return

        // Normalized so holding two keys pans diagonally at the same speed as one
        // key pans straight, rather than sqrt(2) times faster.
        const magnitude = Math.hypot(totalDeltaX, totalDeltaY)
        const panDistance = CameraPanSpeed * time.deltaSeconds

        cameraPosition.x += (totalDeltaX / magnitude) * panDistance
        cameraPosition.y += (totalDeltaY / magnitude) * panDistance
    })
}

/**
 * Forgets every held key.
 *
 * Call when the canvas loses focus: the keyup lands on whatever took focus
 * instead, so without this the camera would scroll forever after alt-tabbing
 * away mid-pan. Clearing the physical set is enough -- ResolveInputActions
 * rebuilds every listener's held actions from it each frame.
 */
export function ReleaseAllKeys (input : InputResources) {
    input.heldKeyCodes.clear()
}
