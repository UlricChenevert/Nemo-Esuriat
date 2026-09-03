import { describe, it, expect } from "vitest";
import { AnimalSpeed } from "../../Configuration/GameConstants.ts";
import {
    CollectionSecondsByNeed, HerdState, MemberAction, MemberActionNames, NeedKind
} from "../../Configuration/HerdConstants.ts";
import { CollectingResource } from "../../Contracts/Components/CollectingResource.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { Vector2D } from "../../Contracts/Components/Vector2D.ts";
import type { WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { SpatialHashGrid } from "../../Libraries/Spatial/SpatialHashGrid.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import type { HerdMember } from "../../Utilities/BoidSteering.ts";
import { EvaluateDecisionTree } from "../../Utilities/DecisionTree.ts";
import type { HerdContext } from "../../Utilities/HerdSensing.ts";
import {
    IsResourceGround, MemberBehaviours, MemberDecisionTree, type MemberActionInput
} from "../../Utilities/MemberActionDecisions.ts";
import { BuildGrassWorld, BuildTestWorld, FlatNoise, GrassNoise, ShallowWaterNoise } from "../TestHelpers/BuildTestWorld.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

/**
 * One member of one herd, with the registry entities behind it, so a behaviour can be
 * run and its writes inspected.
 */
function BuildMemberScene(options : {
    state? : number
    destinationNeed? : number
    world? : WorldStreamingResources
    at? : Position
    collecting? : CollectingResource
    /** Something close enough to notice, without necessarily being worth fleeing. */
    disturbed? : boolean
    /** Other members of the same herd, for the tile-sharing rules. */
    others? : HerdMember[]
} = {}) {
    const registry = BuildTestRegistry();
    const world = options.world ?? BuildGrassWorld();

    const owner = new EntityBuilder(registry).GetEntity();
    const goal = new HerdGoal(options.state ?? HerdState.Forage);

    goal.DestinationNeed = options.destinationNeed;

    registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
    registry.RegisterEntity(owner, HerdGoal, goal);

    const position = options.at ?? new Position(50, 50);

    const entity = new EntityBuilder(registry)
        .AddPosition(position)
        .AddMovement(AnimalSpeed)
        .AddNeeds()
        .AddOwner(owner)
        .GetEntity();

    if (options.collecting) registry.RegisterEntity(entity, CollectingResource, options.collecting);

    const member : HerdMember = {
        entity : entity,
        position : position,
        heading : new Vector2D(0, 0),
        needs : registry.GetComponent(entity, Needs),
        collecting : options.collecting
    };

    const context : HerdContext = {
        owner : owner,
        herdOwner : registry.GetComponent(owner, HerdOwner)!,
        goal : goal,
        previousState : goal.State,
        members : [member, ...(options.others ?? [])],
        membersByEntity : new Map([[entity, member]]),
        distanceQuerier : new SpatialHashGrid(2),
        centroid : position.Copy(),
        needs : {hungerUnits : 1, water : 1, sleep : 1},
        scarcestTravelNeed : NeedKind.Water,
        scarcestTravelLevel : 1,
        threatsInRange : [],
        threatTotal : 0,
        isDisturbed : options.disturbed ?? false,
        terrainAvoidance : new Vector2D(0, 0),
        nearestDrinkableWater : undefined,
        nearestForage : undefined,
        claimedTiles : new Set<string>([`${Math.floor(position.x)},${Math.floor(position.y)}`])
    };

    return {registry, world, owner, goal, entity, member, context, position};
}

function InputFor(scene : ReturnType<typeof BuildMemberScene>, target : Position | undefined = new Position(51, 50)) {
    return {
        registry : scene.registry, world : scene.world, context : scene.context,
        member : scene.member, target : target
    };
}

const Decide = (scene : ReturnType<typeof BuildMemberScene>, target? : Position | undefined) =>
    EvaluateDecisionTree(MemberDecisionTree, InputFor(scene, target));

function Act(scene : ReturnType<typeof BuildMemberScene>, target? : Position | undefined) {
    RunAction(InputFor(scene, target));
}

/**
 * Acts with no target at all.
 *
 * Its own helper rather than `Act(scene, undefined)`, which would land on Act's own
 * default parameter and quietly test the opposite of what it says.
 */
function ActWithNowhereToGo(scene : ReturnType<typeof BuildMemberScene>) {
    RunAction({
        registry : scene.registry, world : scene.world, context : scene.context,
        member : scene.member, target : undefined
    });
}

function RunAction(input : MemberActionInput) {
    MemberBehaviours[EvaluateDecisionTree(MemberDecisionTree, input)].Act(input);
}

const TargetOf = (registry : GlobalRegistry, entity : Entity) =>
    registry.GetComponent(entity, TargetLocation)?.TargetLocation;

const WaterWorld = () => BuildTestWorld(FlatNoise(ShallowWaterNoise));

describe("deciding what one animal does", () => {
    it("flocks when its herd is simply grazing", () => {
        expect(Decide(BuildMemberScene())).toBe(MemberAction.Steer);
    });

    it("reaches every action it can name", () => {
        // The anti-dead-branch test, as for the herd tree.
        const reached = new Set<number>([
            Decide(BuildMemberScene()),
            Decide(BuildMemberScene({state : HerdState.Sleep})),
            Decide(BuildMemberScene({
                state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
            })),
            Decide(BuildMemberScene({
                world : WaterWorld(), collecting : new CollectingResource(NeedKind.Water, 3)
            }))
        ]);

        expect(reached.size).toBe(MemberActionNames.length);
        Object.values(MemberAction).forEach((action) => expect(reached.has(action)).toBe(true));
    });

    it("starts drinking on reaching water it came for", () => {
        // The requirement this whole component exists for: arriving is not drinking, and
        // something has to decide to stop.
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
        });

        expect(Decide(scene)).toBe(MemberAction.BeginCollecting);
    });

    it("keeps travelling while still on dry land", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : BuildGrassWorld()
        });

        expect(Decide(scene)).toBe(MemberAction.Steer);
    });

    it("judges arrival by the ground underfoot, not by nearness to the destination", () => {
        // Steering is clamped to about a tile a tick, so an animal gets its feet wet
        // several ticks before it reaches the coordinate the herd aimed at. That is when
        // it should drink -- which is also why a coarsely scanned destination costs
        // nothing in accuracy.
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
        });

        scene.goal.Destination = new Position(500, 500);

        expect(Decide(scene)).toBe(MemberAction.BeginCollecting);
    });

    it("rests while its herd sleeps", () => {
        expect(Decide(BuildMemberScene({state : HerdState.Sleep}))).toBe(MemberAction.Rest);
    });

    it("does not re-decide a collection already under way", () => {
        const scene = BuildMemberScene({
            world : WaterWorld(), collecting : new CollectingResource(NeedKind.Water, 2)
        });

        expect(Decide(scene)).toBe(MemberAction.Collect);
    });

    it("gives up a collection when shoved off the resource", () => {
        // Separation from the animals crowding in behind can move a member off the tile
        // it was drinking from. Without this it would stand on dry land running down a
        // timer for water it is no longer touching.
        const scene = BuildMemberScene({
            world : BuildGrassWorld(), collecting : new CollectingResource(NeedKind.Water, 2)
        });

        expect(Decide(scene)).toBe(MemberAction.Steer);
    });

    it("abandons a drink to flee", () => {
        [HerdState.DefensiveClump, HerdState.DefensiveScatter].forEach((state) => {
            const scene = BuildMemberScene({
                state : state, world : WaterWorld(), collecting : new CollectingResource(NeedKind.Water, 2)
            });

            expect(Decide(scene)).toBe(MemberAction.Steer);
        });
    });
});

