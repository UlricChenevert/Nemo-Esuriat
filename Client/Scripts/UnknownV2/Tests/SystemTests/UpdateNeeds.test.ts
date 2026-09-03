import { describe, it, expect } from "vitest";
import { AnimalSpeed } from "../../Configuration/GameConstants.ts";
import {
    CollectionGainByNeed, FoodDrainPerSecond, HerdState, MigrateGoalExpirySeconds, NeedKind,
    SleepDrainPerSecond, SleepRecoveryPerSecond, WaterDrainPerSecond
} from "../../Configuration/HerdConstants.ts";
import { CollectingResource } from "../../Contracts/Components/CollectingResource.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { TimeResources } from "../../Contracts/SystemResources.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { UpdateNeeds } from "../../Systems.Gameloop/UpdateNeeds.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

function TickOf(seconds : number) {
    const time = new TimeResources();

    time.deltaSeconds = seconds;

    return time;
}

/** A herd of one animal, so a member's needs can be watched in isolation. */
function BuildHerdOfOne(state : number = HerdState.Forage) {
    const registry = BuildTestRegistry();

    const owner = new EntityBuilder(registry).GetEntity();
    const goal = new HerdGoal(state);

    registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
    registry.RegisterEntity(owner, HerdGoal, goal);

    const member = new EntityBuilder(registry)
        .AddPosition(new Position(50, 50))
        .AddMovement(AnimalSpeed)
        .AddNeeds()
        .AddOwner(owner)
        .GetEntity();

    return {registry, owner, goal, member, needs : registry.GetComponent(member, Needs)!};
}

function Advance(registry : GlobalRegistry, seconds : number, ticks = 1) {
    for (let tick = 0; tick < ticks; tick++) UpdateNeeds(registry, TickOf(seconds));
}

describe("draining appetites", () => {
    it("runs food and water down over time", () => {
        const {registry, needs} = BuildHerdOfOne();

        Advance(registry, 1);

        expect(needs.Get(NeedKind.Food)).toBeCloseTo(1 - FoodDrainPerSecond);
        expect(needs.water).toBeCloseTo(1 - WaterDrainPerSecond);
    });

    it("makes a herd thirsty before it is hungry", () => {
        // Thirst tripping first is what makes water the usual reason a herd travels.
        expect(WaterDrainPerSecond).toBeGreaterThan(FoodDrainPerSecond);
    });

    it("drains at the same rate whatever the frame rate", () => {
        // Draining by a fixed amount per FRAME rather than per second would have a herd
        // starve more than twice as fast on a 144Hz display as on a 60Hz one.
        const slow = BuildHerdOfOne();
        const fast = BuildHerdOfOne();

        Advance(slow.registry, 1, 1);
        Advance(fast.registry, 1 / 60, 60);

        expect(fast.needs.Get(NeedKind.Food)).toBeCloseTo(slow.needs.Get(NeedKind.Food));
        expect(fast.needs.water).toBeCloseTo(slow.needs.water);
        expect(fast.needs.sleep).toBeCloseTo(slow.needs.sleep);
    });

    it("never drains a need below empty", () => {
        // An unclamped need silently disables its own hysteresis: a value that has drifted
        // to -40 takes forty times as long to climb back over its exit threshold as it
        // should, and the herd looks like it has forgotten how to stop drinking.
        const {registry, needs} = BuildHerdOfOne();

        Advance(registry, 100, 100);

        expect(needs.Get(NeedKind.Food)).toBe(0);
        expect(needs.water).toBe(0);
        expect(needs.sleep).toBe(0);
    });

    it("never tops a need past full", () => {
        const {registry, goal, needs} = BuildHerdOfOne(HerdState.Sleep);

        expect(goal.State).toBe(HerdState.Sleep);

        Advance(registry, 100, 100);

        expect(needs.sleep).toBe(1);
    });
});

