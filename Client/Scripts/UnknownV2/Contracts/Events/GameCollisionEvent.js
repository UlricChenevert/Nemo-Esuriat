export class GameCollisionEvent {
    collidingEntity;
    collidedEntity;
    type = "CollisionEvent";
    constructor(collidingEntity, collidedEntity) {
        this.collidingEntity = collidingEntity;
        this.collidedEntity = collidedEntity;
    }
}
//# sourceMappingURL=GameCollisionEvent.js.map