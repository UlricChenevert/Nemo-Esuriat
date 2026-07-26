import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import { Position } from "../Components/Position.ts";
export declare class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";
    position: Position;
    constructor(pointerEvent: MouseEvent, canvasElement: HTMLCanvasElement);
}
//# sourceMappingURL=GameClickEvent.d.ts.map