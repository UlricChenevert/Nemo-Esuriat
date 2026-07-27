import { CameraPanSpeed } from "../Configuration/GameConstants.ts";
import { GameKeyboardEvent } from "../Contracts/Events/KeyBoardEvent.ts";
import type { Camera, InputResources, TimeResources } from "../Contracts/SystemResources.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";

/**
 * Pan direction per key, keyed by KeyboardEvent.code.
 *
 * Keyed on `code` rather than `key` because that is what GameKeyboardEvent
 * captures, and because it is layout-independent: the key physically where W
 * sits reports "KeyW" whether the layout is QWERTY, AZERTY, or Dvorak.
 *
 * Y grows downward, matching how RenderCanvas maps a tile to a canvas row, so
 * "up" is negative.
 */
const PanByKeyCode : Record<string, { deltaX : number, deltaY : number }> = {
    ArrowUp: { deltaX: 0, deltaY: -1 },
    ArrowDown: { deltaX: 0, deltaY: 1 },
    ArrowLeft: { deltaX: -1, deltaY: 0 },
    ArrowRight: { deltaX: 1, deltaY: 0 },
    KeyW: { deltaX: 0, deltaY: -1 },
    KeyS: { deltaX: 0, deltaY: 1 },
    KeyA: { deltaX: -1, deltaY: 0 },
    KeyD: { deltaX: 1, deltaY: 0 }
}

/**
 * Scrolls the viewport while a pan key is held.
 *
 * The camera is free: it goes where the keyboard puts it and nothing pulls it
 * back to the player. Units are commanded by clicking rather than walked
 * directly, so the view and the thing being controlled are separate concerns --
 * an entity can be sent somewhere off screen while the player watches elsewhere.
 *
 * Held keys rather than one nudge per keystroke, because the browser sends a
 * single keydown and then nothing until release: reacting per event would tie
 * scroll speed to the OS key-repeat rate, which the game does not control and
 * which pauses for half a second before the first repeat.
 */
export function PanCamera (eventQueue : IEventQueue, input : InputResources, camera : Camera, time : TimeResources) {
    for (const keyboardEvent of eventQueue.GetEventsOfType(GameKeyboardEvent)) {
        if (PanByKeyCode[keyboardEvent.code] === undefined) continue

        // A release always lifts the key, whatever modifiers are down: holding W
        // and then tapping ctrl must not stick the camera scrolling forever.
        if (!keyboardEvent.isPressed) {
            input.heldKeyCodes.delete(keyboardEvent.code)
            continue
        }

        // Modified presses belong to browser and OS shortcuts, not to the game.
        if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) continue

        input.heldKeyCodes.add(keyboardEvent.code)
    }

    let totalDeltaX = 0
    let totalDeltaY = 0

    for (const heldKeyCode of input.heldKeyCodes) {
        const pan = PanByKeyCode[heldKeyCode]

        if (pan === undefined) continue

        totalDeltaX += pan.deltaX
        totalDeltaY += pan.deltaY
    }

    if (totalDeltaX === 0 && totalDeltaY === 0) return

    // Normalized so holding two keys pans diagonally at the same speed as one
    // key pans straight, rather than sqrt(2) times faster.
    const magnitude = Math.hypot(totalDeltaX, totalDeltaY)
    const panDistance = CameraPanSpeed * time.deltaSeconds

    camera.worldOriginX += (totalDeltaX / magnitude) * panDistance
    camera.worldOriginY += (totalDeltaY / magnitude) * panDistance
}

/**
 * Forgets every held key.
 *
 * Call when the canvas loses focus: the keyup lands on whatever took focus
 * instead, so without this the camera would scroll forever after alt-tabbing
 * away mid-pan.
 */
export function ReleaseAllKeys (input : InputResources) {
    input.heldKeyCodes.clear()
}
