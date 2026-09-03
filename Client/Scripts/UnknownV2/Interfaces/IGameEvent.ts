export const AllEvents = ["KeyboardEvent", "ClickEvent", "CollisionEvent", "MovementEvent", "UnitDestroyed", "EntityDied", "SelectionUpdate", "PromotionCompleted", "GameLoopChanged"] as const;

type GameEvent = typeof AllEvents[number]; 

export interface IGameEvent {
    readonly type: GameEvent;
}