describe("metabolism", () => {
    it("burns through appetites faster at a higher rate", () => {
        const ordinary = BuildHerdOfOne();
        const ravenous = BuildHerdOfOne();

        ravenous.needs.metabolismRate = 2;

        Advance(ordinary.registry, 1);
        Advance(ravenous.registry, 1);

        expect(1 - ravenous.needs.Get(NeedKind.Food)).toBeCloseTo((1 - ordinary.needs.Get(NeedKind.Food)) * 2);
        expect(1 - ravenous.needs.water).toBeCloseTo((1 - ordinary.needs.water) * 2);
    });

    it("freezes appetites at a rate of zero", () => {
        const {registry, needs} = BuildHerdOfOne();

        needs.metabolismRate = 0;

        Advance(registry, 10, 10);

        expect(needs.Get(NeedKind.Food)).toBe(1);
        expect(needs.water).toBe(1);
    });

    it("scales the drain but not the recovery", () => {
        // Metabolism is what CONSUMES. Scaling recovery too would make a fast metabolism
        // mean "sleeps better" as well as "starves sooner".
        const {registry, needs} = BuildHerdOfOne(HerdState.Sleep);

        needs.metabolismRate = 4;
        needs.sleep = 0.2;

        Advance(registry, 1);

        expect(needs.sleep).toBeCloseTo(0.2 + SleepRecoveryPerSecond);
    });

    it("leaves an ordinary body on the tuned rates", () => {
        // The constants describe an ordinary animal, so a default rate must not change them.
        const {registry, needs} = BuildHerdOfOne();

        expect(needs.metabolismRate).toBe(1);

        Advance(registry, 1);

        expect(needs.Get(NeedKind.Food)).toBeCloseTo(1 - FoodDrainPerSecond);
    });
});

describe("sleeping", () => {
    it("runs sleep down while the herd is awake", () => {
        const {registry, needs} = BuildHerdOfOne(HerdState.Forage);

        Advance(registry, 1);

        expect(needs.sleep).toBeCloseTo(1 - SleepDrainPerSecond);
    });

    it("recovers sleep while the herd is asleep", () => {
        const {registry, needs} = BuildHerdOfOne(HerdState.Sleep);

        needs.sleep = 0.2;

        Advance(registry, 1);

        expect(needs.sleep).toBeCloseTo(0.2 + SleepRecoveryPerSecond);
    });

    it("recovers faster than it drains, so a night is shorter than a day", () => {
        expect(SleepRecoveryPerSecond).toBeGreaterThan(SleepDrainPerSecond);
    });

    it("follows the owning herd's state, not the animal's own", () => {
        // Sleep is a herd-level decision that individuals act out, so whether an animal
        // recovers depends on its owner.
        const {registry, goal, needs} = BuildHerdOfOne(HerdState.Forage);

        needs.sleep = 0.5;

        Advance(registry, 1);
        const whileAwake = needs.sleep;

        goal.State = HerdState.Sleep;
        Advance(registry, 1);

        expect(whileAwake).toBeLessThan(0.5);
        expect(needs.sleep).toBeGreaterThan(whileAwake);
    });

    it("drains sleep for an animal belonging to no herd at all", () => {
        const registry = BuildTestRegistry();

        const loner = new EntityBuilder(registry).AddPosition(new Position(0, 0)).AddNeeds().GetEntity();

        expect(() => Advance(registry, 1)).not.toThrow();
        expect(registry.GetComponent(loner, Needs)!.sleep).toBeCloseTo(1 - SleepDrainPerSecond);
    });
});

