export class GameMovementEvent {
    ControllingEntity;
    MovingEntity;
    OldPosition;
    NewPosition;
    type = "MovementEvent";
    constructor(ControllingEntity, MovingEntity, OldPosition, NewPosition) {
        this.ControllingEntity = ControllingEntity;
        this.MovingEntity = MovingEntity;
        this.OldPosition = OldPosition;
        this.NewPosition = NewPosition;
    }
}
//# sourceMappingURL=MovementEvent.js.map