import type { IGameEvent } from "../Interfaces/IGameEvent";
import type { Color } from "./Color";

export class UnitDestroyedEvent implements IGameEvent {
    readonly type = "UnitDestroyed"

    constructor (public UnitType : string, public color : Color) {}
}