describe("finishing a collection", () => {
    it("counts the timer down", () => {
        const {registry, member} = BuildHerdOfOne();

        registry.RegisterEntity(member, CollectingResource, new CollectingResource(NeedKind.Water, 4));

        Advance(registry, 1);

        expect(registry.GetComponent(member, CollectingResource)!.remainingSeconds).toBeCloseTo(3);
    });

    it("pays the need and clears the component when it completes", () => {
        const {registry, member, needs} = BuildHerdOfOne();

        needs.water = 0.1;
        registry.RegisterEntity(member, CollectingResource, new CollectingResource(NeedKind.Water, 1));

        Advance(registry, 1);

        expect(needs.water).toBeCloseTo(0.1 + CollectionGainByNeed[NeedKind.Water]! - WaterDrainPerSecond);
        expect(registry.GetComponent(member, CollectingResource)).toBeUndefined();
    });

    it("pays exactly once, however many ticks follow", () => {
        // Paying per tick instead of on completion would have one drink fill an animal
        // forever, and the herd would never have a reason to travel again.
        //
        // Measured against a control herd that never collected, rather than against
        // arithmetic on the drain rate. The point being pinned is the number of payouts,
        // and a hand-computed figure here would only be re-deriving the drain bookkeeping
        // -- and would break every time the rates were retuned.
        const drinker = BuildHerdOfOne();
        const control = BuildHerdOfOne();

        // Low enough that one payout cannot reach the ceiling: clamping at full is its
        // own test, and letting it interfere here would hide a second payout.
        drinker.needs.water = 0.2;
        control.needs.water = 0.2;

        drinker.registry.RegisterEntity(
            drinker.member, CollectingResource, new CollectingResource(NeedKind.Water, 0.5)
        );

        Advance(drinker.registry, 1, 5);
        Advance(control.registry, 1, 5);

        expect(drinker.needs.water - control.needs.water)
            .toBeCloseTo(CollectionGainByNeed[NeedKind.Water]!);
    });

    it("pays nothing to a collector with no appetites", () => {
        const registry = BuildTestRegistry();

        const thing = new EntityBuilder(registry).AddPosition(new Position(0, 0)).GetEntity();

        registry.RegisterEntity(thing, CollectingResource, new CollectingResource(NeedKind.Water, 0.5));

        expect(() => Advance(registry, 1)).not.toThrow();
        expect(registry.GetComponent(thing, CollectingResource)).toBeUndefined();
    });

    it("clears several finished collections in one pass", () => {
        // The removal happens during iteration, which is only safe because the query is
        // on CollectingResource alone -- so it is necessarily the iterated store and the
        // delete is the documented self-delete. Querying [CollectingResource, Needs] would
        // make that depend on which store happened to be smaller.
        const registry = BuildTestRegistry();

        const collectors = [0, 1, 2, 3, 4].map((index) => {
            const entity = new EntityBuilder(registry)
                .AddPosition(new Position(index, 0))
                .AddNeeds(new Needs(0, 0, 1))
                .GetEntity();

            registry.RegisterEntity(entity, CollectingResource, new CollectingResource(NeedKind.Food, 0.5));

            return entity;
        });

        Advance(registry, 1);

        collectors.forEach((entity) => {
            expect(registry.GetComponent(entity, CollectingResource)).toBeUndefined();
            expect(registry.GetComponent(entity, Needs)!.Get(NeedKind.Food)).toBeGreaterThan(0);
        });
    });
});

describe("ageing a migration goal", () => {
    it("counts down while the herd is travelling", () => {
        const {registry, goal} = BuildHerdOfOne(HerdState.Migrate);

        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;

        Advance(registry, 1);

        expect(goal.DestinationSecondsRemaining).toBeCloseTo(MigrateGoalExpirySeconds - 1);
    });

    it("leaves the destination alone while the herd is not travelling", () => {
        // A herd that stops to graze must not quietly time out the lake it was heading for.
        const {registry, goal} = BuildHerdOfOne(HerdState.Forage);

        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;

        Advance(registry, 5);

        expect(goal.DestinationSecondsRemaining).toBe(MigrateGoalExpirySeconds);
    });

    it("does not count an already expired goal further into the negative", () => {
        const {registry, goal} = BuildHerdOfOne(HerdState.Migrate);

        goal.DestinationSecondsRemaining = 0;

        Advance(registry, 5, 3);

        expect(goal.DestinationSecondsRemaining).toBe(0);
    });

    it("does not throw for a herd with no destination at all", () => {
        const {registry} = BuildHerdOfOne(HerdState.Migrate);

        expect(() => Advance(registry, 1)).not.toThrow();
    });
});

describe("the Needs component", () => {
    it("reads each need back by kind", () => {
        const needs = new Needs(0.1, 0.2, 0.3);

        expect(needs.Get(NeedKind.Food)).toBe(0.1);
        expect(needs.Get(NeedKind.Water)).toBe(0.2);
        expect(needs.Get(NeedKind.Sleep)).toBe(0.3);
    });

    it("clamps in one place, so no caller can let a need escape its range", () => {
        expect(new Needs(0.5).Add(NeedKind.Food, -10).Get(NeedKind.Food)).toBe(0);
        expect(new Needs(0.5).Add(NeedKind.Food, 10).Get(NeedKind.Food)).toBe(1);
    });

    it("ranks water and food for travel but never sleep", () => {
        // Sleep is not something a herd can walk to, so ranking it alongside the two that
        // are would send a tired herd off toward a destination that does not exist.
        expect(new Needs(0.9, 0.2, 0.9).ScarcestTravelNeed()).toBe(NeedKind.Water);
        expect(new Needs(0.2, 0.9, 0.9).ScarcestTravelNeed()).toBe(NeedKind.Food);
        expect(new Needs(0.9, 0.9, 0.01).ScarcestTravelNeed()).not.toBe(NeedKind.Sleep);
    });
});
