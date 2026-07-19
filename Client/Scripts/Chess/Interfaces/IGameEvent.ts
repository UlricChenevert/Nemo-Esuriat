export const AllEvents = ["KeyboardEvent", "ClickEvent", "CollisionEvent"] as const;

type GameEvent = typeof AllEvents[number]; 

export interface IGameEvent {
    readonly type: GameEvent;
}