describe("acting on the decision", () => {
    it("writes a target when flocking", () => {
        const scene = BuildMemberScene();

        Act(scene, new Position(53, 54));

        expect(TargetOf(scene.registry, scene.entity)).toEqual(new Position(53, 54));
    });

    it("updates an existing target in place rather than replacing it", () => {
        const scene = BuildMemberScene();

        Act(scene, new Position(53, 54));

        const first = scene.registry.GetComponent(scene.entity, TargetLocation)!;

        Act(scene, new Position(55, 56));

        expect(scene.registry.GetComponent(scene.entity, TargetLocation)).toBe(first);
        expect(first.TargetLocation).toEqual(new Position(55, 56));
    });

    it("writes nothing when there is nowhere to go", () => {
        const scene = BuildMemberScene();

        ActWithNowhereToGo(scene);

        expect(TargetOf(scene.registry, scene.entity)).toBeUndefined();
    });

    it("drops the target when it starts collecting, which IS the break from the flock", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
        });

        scene.registry.RegisterEntity(scene.entity, TargetLocation, new TargetLocation(new Position(60, 60)));

        Act(scene);

        // With nothing to walk toward, HandleMovement never touches this entity again
        // until it is steering once more. Nothing else has to know it stopped.
        expect(TargetOf(scene.registry, scene.entity)).toBeUndefined();
        expect(scene.registry.GetComponent(scene.entity, CollectingResource)).toBeDefined();
    });

    it("owes the configured time for what it stopped to collect", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
        });

        Act(scene);

        const collecting = scene.registry.GetComponent(scene.entity, CollectingResource)!;

        expect(collecting.need).toBe(NeedKind.Water);
        expect(collecting.remainingSeconds).toBe(CollectionSecondsByNeed[NeedKind.Water]);
    });

    it("writes absolutely nothing while collecting", () => {
        // Standing still is the ABSENCE of a target, not a target equal to the member's
        // own position -- HandleMovement strips a target it has arrived at, so the latter
        // would flicker the animal between moving and not for as long as it drank.
        const scene = BuildMemberScene({
            world : WaterWorld(), collecting : new CollectingResource(NeedKind.Water, 2)
        });

        Act(scene, new Position(51, 50));

        expect(TargetOf(scene.registry, scene.entity)).toBeUndefined();
    });

    it("cancels the collection when it flees", () => {
        const scene = BuildMemberScene({
            state : HerdState.DefensiveScatter, world : WaterWorld(),
            collecting : new CollectingResource(NeedKind.Water, 2)
        });

        Act(scene, new Position(40, 40));

        expect(scene.registry.GetComponent(scene.entity, CollectingResource)).toBeUndefined();
        expect(TargetOf(scene.registry, scene.entity)).toEqual(new Position(40, 40));
    });

    it("stands still while resting", () => {
        const scene = BuildMemberScene({state : HerdState.Sleep});

        scene.registry.RegisterEntity(scene.entity, TargetLocation, new TargetLocation(new Position(60, 60)));

        Act(scene);

        expect(TargetOf(scene.registry, scene.entity)).toBeUndefined();
    });

    it("does not throw when the herd wants a resource but names none", () => {
        const scene = BuildMemberScene({state : HerdState.Migrate, world : WaterWorld()});

        expect(() => Act(scene)).not.toThrow();
    });
});

