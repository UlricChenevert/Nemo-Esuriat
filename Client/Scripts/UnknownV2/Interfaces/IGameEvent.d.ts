export declare const AllEvents: readonly ["KeyboardEvent", "ClickEvent", "CollisionEvent", "MovementEvent", "UnitDestroyed", "SelectionUpdate", "PromotionCompleted"];
type GameEvent = typeof AllEvents[number];
export interface IGameEvent {
    readonly type: GameEvent;
}
export {};
//# sourceMappingURL=IGameEvent.d.ts.map