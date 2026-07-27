import type { Camera, InputResources, TimeResources } from "../Contracts/SystemResources.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
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
export declare function PanCamera(eventQueue: IEventQueue, input: InputResources, camera: Camera, time: TimeResources): void;
/**
 * Forgets every held key.
 *
 * Call when the canvas loses focus: the keyup lands on whatever took focus
 * instead, so without this the camera would scroll forever after alt-tabbing
 * away mid-pan.
 */
export declare function ReleaseAllKeys(input: InputResources): void;
//# sourceMappingURL=PanCamera.d.ts.map