describe("the member behaviour table", () => {
    it("has a row for every action, at runtime and not merely at compile time", () => {
        Object.values(MemberAction).forEach((action) => {
            expect(MemberBehaviours[action]).toBeDefined();
            expect(typeof MemberBehaviours[action].Act).toBe("function");
        });

        expect(Object.keys(MemberBehaviours).length).toBe(MemberActionNames.length);
    });
});

describe("matching ground to a need", () => {
    it("answers thirst with shallow water and hunger with grass", () => {
        const water = WaterWorld();
        const grass = BuildTestWorld(FlatNoise(GrassNoise));

        expect(IsResourceGround(water, 0, 0, NeedKind.Water)).toBe(true);
        expect(IsResourceGround(water, 0, 0, NeedKind.Food)).toBe(false);
        expect(IsResourceGround(grass, 0, 0, NeedKind.Food)).toBe(true);
        expect(IsResourceGround(grass, 0, 0, NeedKind.Water)).toBe(false);
    });

    it("says no ground provides sleep", () => {
        // Sleep is the need with no destination, which is why it is excluded from the
        // herd's travel ranking too.
        expect(IsResourceGround(WaterWorld(), 0, 0, NeedKind.Sleep)).toBe(false);
        expect(IsResourceGround(BuildTestWorld(FlatNoise(GrassNoise)), 0, 0, NeedKind.Sleep)).toBe(false);
    });
});

