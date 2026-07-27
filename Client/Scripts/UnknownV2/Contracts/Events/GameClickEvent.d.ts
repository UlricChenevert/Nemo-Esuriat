import type { IGameEvent } from "../../Interfaces/IGameEvent.ts";
import type { Position } from "../Components/Position.ts";
import type { Camera } from "../SystemResources.ts";
export declare class GameClickEvent implements IGameEvent {
    readonly type = "ClickEvent";
    /**
     * WORLD space, not screen space.
     *
     * Every consumer compares this against entity positions or writes it into a
     * TargetLocation, all of which are world coordinates. Leaving it in screen
     * space -- which it was until the camera could pan -- meant clicking the same
     * visible tile twice commanded two different destinations.
     */
    position: Position;
    constructor(pointerEvent: MouseEvent, canvasElement: HTMLCanvasElement, camera: Camera);
}
//# sourceMappingURL=GameClickEvent.d.ts.map