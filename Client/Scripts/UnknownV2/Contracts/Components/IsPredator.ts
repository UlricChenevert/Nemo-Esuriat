import { DefaultThreatSeverity } from "../../Configuration/HerdConstants.ts";

/**
 * Marks an entity that herds treat as a threat, and says how badly.
 *
 * Severity is its own number rather than something derived from IsMoveable.speed.
 * How frightening a thing is and how fast it happens to walk are different facts,
 * and a slow ambusher is exactly the case where reading the speed gives the wrong
 * answer -- it is more dangerous than the speed suggests, not less.
 *
 * Severities SUM across every threat near a herd, and it is the total that decides
 * whether the herd bunches together or scatters. That is what makes numbers matter
 * on their own: one hyena is something an animal survives by running in its own
 * direction, while ten of the same hyena is something a herd survives by presenting
 * a wall. Weighing a wolf heavier than a dog then needs no second rule.
 *
 * A person carries this too, at the default severity, so a herd shies away from
 * people through the same code path it flees a predator through rather than through
 * a second parallel scan. Human stays a pure identity tag and says nothing about
 * danger.
 */
export class IsPredator {
    constructor(public severity = DefaultThreatSeverity) {}
}