describe("noticing somebody nearby", () => {
    // The reported bug: a drinking herd ignored a person walking right up to it. The only
    // interrupt was the defensive states, and those need enough summed severity to matter --
    // which one person on foot never reaches. Being disturbed is a different question from
    // being threatened, and it needed its own branch.

    it("abandons a drink for one person, without the herd panicking", () => {
        const scene = BuildMemberScene({
            world : WaterWorld(),
            collecting : new CollectingResource(NeedKind.Water, 3),
            disturbed : true
        });

        expect(Decide(scene)).toBe(MemberAction.Steer);
        // Still just grazing, as far as the herd is concerned. Wary, not routed.
        expect(scene.goal.State).toBe(HerdState.Forage);
    });

    it("clears the collection component when startled", () => {
        const scene = BuildMemberScene({
            world : WaterWorld(),
            collecting : new CollectingResource(NeedKind.Water, 3),
            disturbed : true
        });

        Act(scene);

        expect(scene.registry.GetComponent(scene.entity, CollectingResource)).toBeUndefined();
    });

    it("does not settle down to drink while disturbed", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water,
            world : WaterWorld(), disturbed : true
        });

        expect(Decide(scene)).toBe(MemberAction.Steer);
    });

    it("gets up rather than resting while disturbed", () => {
        const scene = BuildMemberScene({state : HerdState.Sleep, disturbed : true});

        expect(Decide(scene)).toBe(MemberAction.Steer);
    });

    it("carries on undisturbed when nothing is near", () => {
        // The control. Disturbance must not be permanently on, or nothing ever drinks.
        const scene = BuildMemberScene({
            world : WaterWorld(), collecting : new CollectingResource(NeedKind.Water, 3)
        });

        expect(Decide(scene)).toBe(MemberAction.Collect);
    });
});

describe("not drinking on top of each other", () => {
    // A collecting member writes no steering at all, so it is the one kind of animal
    // separation cannot push apart. That made a waterhole the one place a whole herd
    // reliably stacked onto a single tile -- and since the renderer keeps one glyph per
    // cell and breaks same-layer ties by whichever entity it happened to visit last, a
    // stack does not read as a stack. It reads as animals blinking in and out.

    /** Another member of the same herd, optionally already drinking, at a given tile. */
    function OtherMemberAt(x : number, y : number, collecting? : CollectingResource) : HerdMember {
        return {
            entity : 9999 as Entity,
            position : new Position(x, y),
            heading : new Vector2D(0, 0),
            needs : undefined,
            collecting : collecting
        };
    }

    it("moves on when somebody else is already drinking on this tile", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld(),
            at : new Position(50, 50),
            others : [OtherMemberAt(50.4, 50.2, new CollectingResource(NeedKind.Water, 2))]
        });

        expect(Decide(scene)).toBe(MemberAction.Steer);
    });

    it("drinks where somebody else is merely standing", () => {
        // Only a drinker holds a tile, because only a drinker is unable to be pushed off it.
        // Treating every neighbour as a blocker would stop a herd drinking at all on a
        // narrow shore.
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld(),
            at : new Position(50, 50),
            others : [OtherMemberAt(50.4, 50.2)]
        });

        expect(Decide(scene)).toBe(MemberAction.BeginCollecting);
    });

    it("drinks when the other drinker is on a different tile", () => {
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld(),
            at : new Position(50, 50),
            others : [OtherMemberAt(52, 50, new CollectingResource(NeedKind.Water, 2))]
        });

        expect(Decide(scene)).toBe(MemberAction.BeginCollecting);
    });

    it("does not mistake itself for a rival", () => {
        // The member is in its own herd's member list, and it is standing on its own tile.
        // Comparing by position alone would have every animal refuse to drink anywhere.
        const scene = BuildMemberScene({
            state : HerdState.Migrate, destinationNeed : NeedKind.Water, world : WaterWorld()
        });

        expect(Decide(scene)).toBe(MemberAction.BeginCollecting);
    });

    it("keeps drinking once started, even if somebody crowds onto its tile", () => {
        // IsCollecting is checked before the arrival rules, so an animal already drinking is
        // never re-asked whether it may. Otherwise two members could talk each other out of
        // a drink they were both halfway through.
        const scene = BuildMemberScene({
            world : WaterWorld(),
            collecting : new CollectingResource(NeedKind.Water, 2),
            at : new Position(50, 50),
            others : [OtherMemberAt(50.3, 50.3, new CollectingResource(NeedKind.Water, 2))]
        });

        expect(Decide(scene)).toBe(MemberAction.Collect);
    });
});
