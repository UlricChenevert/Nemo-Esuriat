import type { IRegistry } from "../Interfaces/IRegistry.ts";
/**
 * Steers every herd member as a boid: shy away from people, hold spacing, match
 * the neighbours' heading, stay with the group, and drift toward the herd's
 * wander target.
 *
 * The system writes TargetLocation and nothing else. HandleMovement owns the
 * actual travel, which is why the steering vector is a short offset from the
 * member's current position rather than a velocity -- its length says how far
 * ahead to aim, and IsMoveable.speed says how fast the member gets there.
 */
export declare function HandleAIMovement(registry: IRegistry): void;
//# sourceMappingURL=HandleAIMovement.d.ts.map