import { describe, it, expect } from "vitest";
import {
    ClumpThreatTotal, GoalScanMaxRadiusTiles, HerdState, HerdStateNames, MigrateEnterThreshold,
    MigrateExitThreshold, MigrateGoalExpirySeconds, NeedKind, ScatterThreatTotal, SleepEnterThreshold,
    SleepExitThreshold
} from "../../Configuration/HerdConstants.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { TerrainKind } from "../../Configuration/DisplayConstants.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { Vector2D } from "../../Contracts/Components/Vector2D.ts";
import type { WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { SpatialHashGrid } from "../../Libraries/Spatial/SpatialHashGrid.ts";
import { EvaluateDecisionTree, TraceDecisionTree } from "../../Utilities/DecisionTree.ts";
import { HerdBehaviours, HerdDecisionTree } from "../../Utilities/HerdGoalDecisions.ts";
import type { HerdContext } from "../../Utilities/HerdSensing.ts";
import { IsDrinkableWater, IsForageGround, IsPassableTerrain } from "../../Utilities/TerrainUtilities.ts";
import {
    BuildGrassWorld, BuildTestWorld, DeepWaterNoise, FlatNoise, GrassNoise, MountainNoise,
    ShallowWaterNoise, ShapedNoise, WithinBand
} from "../TestHelpers/BuildTestWorld.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";

/**
 * A herd context with everything the tree could ask about set to "nothing wrong",
 * and the one thing under test overridden.
 *
 * Built by hand rather than by assembling a registry, a world, a herd and a predator.
 * The tree is a pure function of this object by design -- that is what the sensing /
 * deciding split buys -- so a test that had to simulate its way into a state would be
 * testing the sensing as well, and would be far harder to read.
 */
function MakeContext(overrides : Partial<HerdContext> = {}) : HerdContext {
    const goal = overrides.goal ?? new HerdGoal();

    return {
        owner : 1 as HerdContext["owner"],
        herdOwner : new HerdOwner(),
        goal : goal,
        previousState : goal.State,
        members : [],
        membersByEntity : new Map(),
        distanceQuerier : new SpatialHashGrid(2),
        centroid : new Position(50, 50),
        needs : {hungerUnits : 1, water : 1, sleep : 1},
        scarcestTravelNeed : NeedKind.Water,
        scarcestTravelLevel : 1,
        threatsInRange : [],
        threatTotal : 0,
        isDisturbed : false,
        terrainAvoidance : new Vector2D(0, 0),
        nearestDrinkableWater : undefined,
        nearestForage : undefined,
        claimedTiles : new Set<string>(),
        ...overrides
    };
}

const Decide = (overrides : Partial<HerdContext> = {}) => EvaluateDecisionTree(HerdDecisionTree, MakeContext(overrides));

/** Enough to cross a threshold without landing on it, matching the terrain tests' style. */
const Nudge = 0.0001;

/** A budget that always allows an outward scan, for tests not about rationing. */
const FreeBudget = () => ({remaining : 99});

function ResolveFor(state : number, context : HerdContext, world : WorldStreamingResources, seed = 1) {
    return HerdBehaviours[state as 0]!.ResolveGoal({
        context : context, world : world,
        random : new LinearCongruentialGenerator(seed), scanBudget : FreeBudget()
    });
}

describe("deciding what a herd is doing", () => {
    it("grazes when nothing at all is wrong", () => {
        expect(Decide()).toBe(HerdState.Forage);
    });

    it("reaches every state it can name", () => {
        // The anti-dead-branch test. A tree with a WhenTrue and WhenFalse swapped
        // somewhere still returns plausible answers for most inputs; what it cannot do
        // is reach all five leaves. Every state named in HerdState must be reachable,
        // or the table row for it is dead weight nobody notices.
        const reached = new Set<number>([
            Decide(),
            Decide({threatTotal : ScatterThreatTotal}),
            Decide({threatTotal : ClumpThreatTotal}),
            Decide({needs : {hungerUnits : 1, water : 1, sleep : SleepEnterThreshold}}),
            Decide({scarcestTravelLevel : MigrateEnterThreshold})
        ]);

        expect(reached.size).toBe(HerdStateNames.length);
        Object.values(HerdState).forEach((state) => expect(reached.has(state)).toBe(true));
    });
});

describe("responding to threats by their total severity", () => {
    it("ignores a threat too slight to bother about", () => {
        // The band below the scatter threshold is what lets a herd graze warily with
        // somebody in sight. Without it anything nearby at all would panic it.
        expect(Decide({threatTotal : ScatterThreatTotal - Nudge})).toBe(HerdState.Forage);
    });

    it("scatters from one predator", () => {
        expect(Decide({threatTotal : ScatterThreatTotal})).toBe(HerdState.DefensiveScatter);
    });

    it("bunches up once enough of them arrive", () => {
        // The whole point of totalling rather than taking the worst single threat: one
        // of a thing is survived by running, ten of it by presenting a wall.
        expect(Decide({threatTotal : ClumpThreatTotal})).toBe(HerdState.DefensiveClump);
    });

    it("scatters from a pack one short of alarming", () => {
        expect(Decide({threatTotal : ClumpThreatTotal - Nudge})).toBe(HerdState.DefensiveScatter);
    });

    it("counts many slight threats as one serious one", () => {
        // Ten of something individually beneath notice must still add up to a rout.
        const oneHyena = ScatterThreatTotal;
        const tenHyenas = oneHyena * 10;

        expect(Decide({threatTotal : oneHyena})).toBe(HerdState.DefensiveScatter);
        expect(Decide({threatTotal : tenHyenas})).toBe(HerdState.DefensiveClump);
    });

    it("wakes a sleeping herd rather than letting it be eaten", () => {
        // Falls out of the branch ORDER, not a special case. If this ever fails, the
        // threat branch has been demoted below the sleep branch.
        const asleep = new HerdGoal(HerdState.Sleep);

        expect(Decide({
            goal : asleep, previousState : HerdState.Sleep,
            needs : {hungerUnits : 1, water : 1, sleep : 0},
            threatTotal : ClumpThreatTotal
        })).toBe(HerdState.DefensiveClump);
    });

    it("outranks a herd that is both exhausted and starving", () => {
        expect(Decide({
            needs : {hungerUnits : 0, water : 0, sleep : 0}, scarcestTravelLevel : 0,
            threatTotal : ScatterThreatTotal
        })).toBe(HerdState.DefensiveScatter);
    });
});

describe("hysteresis", () => {
    // The flap test, in both directions on both axes. A single threshold makes a herd
    // stand at the edge of the lake vibrating: the tick its water crosses the line it
    // stops migrating, drains back below, and sets off again. The gap between enter and
    // exit is what makes it commit, and only a test that walks the herd across both
    // thresholds from both sides can tell the gap is really there.

    const Sleeping = () => new HerdGoal(HerdState.Sleep);
    const Migrating = () => new HerdGoal(HerdState.Migrate);

    it("does not fall asleep just above the enter threshold", () => {
        expect(Decide({needs : {hungerUnits : 1, water : 1, sleep : SleepEnterThreshold + Nudge}})).toBe(HerdState.Forage);
    });

    it("falls asleep at the enter threshold", () => {
        expect(Decide({needs : {hungerUnits : 1, water : 1, sleep : SleepEnterThreshold}})).toBe(HerdState.Sleep);
    });

    it("stays asleep well past the point it would have fallen asleep at", () => {
        // The heart of it: a sleep level that would NOT have started a nap is not enough
        // to end one.
        expect(Decide({
            goal : Sleeping(), previousState : HerdState.Sleep,
            needs : {hungerUnits : 1, water : 1, sleep : SleepExitThreshold - Nudge}
        })).toBe(HerdState.Sleep);
    });

    it("wakes only once fully rested", () => {
        expect(Decide({
            goal : Sleeping(), previousState : HerdState.Sleep,
            needs : {hungerUnits : 1, water : 1, sleep : SleepExitThreshold}
        })).toBe(HerdState.Forage);
    });

    it("does not set off just above the migrate threshold", () => {
        expect(Decide({scarcestTravelLevel : MigrateEnterThreshold + Nudge})).toBe(HerdState.Forage);
    });

    it("sets off at the migrate threshold", () => {
        expect(Decide({scarcestTravelLevel : MigrateEnterThreshold})).toBe(HerdState.Migrate);
    });

    it("keeps going well past the point it would have set off at", () => {
        expect(Decide({
            goal : Migrating(), previousState : HerdState.Migrate,
            scarcestTravelLevel : MigrateExitThreshold - Nudge
        })).toBe(HerdState.Migrate);
    });

    it("settles down only once topped up", () => {
        expect(Decide({
            goal : Migrating(), previousState : HerdState.Migrate,
            scarcestTravelLevel : MigrateExitThreshold
        })).toBe(HerdState.Forage);
    });

    it("does not flap across a long slow drain", () => {
        // Walk the level down from full to empty and back, and count the switches. A
        // herd that changes its mind more than twice over one round trip is flapping.
        const goal = new HerdGoal();
        let switches = 0;

        const Step = (level : number) => {
            const decided = EvaluateDecisionTree(HerdDecisionTree, MakeContext({
                goal : goal, previousState : goal.State, scarcestTravelLevel : level
            }));

            if (decided !== goal.State) switches++;

            goal.State = decided;
        };

        for (let step = 100; step >= 0; step--) Step(step / 100);
        for (let step = 0; step <= 100; step++) Step(step / 100);

        expect(switches).toBe(2);
    });

    it("reads the hysteresis off the previous state, with no clock", () => {
        // Recorded here because it is what lets HandleAIMovement take no TimeResources:
        // the branch names must be the "was it already doing this" pair, not a timer.
        const {path} = TraceDecisionTree(HerdDecisionTree, MakeContext({scarcestTravelLevel : 0.5}));

        expect(path).toContain("WasSleeping:false");
        expect(path).toContain("WasMigrating:false");
    });
});

describe("the behaviour table", () => {
    it("has a row for every state, at runtime and not merely at compile time", () => {
        Object.values(HerdState).forEach((state) => {
            expect(HerdBehaviours[state]).toBeDefined();
            expect(typeof HerdBehaviours[state].ResolveGoal).toBe("function");
        });

        expect(Object.keys(HerdBehaviours).length).toBe(HerdStateNames.length);
    });

    it("makes the defensive states actually distinguishable", () => {
        // Five copies of one weight set would satisfy every other test in this file.
        const clump = HerdBehaviours[HerdState.DefensiveClump].weights;
        const scatter = HerdBehaviours[HerdState.DefensiveScatter].weights;
        const forage = HerdBehaviours[HerdState.Forage].weights;

        // Bunching up IS cohesion beating separation.
        expect(clump.cohesion).toBeGreaterThan(clump.separation);
        // Scattering is the mirror image: every animal for itself.
        expect(scatter.cohesion).toBe(0);
        expect(scatter.separation).toBeGreaterThan(forage.separation);
    });

    it("keeps some separation even while bunched, so a clump is not drawn as one animal", () => {
        expect(HerdBehaviours[HerdState.DefensiveClump].weights.separation).toBeGreaterThan(0);
    });

    it("never lets a destination outweigh unwalkable ground", () => {
        // If the goal term could win, a thirsty herd would march into the lake to reach
        // the water on the far side of it.
        Object.values(HerdState).forEach((state) => {
            const weights = HerdBehaviours[state].weights;

            expect(weights.terrain).toBeGreaterThan(weights.goal);
        });
    });

    it("gives the defensive and sleeping states nowhere to be", () => {
        const context = MakeContext();

        [HerdState.DefensiveClump, HerdState.DefensiveScatter, HerdState.Sleep].forEach((state) => {
            expect(ResolveFor(state, context, BuildGrassWorld())).toBeUndefined();
        });
    });

    it("leaves an interrupted migration's destination standing", () => {
        // A herd that flees mid-trip should resume the journey once the predator leaves,
        // not re-scan the world for the lake it was already walking to.
        const goal = new HerdGoal();

        goal.Destination = new Position(120, 120);
        goal.DestinationNeed = NeedKind.Water;
        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;

        const context = MakeContext({goal : goal});

        ResolveFor(HerdState.DefensiveScatter, context, BuildGrassWorld());

        expect(goal.Destination).toEqual(new Position(120, 120));
        expect(goal.DestinationNeed).toBe(NeedKind.Water);
    });
});

describe("choosing where to forage", () => {
    it("sits one wander radius from the herd", () => {
        const context = MakeContext();
        const target = ResolveFor(HerdState.Forage, context, BuildGrassWorld())!;

        expect(Math.hypot(target.x - context.centroid.x, target.y - context.centroid.y))
            .toBeCloseTo(context.herdOwner.WanderRadius);
    });

    it("keeps the existing target while the herd is still travelling", () => {
        const goal = new HerdGoal();
        const context = MakeContext({goal : goal});

        const first = ResolveFor(HerdState.Forage, context, BuildGrassWorld())!;
        const second = ResolveFor(HerdState.Forage, context, BuildGrassWorld())!;

        expect(second).toBe(first);
    });

    it("prefers a leg onto ground the herd can actually walk on", () => {
        // Sea to the west, grass to the east. A coast is the case that motivates
        // re-rolling the bend at all: most of a shoreline herd's options are in the
        // water, and one attempt would have it stroll into the sea every other leg.
        const world = BuildTestWorld(ShapedNoise((x) => (x < 50 ? DeepWaterNoise : GrassNoise)));

        let ontoLand = 0;

        for (let trial = 0; trial < 40; trial++) {
            const goal = new HerdGoal();
            const context = MakeContext({goal : goal, centroid : new Position(60, 50)});

            const target = ResolveFor(HerdState.Forage, context, world, trial + 1)!;

            if (target.x >= 50) ontoLand++;
        }

        // Not all of them -- the bend is bounded by MaxTurn, so a herd pointed at the
        // sea cannot always turn far enough in one leg. Most of them is the claim.
        expect(ontoLand).toBeGreaterThan(30);
    });
});

describe("choosing where to migrate", () => {
    const ThirstyContext = (overrides : Partial<HerdContext> = {}) => MakeContext({
        goal : new HerdGoal(HerdState.Migrate),
        scarcestTravelNeed : NeedKind.Water,
        scarcestTravelLevel : 0.1,
        ...overrides
    });

    it("takes water the herd can already see, without scanning", () => {
        // The cheap path. The terrain ring was sampled this tick anyway, so a herd that
        // can see its water must not pay for an outward scan to rediscover it.
        const context = ThirstyContext({nearestDrinkableWater : new Position(55, 52)});

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toEqual(new Position(55, 52));
    });

    it("scans outward when nothing is in sight", () => {
        const world = BuildTestWorld(ShapedNoise((x) => (x > 90 ? ShallowWaterNoise : GrassNoise)));
        const found = ResolveFor(HerdState.Migrate, ThirstyContext(), world)!;

        expect(found).toBeDefined();
        expect(IsDrinkableWater(world, found.x, found.y)).toBe(true);
    });

    it("remembers where it was going instead of scanning every tick", () => {
        let probes = 0;

        const world = BuildTestWorld({
            GetNoise : (x : number) => {probes++; return x > 90 ? ShallowWaterNoise : GrassNoise}
        });

        const context = ThirstyContext();

        ResolveFor(HerdState.Migrate, context, world);

        const afterFirst = probes;

        for (let tick = 0; tick < 10; tick++) ResolveFor(HerdState.Migrate, context, world);

        // Ten further ticks must be free, not ten more scans. Re-deriving the
        // destination every frame is thousands of samples to produce an answer that has
        // not changed since the herd set off.
        expect(probes).toBe(afterFirst);
    });

    it("looks for forage when food is the shorter of the two", () => {
        const world = BuildTestWorld(ShapedNoise((x) => (x > 20 ? GrassNoise : MountainNoise)));

        const context = ThirstyContext({
            scarcestTravelNeed : NeedKind.Food, scarcestTravelLevel : 0.1,
            centroid : new Position(0, 0)
        });

        const found = ResolveFor(HerdState.Migrate, context, world)!;

        expect(found).toBeDefined();
        expect(IsForageGround(world, found.x, found.y)).toBe(true);
    });

    it("re-chooses when the need it set out for changes", () => {
        const goal = new HerdGoal(HerdState.Migrate);

        goal.Destination = new Position(500, 500);
        goal.DestinationNeed = NeedKind.Water;
        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;

        // Now it is hunger that is worse, and the lake it was walking to is no answer.
        const context = ThirstyContext({
            goal : goal, scarcestTravelNeed : NeedKind.Food, nearestForage : new Position(52, 50)
        });

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toEqual(new Position(52, 50));
    });

    it("re-chooses once the destination has expired", () => {
        const goal = new HerdGoal(HerdState.Migrate);

        goal.Destination = new Position(500, 500);
        goal.DestinationNeed = NeedKind.Water;
        // Timed out: the herd never got there, so it stops believing in it.
        goal.DestinationSecondsRemaining = 0;

        const context = ThirstyContext({goal : goal, nearestDrinkableWater : new Position(53, 50)});

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toEqual(new Position(53, 50));
    });

    it("stops looking rather than searching forever when there is no water at all", () => {
        expect(ResolveFor(HerdState.Migrate, ThirstyContext(), BuildGrassWorld())).toBeUndefined();
    });

    it("spends one scan budget per scan and keeps its old destination when broke", () => {
        const world = BuildTestWorld(ShapedNoise((x) => (x > 90 ? ShallowWaterNoise : GrassNoise)));
        const budget = {remaining : 1};

        const first = ThirstyContext();
        const second = ThirstyContext();

        const Resolve = (context : HerdContext) => HerdBehaviours[HerdState.Migrate].ResolveGoal({
            context : context, world : world,
            random : new LinearCongruentialGenerator(1), scanBudget : budget
        });

        expect(Resolve(first)).toBeDefined();
        expect(budget.remaining).toBe(0);

        // The second herd missed its turn. It gets nothing this tick and looks again
        // next frame, rather than the tick paying for two scans.
        expect(Resolve(second)).toBeUndefined();
    });

    it("never sends a herd to water beyond the radius it will believe in", () => {
        const world = BuildTestWorld(ShapedNoise((x) => (x > 5000 ? ShallowWaterNoise : GrassNoise)));

        expect(ResolveFor(HerdState.Migrate, ThirstyContext(), world)).toBeUndefined();
        expect(GoalScanMaxRadiusTiles).toBeLessThan(5000);
    });

    it("answers with the tile underfoot when the herd is already standing on it", () => {
        // Not a degenerate answer. The member tree has each animal begin feeding where
        // it stands, so a migration of zero distance is a herd settling down to graze.
        const world = BuildTestWorld(FlatNoise(ShallowWaterNoise));
        const context = ThirstyContext({centroid : new Position(50, 50)});

        expect(ResolveFor(HerdState.Migrate, context, world)).toEqual(new Position(50, 50));
    });
});

describe("refusing to aim at bare ground", () => {
    // Hills are walkable but worth nothing to walk to: nothing grows on them and, because
    // the noise field bands outward from a peak, a hillside target is usually a target
    // pointed at the mountain behind it. Herds that kept choosing them spent their lives
    // walking up to rock and turning round.

    it("picks grass over hill when both are available", () => {
        // Hill to the west, grass to the east, and the herd free to bend either way.
        const world = BuildTestWorld(ShapedNoise((x) => (x < 50 ? WithinBand(TerrainKind.Hill, 0.5) : GrassNoise)));

        let ontoGrass = 0;

        for (let trial = 0; trial < 30; trial++) {
            const context = MakeContext({goal : new HerdGoal(), centroid : new Position(50, 50)});
            const target = ResolveFor(HerdState.Forage, context, world, trial + 1)!;

            if (target.x >= 50) ontoGrass++;
        }

        // Not all: MaxTurn bounds a single leg, so a herd already pointed west cannot always
        // turn far enough. The great majority is the claim.
        expect(ontoGrass).toBeGreaterThan(24);
    });

    it("still aims somewhere walkable when there is no grass at all", () => {
        // A herd deep in hill country must not be left without a destination -- the goal
        // term is a pull, and with nothing to pull toward the herd just mills.
        const world = BuildTestWorld(FlatNoise(WithinBand(TerrainKind.Hill, 0.5)));
        const context = MakeContext({goal : new HerdGoal()});

        const target = ResolveFor(HerdState.Forage, context, world)!;

        expect(target).toBeDefined();
        expect(IsPassableTerrain(world, target.x, target.y)).toBe(true);
    });

    it("prefers a hill to a mountain when those are the only options", () => {
        // Aiming at a hill is a poor leg; aiming into rock is a broken one.
        const world = BuildTestWorld(ShapedNoise((x) => (x < 50 ? MountainNoise : WithinBand(TerrainKind.Hill, 0.5))));

        let ontoWalkable = 0;

        for (let trial = 0; trial < 30; trial++) {
            const context = MakeContext({goal : new HerdGoal(), centroid : new Position(60, 50)});
            const target = ResolveFor(HerdState.Forage, context, world, trial + 1)!;

            if (IsPassableTerrain(world, target.x, target.y)) ontoWalkable++;
        }

        expect(ontoWalkable).toBeGreaterThan(24);
    });

    it("counts wadeable water as somewhere worth going", () => {
        // Not only grass: a herd should be willing to aim at a shoreline, which is where it
        // drinks.
        const world = BuildTestWorld(FlatNoise(ShallowWaterNoise));
        const context = MakeContext({goal : new HerdGoal()});

        const target = ResolveFor(HerdState.Forage, context, world)!;

        expect(IsDrinkableWater(world, target.x, target.y)).toBe(true);
    });
});

describe("giving up on a destination the moment a member cannot move", () => {
    it("re-rolls a foraging leg on a forced retarget", () => {
        // The fast path out of being stuck. The stall clock gets there eventually, but it
        // takes seconds, and seconds of a deer standing against rock is exactly what the
        // problem looked like.
        const goal = new HerdGoal();
        const context = MakeContext({goal : goal});

        const first = ResolveFor(HerdState.Forage, context, BuildGrassWorld())!;

        // Not stalled -- the herd has only just set off -- so nothing but the flag can end
        // this leg.
        goal.ForcedRetarget = true;

        const second = ResolveFor(HerdState.Forage, context, BuildGrassWorld(), 2)!;

        expect(second).not.toBe(first);
    });

    it("consumes the flag so one blocked frame does not re-roll forever", () => {
        const goal = new HerdGoal();
        const context = MakeContext({goal : goal});

        goal.ForcedRetarget = true;
        ResolveFor(HerdState.Forage, context, BuildGrassWorld());

        expect(goal.ForcedRetarget).toBe(false);

        const settled = goal.WanderTarget;

        ResolveFor(HerdState.Forage, context, BuildGrassWorld(), 5);

        expect(goal.WanderTarget).toBe(settled);
    });

    it("abandons a migration destination on a forced retarget", () => {
        const goal = new HerdGoal(HerdState.Migrate);

        goal.Destination = new Position(500, 500);
        goal.DestinationNeed = NeedKind.Water;
        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;
        goal.ForcedRetarget = true;

        const context = MakeContext({
            goal : goal, scarcestTravelNeed : NeedKind.Water, scarcestTravelLevel : 0.1,
            needs : {hungerUnits : 1, water : 0.1, sleep : 1},
            nearestDrinkableWater : new Position(53, 50)
        });

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toEqual(new Position(53, 50));
    });
});

describe("committing to the need it set out for", () => {
    // The drinking flicker, from the goal side. Re-reading "which need is scarcest" every
    // tick is a feedback loop: a herd reaches water, drinks, its water rises above its
    // food, the scarcest need flips to Food, the destination becomes grass, and the animals
    // standing in the shallows are pulled out of the water they came for. Then food drains
    // below water and it flips back.

    const ThirstyGoal = () => {
        const goal = new HerdGoal(HerdState.Migrate);

        goal.Destination = new Position(90, 50);
        goal.DestinationNeed = NeedKind.Water;
        goal.DestinationSecondsRemaining = MigrateGoalExpirySeconds;

        return goal;
    };

    it("keeps the water destination when drinking makes food the scarcer need", () => {
        const goal = ThirstyGoal();

        // Mid-drink: water has risen past food but is still well short of satisfied.
        const context = MakeContext({
            goal : goal,
            needs : {hungerUnits : 0.3, water : 0.5, sleep : 1},
            scarcestTravelNeed : NeedKind.Food,
            scarcestTravelLevel : 0.3,
            nearestForage : new Position(51, 50)
        });

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toBe(goal.Destination);
        expect(goal.DestinationNeed).toBe(NeedKind.Water);
    });

    it("releases the water destination once the herd has actually drunk enough", () => {
        const goal = ThirstyGoal();

        const context = MakeContext({
            goal : goal,
            needs : {hungerUnits : 0.3, water : MigrateExitThreshold, sleep : 1},
            scarcestTravelNeed : NeedKind.Food,
            scarcestTravelLevel : 0.3,
            nearestForage : new Position(51, 50)
        });

        expect(ResolveFor(HerdState.Migrate, context, BuildGrassWorld())).toEqual(new Position(51, 50));
        expect(goal.DestinationNeed).toBe(NeedKind.Food);
    });

    it("does not flap between water and forage across a whole drink", () => {
        // Walk water up from empty to satisfied while food sits just below it the whole way,
        // so every tick the naive rule would have called food the scarcer need.
        const goal = ThirstyGoal();

        const chosen = new Set<number | undefined>();

        for (let step = 0; step <= 20; step++) {
            const water = step / 20;

            const context = MakeContext({
                goal : goal,
                needs : {hungerUnits : Math.max(0, water - 0.05), water : water, sleep : 1},
                scarcestTravelNeed : NeedKind.Food,
                scarcestTravelLevel : Math.max(0, water - 0.05),
                nearestForage : new Position(51, 50),
                nearestDrinkableWater : new Position(90, 50)
            });

            ResolveFor(HerdState.Migrate, context, BuildGrassWorld());
            chosen.add(goal.DestinationNeed);
        }

        // Water for as long as it was wanting, then food once. Two values, not twenty
        // alternations.
        expect(chosen.size).toBe(2);
    });
});
