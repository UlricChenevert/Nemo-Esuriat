import { Position } from "../Contracts/Components/Position.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
/**
 * The position of the acting player, or undefined when there is none.
 *
 * Both the camera and chunk streaming need this every frame, so it lives here
 * rather than being duplicated in each. If more than one entity carries the
 * IsPlayer tag the first found wins, matching how HandleInputEvents picks the
 * acting player.
 */
export declare function FindPlayerPosition(registry: IRegistry): Position | undefined;
//# sourceMappingURL=PlayerUtilities.d.ts.map