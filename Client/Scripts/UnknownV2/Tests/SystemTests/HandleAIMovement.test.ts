import { describe, it, expect } from "vitest";
import { AnimalSpeed, HumanSpeed } from "../../Configuration/GameConstants.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { TimeResources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandleAIMovement as SteerHerds } from "../../Systems.Gameloop/HandleAIMovement.ts";
import { HandleMovement } from "../../Systems.Gameloop/HandleMovement.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import {
  BuildGrassWorld, BuildTestWorld, DeepWaterNoise, FlatNoise, GrassNoise, MountainNoise,
  ShallowWaterNoise, ShapedNoise
} from "../TestHelpers/BuildTestWorld.ts";
import {
  ClumpThreatTotal, HerdState, MaxGoalScansPerTick, MigrateEnterThreshold, ScatterThreatTotal,
  StallSecondsMax
} from "../../Configuration/HerdConstants.ts";
import { CollectingResource } from "../../Contracts/Components/CollectingResource.ts";
import { Needs } from "../../Contracts/Components/Needs.ts";
import type { WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import { UpdateNeeds } from "../../Systems.Gameloop/UpdateNeeds.ts";
import { IsPassableTerrain } from "../../Utilities/TerrainUtilities.ts";

/**
 * Steers a herd on featureless grazing ground.
 *
 * These tests are about steering, not about terrain. On a real noise field the herd
 * would also be dodging mountains and shorelines, and every assertion about a
 * direction would be measuring two things at once -- what the system decided, and what
 * the ground happened to look like where the test put the herd. Flat grass makes the
 * terrain term exactly zero, so what is left is the flocking these tests were written
 * to pin.
 */
function HandleAIMovement(registry : GlobalRegistry) {
  SteerHerds(registry, BuildGrassWorld());
}

/**
 * A herd owner with members at exactly the given tiles.
 *
 * EntityBuilder.MakeHerd scatters its members randomly, which is right for the
 * game and useless for asserting on a direction, so the members are placed by
 * hand here. Everything else -- Owns/OwnedBy, IsMoveable -- goes through the
 * builder so the layout under test is the one the game actually produces.
 */
function BuildHerd(tiles : [number, number][], herdOwner = new HerdOwner()) {
  const registry = BuildTestRegistry();

  const owner = new EntityBuilder(registry).GetEntity();

  registry.RegisterEntity(owner, HerdOwner, herdOwner);

  // HerdOwner holds the tuning and HerdGoal the roaming state; a herd needs both.
  // Handed back alongside the owner because the wander tests assert on where the
  // herd is headed, which lives here rather than on the tuning.
  const herdGoal = new HerdGoal();

  registry.RegisterEntity(owner, HerdGoal, herdGoal);

  const members = tiles.map(([x, y]) =>
    new EntityBuilder(registry)
      .AddPosition(new Position(x, y))
      .AddMovement(AnimalSpeed)
      .AddOwner(owner)
      .GetEntity()
  );

  return { registry, owner, members, herdOwner, herdGoal };
}

/** A person standing at the given tile, of the kind herd animals shy away from. */
function AddHumanAt(registry : GlobalRegistry, x : number, y : number) {
  return new EntityBuilder(registry)
    .AddPosition(new Position(x, y))
    .AddMovement(HumanSpeed)
    .AddHuman()
    .GetEntity();
}

function PositionOf(registry : GlobalRegistry, entity : Entity) : Position {
  return registry.GetComponent(entity, Position)!;
}

function TargetOf(registry : GlobalRegistry, entity : Entity) : Position | undefined {
  return registry.GetComponent(entity, TargetLocation)?.TargetLocation;
}

/** The steering the system chose for a member: its target minus where it stands. */
function SteeringOf(registry : GlobalRegistry, entity : Entity) {
  const position = PositionOf(registry, entity);
  const target = TargetOf(registry, entity);

  if (!target) return undefined;

  return { x: target.x - position.x, y: target.y - position.y };
}

function DistanceBetween(a : Position, b : Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The signed turn from one bearing to another, wrapped into -PI..PI. */
function AngleBetween(from : number, to : number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** One full tick of the two systems that between them move a herd. */
function Tick(registry : GlobalRegistry, seconds = 1 / 60) {
  const time = new TimeResources();
  time.deltaSeconds = seconds;

  HandleAIMovement(registry);
  HandleMovement(registry, new EventQueue(new LinkedList()), time);
}

describe("steering a herd", () => {
  it("gives every member a target", () => {
    const { registry, members } = BuildHerd([[50, 50], [52, 50], [51, 53]]);

    HandleAIMovement(registry);

    expect(members.map((member) => TargetOf(registry, member) !== undefined)).toEqual([true, true, true]);
  });

  it("steers on both axes, not only horizontally", () => {
    // A member offset from its herd diagonally has to be pulled diagonally. The
    // first version of this system wrote target.x twice and never touched
    // target.y, so members could only ever slide sideways.
    const { registry, members } = BuildHerd([[50, 50], [60, 60], [61, 61]]);

    HandleAIMovement(registry);

    const steering = SteeringOf(registry, members[0]!)!;

    expect(steering.x).not.toBe(0);
    expect(steering.y).not.toBe(0);
  });

  it("pulls a straggler toward the rest of the herd", () => {
    // Far outside its own bubble, so separation and alignment contribute
    // nothing and what is left is cohesion plus the goal, both of which sit on
    // the flock's side of it.
    const { registry, members } = BuildHerd([[20, 20], [60, 60], [61, 60], [60, 61]]);

    const straggler = members[0]!;
    const before = PositionOf(registry, straggler).Copy();

    HandleAIMovement(registry);

    const target = TargetOf(registry, straggler)!;

    expect(target.x).toBeGreaterThan(before.x);
    expect(target.y).toBeGreaterThan(before.y);
  });

  it("pushes crowded members apart rather than together", () => {
    // Two members well inside each other's bubble. Their steering is compared
    // against each other rather than against zero because both also carry the
    // herd's shared drift toward its wander target, which can be larger than
    // the separation between them and point either way. What must hold is that
    // the right-hand member steers further right than the left-hand one does:
    // getting the sign of the separation term backwards -- steering toward the
    // neighbour -- reverses exactly that and collapses the pair onto one tile.
    const { registry, members } = BuildHerd([[50, 50], [50.5, 50]], new HerdOwner(1, 4));

    const [left, right] = [members[0]!, members[1]!];

    HandleAIMovement(registry);

    expect(SteeringOf(registry, right)!.x).toBeGreaterThan(SteeringOf(registry, left)!.x);
  });

  it("opens the gap between two stacked members over time", () => {
    const { registry, members } = BuildHerd([[50, 50], [50.5, 50], [50, 50.5]], new HerdOwner(1, 4));

    const gapBefore = DistanceBetween(PositionOf(registry, members[0]!), PositionOf(registry, members[1]!));

    for (let tick = 0; tick < 30; tick++) Tick(registry);

    const gapAfter = DistanceBetween(PositionOf(registry, members[0]!), PositionOf(registry, members[1]!));

    expect(gapAfter).toBeGreaterThan(gapBefore);
  });

  it("keeps the herd together while it roams", () => {
    const { registry, members } = BuildHerd([[50, 50], [52, 50], [51, 52], [49, 51], [50, 53]]);

    for (let tick = 0; tick < 200; tick++) Tick(registry);

    const positions = members.map((member) => PositionOf(registry, member));
    const spread = Math.max(...positions.map((a) => Math.max(...positions.map((b) => DistanceBetween(a, b)))));

    expect(spread).toBeLessThan(20);
  });

  it("never exceeds the steering clamp, in either direction", () => {
    // Members are laid out so the terms pull down and to the left as well as up
    // and to the right: clamping with Math.min per axis, as the first version
    // did, leaves large negative components completely unbounded.
    const { registry, members } = BuildHerd(
      [[50, 50], [10, 10], [90, 90], [10, 90], [90, 10]],
      new HerdOwner(0.5, 4)
    );

    HandleAIMovement(registry);

    members.forEach((member) => {
      const steering = SteeringOf(registry, member);

      if (!steering) return;

      expect(Math.hypot(steering.x, steering.y)).toBeLessThanOrEqual(0.5 + 1e-9);
    });
  });
});

describe("shying away from people", () => {
  it("steers a member away from a nearby person", () => {
    const { registry, members } = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    AddHumanAt(registry, 46, 50);

    HandleAIMovement(registry);

    // The person is to the west, so every member's steering must carry it east.
    members.forEach((member) => expect(SteeringOf(registry, member)!.x).toBeGreaterThan(0));
  });

  it("shies harder from someone close than from someone far", () => {
    const Near = BuildHerd([[50, 50], [52, 50], [51, 52]]);
    const Far = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    AddHumanAt(Near.registry, 49, 50);
    AddHumanAt(Far.registry, 43, 50);

    HandleAIMovement(Near.registry);
    HandleAIMovement(Far.registry);

    expect(SteeringOf(Near.registry, Near.members[0]!)!.x)
      .toBeGreaterThan(SteeringOf(Far.registry, Far.members[0]!)!.x);
  });

  it("ignores a person beyond the fear radius", () => {
    // Steering identical to a herd with nobody around at all, rather than
    // merely small: a person on the far side of the world must not tug on the
    // herd's path.
    const herd = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25, 2, 5));
    const alone = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25, 2, 5));

    AddHumanAt(herd.registry, 20, 50);

    // Both herds roll their first wander target off the same shared generator,
    // so pin them to the same destination to compare the rest of the steering.
    herd.herdGoal.WanderTarget = new Position(60, 60);
    alone.herdGoal.WanderTarget = new Position(60, 60);

    HandleAIMovement(herd.registry);
    HandleAIMovement(alone.registry);

    expect(SteeringOf(herd.registry, herd.members[0]!))
      .toEqual(SteeringOf(alone.registry, alone.members[0]!));
  });

  it("outweighs the herd's own cohesion", () => {
    // The straggler's flock is on the same side as the person, so cohesion and
    // the wander goal both pull it back toward them. Fleeing has to win, or an
    // animal walks through someone to rejoin its herd.
    const { registry, members, herdGoal } = BuildHerd([[50, 50], [40, 50], [40, 51], [41, 50]]);

    herdGoal.WanderTarget = new Position(40, 50);

    AddHumanAt(registry, 48, 50);

    HandleAIMovement(registry);

    expect(SteeringOf(registry, members[0]!)!.x).toBeGreaterThan(0);
  });

  it("drives the herd out of a person's way over time", () => {
    const { registry, members } = BuildHerd([[50, 50], [51, 50], [50, 51], [51, 51]]);

    const human = AddHumanAt(registry, 50, 50);

    const before = members.map((member) => DistanceBetween(PositionOf(registry, member), PositionOf(registry, human)));

    for (let tick = 0; tick < 60; tick++) Tick(registry);

    const after = members.map((member) => DistanceBetween(PositionOf(registry, member), PositionOf(registry, human)));

    members.forEach((_, index) => expect(after[index]!).toBeGreaterThan(before[index]!));
  });

  it("does not throw when a member stands on a person", () => {
    const { registry, members } = BuildHerd([[50, 50], [52, 50]]);

    AddHumanAt(registry, 50, 50);

    expect(() => Tick(registry)).not.toThrow();

    members.forEach((member) => expect(Number.isFinite(PositionOf(registry, member).x)).toBe(true));
  });
});

describe("degenerate herds", () => {
  it("does not produce NaN on the first tick", () => {
    const { registry, members } = BuildHerd([[50, 50], [51, 50], [50, 51]]);

    Tick(registry);

    members.forEach((member) => {
      const position = PositionOf(registry, member);

      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
  });

  it("does not produce NaN over a long run", () => {
    const { registry, members } = BuildHerd([[50, 50], [51, 50], [50, 51], [51, 51]]);

    for (let tick = 0; tick < 100; tick++) Tick(registry);

    members.forEach((member) => {
      const position = PositionOf(registry, member);

      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
  });

  it("survives a member already standing on its own target", () => {
    // The direction from a position to itself has no answer. Dividing by that
    // zero length is what poisoned the whole herd with NaN, and it happened on
    // the very first tick of every member.
    const { registry, members } = BuildHerd([[50, 50], [55, 55]]);

    const member = members[0]!;

    registry.RegisterEntity(member, TargetLocation, new TargetLocation(new Position(50, 50)));

    HandleAIMovement(registry);

    const target = TargetOf(registry, member)!;

    expect(Number.isFinite(target.x)).toBe(true);
    expect(Number.isFinite(target.y)).toBe(true);
  });

  it("survives two members on the exact same tile", () => {
    const { registry, members } = BuildHerd([[50, 50], [50, 50]], new HerdOwner(1, 4));

    HandleAIMovement(registry);

    members.forEach((member) => {
      const target = TargetOf(registry, member);

      if (!target) return;

      expect(Number.isFinite(target.x)).toBe(true);
      expect(Number.isFinite(target.y)).toBe(true);
    });
  });

  it("skips destroyed members instead of throwing", () => {
    // Owns never prunes its entries, so a stale handle is the expected state
    // after anything in the herd dies -- not a broken invariant.
    const { registry, members } = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    registry.DestroyEntity(members[1]!);

    expect(() => HandleAIMovement(registry)).not.toThrow();
    expect(TargetOf(registry, members[0]!)).toBeDefined();
  });

  it("ignores owned entities that are not herd animals", () => {
    // AddOwner is also how text glyphs and other decorations attach themselves.
    // Handing one a TargetLocation would crash HandleMovement, which needs a
    // speed to move it with.
    const { registry, owner } = BuildHerd([[50, 50], [52, 50]]);

    const glyph = new EntityBuilder(registry)
      .AddPosition(new Position(51, 51))
      .AddOwner(owner)
      .GetEntity();

    expect(() => Tick(registry)).not.toThrow();
    expect(TargetOf(registry, glyph)).toBeUndefined();
  });

  it("does nothing for an owner with no members", () => {
    const registry = BuildTestRegistry();
    const owner = new EntityBuilder(registry).GetEntity();

    registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
    new EntityBuilder(registry).AddPosition(new Position(1, 1)).AddOwner(owner);

    // Deliberately no HerdGoal: an owner assembled by hand is exactly the case the
    // system has to create one for rather than refuse to steer.
    expect(() => HandleAIMovement(registry)).not.toThrow();
  });
});

describe("the wander target", () => {
  it("is seeded from where the herd actually is", () => {
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 10));

    expect(herdGoal.WanderTarget).toBeUndefined();

    HandleAIMovement(registry);

    const target = herdGoal.WanderTarget!;

    expect(target).toBeDefined();
    expect(DistanceBetween(target, new Position(51, 50.666666666666664))).toBeCloseTo(10);
  });

  it("bends away from the current bearing rather than jumping", () => {
    // The complaint this guards against is the herd reversing on the spot every
    // time it arrived, which is what freely drawn destinations produce: half of
    // them sit behind the herd.
    const herdOwner = new HerdOwner(1, 2, 25, 2, 8, Math.PI / 5);
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]], herdOwner);

    HandleAIMovement(registry);

    let previous = herdGoal.WanderBearing!;

    for (let leg = 0; leg < 40; leg++) {
      // Stand the herd on its target so the next tick counts as an arrival.
      herdGoal.WanderTarget = new Position(51, 51);

      HandleAIMovement(registry);

      const turn = Math.abs(AngleBetween(previous, herdGoal.WanderBearing!));

      expect(turn).toBeLessThanOrEqual(Math.PI / 5 + 1e-9);

      previous = herdGoal.WanderBearing!;
    }
  });

  it("roams from wherever the herd is, however far from the origin", () => {
    // The world streams around the camera and has no border. Rejecting targets
    // against GameWidth -- which measures the viewport, not the world -- sent
    // every herd past the first hundred tiles to one shared fallback point, and
    // they piled up into a single enormous herd.
    const herdOwner = new HerdOwner();
    const { registry, herdGoal } = BuildHerd([[8000, 8000], [8002, 8000], [8001, 8002]], herdOwner);

    HandleAIMovement(registry);

    const target = herdGoal.WanderTarget!;

    expect(DistanceBetween(target, new Position(8001, 8000.666666666666))).toBeCloseTo(herdOwner.WanderRadius);
  });

  it("sends distant herds to different places", () => {
    // The same bug from the other side: two herds nowhere near each other must
    // not be handed the same destination.
    const first = new HerdGoal();
    const second = new HerdGoal();

    const registry = BuildTestRegistry();

    [
      {tiles: [[4000, 4000], [4002, 4000]] as [number, number][], goal: first},
      {tiles: [[-4000, -4000], [-4002, -4000]] as [number, number][], goal: second},
    ].forEach(({tiles, goal}) => {
      const herdEntity = new EntityBuilder(registry).GetEntity();

      registry.RegisterEntity(herdEntity, HerdOwner, new HerdOwner());
      registry.RegisterEntity(herdEntity, HerdGoal, goal);

      tiles.forEach(([x, y]) =>
        new EntityBuilder(registry)
          .AddPosition(new Position(x, y))
          .AddMovement(AnimalSpeed)
          .AddOwner(herdEntity)
      );
    });

    HandleAIMovement(registry);

    expect(DistanceBetween(first.WanderTarget!, second.WanderTarget!)).toBeGreaterThan(1000);
  });

  it("stays put while the herd is still travelling", () => {
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25));

    HandleAIMovement(registry);

    const first = herdGoal.WanderTarget!;

    HandleAIMovement(registry);

    expect(herdGoal.WanderTarget).toBe(first);
  });

  it("re-rolls once the herd arrives", () => {
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    HandleAIMovement(registry);

    const first = herdGoal.WanderTarget!;

    // Drop it on the herd's doorstep; the next tick should judge it reached.
    herdGoal.WanderTarget = new Position(51, 51);

    HandleAIMovement(registry);

    expect(herdGoal.WanderTarget).not.toBe(first);
    expect(herdGoal.WanderTarget).not.toEqual(new Position(51, 51));
  });

  it("always sits one wander radius from the herd", () => {
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25));

    for (let tick = 0; tick < 50; tick++) {
      // Stand the herd on its target so every iteration rolls a fresh one.
      herdGoal.WanderTarget = new Position(51, 50.666666666666664);

      HandleAIMovement(registry);

      expect(DistanceBetween(herdGoal.WanderTarget!, new Position(51, 50.666666666666664)))
        .toBeCloseTo(25);
    }
  });
});

/**
 * A herd on a chosen world, with appetites, driven by the real systems in loop order.
 *
 * Unlike BuildHerd above, this wires up everything the upgraded AI reads: needs per
 * member, a world with real terrain in it, and the needs system that runs immediately
 * before the AI in GameLoopLayers.
 */
function BuildHerdOn(world : WorldStreamingResources, tiles : [number, number][], herdOwner = new HerdOwner()) {
  const registry = BuildTestRegistry();

  const owner = new EntityBuilder(registry).GetEntity();
  const herdGoal = new HerdGoal();

  registry.RegisterEntity(owner, HerdOwner, herdOwner);
  registry.RegisterEntity(owner, HerdGoal, herdGoal);

  const members = tiles.map(([x, y]) =>
    new EntityBuilder(registry)
      .AddPosition(new Position(x, y))
      .AddMovement(AnimalSpeed)
      .AddNeeds()
      .AddOwner(owner)
      .GetEntity()
  );

  const needsOf = (member : Entity) => registry.GetComponent(member, Needs)!;

  /**
   * One full frame, in the order GameLoopLayers runs them.
   *
   * `beforeSteer` runs after everything has moved and before the AI reads the world, which
   * is the only point at which a test can place something relative to where the herd
   * actually is now. Moving a pursuer at the top of the frame instead leaves it a step
   * behind every tick, and over a hundred ticks that lag is enough for the herd to escape
   * something meant to be chasing it.
   */
  const FullTick = (seconds = 1 / 60, beforeSteer? : () => void) => {
    const time = new TimeResources();
    time.deltaSeconds = seconds;

    HandleMovement(registry, new EventQueue(new LinkedList()), time);
    UpdateNeeds(registry, time);

    if (beforeSteer) beforeSteer();

    SteerHerds(registry, world, new LinearCongruentialGenerator(12345));
  };

  /** Where the herd is now. */
  const CentreOf = () => {
    const positions = members.map((member) => registry.GetComponent(member, Position)!);

    return new Position(
      positions.reduce((total, position) => total + position.x, 0) / positions.length,
      positions.reduce((total, position) => total + position.y, 0) / positions.length
    );
  };

  return { registry, owner, herdGoal, herdOwner, members, world, needsOf, FullTick, CentreOf };
}

/** Makes every member of a herd thirsty enough for the herd to want to travel. */
function MakeThirsty(scene : ReturnType<typeof BuildHerdOn>, level = 0.1) {
  scene.members.forEach((member) => {scene.needsOf(member).water = level});
}

function SpreadOf(scene : ReturnType<typeof BuildHerdOn>) {
  const positions = scene.members.map((member) => PositionOf(scene.registry, member));

  return Math.max(...positions.map((a) => Math.max(...positions.map((b) => DistanceBetween(a, b)))));
}

describe("keeping off ground animals cannot walk on", () => {
  /** Grass in a narrow corridor, impassable mountain either side of it. */
  const CorridorWorld = () => BuildTestWorld(ShapedNoise((_x, y) => (y >= 40 && y <= 60 ? GrassNoise : MountainNoise)));

  /** Land east of x = 50, deep ocean west of it. */
  const CoastWorld = () => BuildTestWorld(ShapedNoise((x) => (x >= 50 ? GrassNoise : DeepWaterNoise)));

  it("never writes a target onto impassable ground", () => {
    // The requirement-4 guarantee, and why a per-member veto survives even though the
    // terrain sampling is coarse and shared: sampling nudges, the veto promises.
    const world = CorridorWorld();
    const scene = BuildHerdOn(world, [[50, 50], [52, 50], [51, 52], [49, 51]]);

    for (let tick = 0; tick < 200; tick++) {
      scene.FullTick();

      scene.members.forEach((member) => {
        const target = TargetOf(scene.registry, member);

        if (target) expect(IsPassableTerrain(world, target.x, target.y)).toBe(true);
      });
    }
  });

  it("keeps the herd off the mountainside over a long run", () => {
    const world = CorridorWorld();
    const scene = BuildHerdOn(world, [[50, 50], [52, 50], [51, 52], [49, 51]]);

    for (let tick = 0; tick < 400; tick++) scene.FullTick();

    scene.members.forEach((member) => {
      const position = PositionOf(scene.registry, member);

      expect(IsPassableTerrain(world, position.x, position.y)).toBe(true);
    });
  });

  it("does not wander into the sea from a coastline", () => {
    const world = CoastWorld();
    const scene = BuildHerdOn(world, [[55, 50], [57, 50], [56, 52], [54, 51]]);

    for (let tick = 0; tick < 400; tick++) scene.FullTick();

    scene.members.forEach((member) => expect(PositionOf(scene.registry, member).x).toBeGreaterThan(49));
  });

  it("lets an animal that starts stranded walk back out", () => {
    // Herds are scattered over a radius when they spawn and the world streams in under
    // them, so an animal in the sea is a normal situation to recover from. Vetoing its
    // moves as well would freeze it there permanently.
    const world = CoastWorld();
    const scene = BuildHerdOn(world, [[20, 50], [55, 50], [57, 50], [56, 52]]);

    const stranded = scene.members[0]!;
    const before = PositionOf(scene.registry, stranded).Copy();

    for (let tick = 0; tick < 120; tick++) scene.FullTick();

    expect(PositionOf(scene.registry, stranded).x).toBeGreaterThan(before.x);
  });

  it("produces no NaN on hostile terrain", () => {
    const world = CorridorWorld();
    const scene = BuildHerdOn(world, [[50, 50], [52, 50], [51, 52], [49, 51]]);

    MakeThirsty(scene);

    for (let tick = 0; tick < 200; tick++) scene.FullTick();

    scene.members.forEach((member) => {
      const position = PositionOf(scene.registry, member);

      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
  });

  it("leaves a herd with no appetites foraging, exactly as it always did", () => {
    // The defaulting rule that keeps every one of the steering tests above on the Forage
    // path: a member with no Needs contributes nothing, and a herd with no contributors
    // reads as fully sated on every axis.
    const { registry, herdGoal } = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    HandleAIMovement(registry);

    expect(herdGoal.State).toBe(HerdState.Forage);
  });
});

describe("breaking off to drink", () => {
  /** A lake east of x = 80, grass everywhere else. */
  const LakeWorld = () => BuildTestWorld(ShapedNoise((x) => (x > 80 ? ShallowWaterNoise : GrassNoise)));

  /** Standing water everywhere, for tests about the act of drinking rather than the trip. */
  const PuddleWorld = () => BuildTestWorld(FlatNoise(ShallowWaterNoise));

  it("walks a thirsty herd to water, drinks, and settles down again", () => {
    // The one end-to-end test for the whole feature: the herd notices it is thirsty,
    // decides to travel, arrives, stops being a boid long enough to actually drink, and
    // then stops wanting to travel.
    const world = LakeWorld();
    const scene = BuildHerdOn(world, [[60, 50], [62, 50], [61, 52], [59, 51]]);

    MakeThirsty(scene);

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.Migrate);

    let everCollected = false;

    for (let tick = 0; tick < 4000; tick++) {
      scene.FullTick();

      if (scene.members.some((member) => scene.registry.GetComponent(member, CollectingResource))) {
        everCollected = true;
      }

      if (scene.herdGoal.State === HerdState.Forage) break;
    }

    // It reached the water and stood in it.
    expect(everCollected).toBe(true);
    scene.members.forEach((member) => expect(PositionOf(scene.registry, member).x).toBeGreaterThan(70));
    // And having drunk, it stopped needing to travel.
    expect(scene.herdGoal.State).toBe(HerdState.Forage);
    expect(scene.needsOf(scene.members[0]!).water).toBeGreaterThan(MigrateEnterThreshold);
  });

  /** Ticks until at least one member has stopped to drink, and hands it back. */
  function TickUntilDrinking(scene : ReturnType<typeof BuildHerdOn>) {
    for (let tick = 0; tick < 60; tick++) {
      scene.FullTick();

      const drinker = scene.members.find((member) => scene.registry.GetComponent(member, CollectingResource));

      if (drinker !== undefined) return drinker;
    }

    return undefined;
  }

  it("holds a drinking animal perfectly still", () => {
    // Standing still is the absence of a target, so the position must not drift by even a
    // floating-point step. A target equal to its own position would instead have
    // HandleMovement strip it and the animal flicker between moving and not.
    const scene = BuildHerdOn(PuddleWorld(), [[50, 50], [52, 50], [51, 52]]);

    MakeThirsty(scene);

    const drinker = TickUntilDrinking(scene)!;

    expect(drinker).toBeDefined();

    const before = PositionOf(scene.registry, drinker).Copy();

    for (let tick = 0; tick < 10; tick++) {
      if (!scene.registry.GetComponent(drinker, CollectingResource)) break;

      scene.FullTick();

      expect(PositionOf(scene.registry, drinker).x).toBe(before.x);
      expect(PositionOf(scene.registry, drinker).y).toBe(before.y);
    }
  });

  it("gives a drinking animal no target to walk to", () => {
    const scene = BuildHerdOn(PuddleWorld(), [[50, 50], [52, 50], [51, 52]]);

    MakeThirsty(scene);

    const drinker = TickUntilDrinking(scene)!;

    expect(drinker).toBeDefined();
    expect(TargetOf(scene.registry, drinker)).toBeUndefined();
  });

  it("abandons the drink within one tick of a predator closing in", () => {
    const scene = BuildHerdOn(PuddleWorld(), [[50, 50], [52, 50], [51, 52]]);

    MakeThirsty(scene);

    expect(TickUntilDrinking(scene)).toBeDefined();

    // Severe enough on its own to alarm the herd, and standing on top of it.
    new EntityBuilder(scene.registry)
      .AddPosition(new Position(50, 50))
      .AddPredator(ClumpThreatTotal)
      .GetEntity();

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.DefensiveClump);
    scene.members.forEach((member) => {
      expect(scene.registry.GetComponent(member, CollectingResource)).toBeUndefined();
    });
  });

  it("scans for its destination once rather than every tick", () => {
    // Re-deriving the destination every frame would be thousands of noise samples a frame
    // to produce an answer that has not changed since the herd set off.
    let probes = 0;

    // Water within the radius the herd will believe in, but well outside the ring it
    // samples for free -- so the first tick genuinely has to scan, and the point of the
    // test is that no later tick does.
    const world = BuildTestWorld({
      GetNoise : (x : number) => {probes++; return x > 120 ? ShallowWaterNoise : GrassNoise},
    });

    const scene = BuildHerdOn(world, [[60, 50], [62, 50], [61, 52]]);

    MakeThirsty(scene);

    scene.FullTick();

    const duringScan = probes;

    probes = 0;
    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.Migrate);
    expect(probes * 10).toBeLessThan(duringScan);
  });

  it("rations outward scans across many thirsty herds in one tick", () => {
    const world = BuildTestWorld(ShapedNoise((x) => (x > 400 ? ShallowWaterNoise : GrassNoise)));
    const registry = BuildTestRegistry();

    // Ten herds, all thirsty, all needing to look. Without a shared budget this one tick
    // would pay for ten outward scans.
    for (let herd = 0; herd < 10; herd++) {
      const owner = new EntityBuilder(registry).GetEntity();

      registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
      registry.RegisterEntity(owner, HerdGoal, new HerdGoal(HerdState.Migrate));

      new EntityBuilder(registry)
        .AddPosition(new Position(herd * 5, 50))
        .AddMovement(AnimalSpeed)
        .AddNeeds(new Needs(1, 0.05, 1))
        .AddOwner(owner);
    }

    SteerHerds(registry, world, new LinearCongruentialGenerator(7));

    let herdsWithDestinations = 0;

    registry.ForEachEntityWith([HerdGoal], (_, goal) => {
      if (goal.Destination !== undefined) herdsWithDestinations++;
    });

    // Only the herds the budget served got one. The rest look again next frame, which is
    // invisible; a sixteen-millisecond frame would not be.
    expect(herdsWithDestinations).toBeLessThanOrEqual(MaxGoalScansPerTick);
  });
});

describe("defending against predators", () => {
  it("ignores one person enough to carry on grazing", () => {
    // The band below the scatter threshold. A lone walker makes a herd edge away while it
    // keeps grazing -- which is what every one of the human tests above depends on.
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    new EntityBuilder(scene.registry).AddPosition(new Position(50, 50)).AddHuman().GetEntity();

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.Forage);
  });

  it("scatters from a pair of people closing in", () => {
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    new EntityBuilder(scene.registry).AddPosition(new Position(50, 50)).AddHuman().GetEntity();
    new EntityBuilder(scene.registry).AddPosition(new Position(51, 50)).AddHuman().GetEntity();

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.DefensiveScatter);
  });

  it("bunches up against a crowd", () => {
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    for (let person = 0; person < 6; person++) {
      new EntityBuilder(scene.registry)
        .AddPosition(new Position(50 + person * 0.2, 50))
        .AddHuman()
        .GetEntity();
    }

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.DefensiveClump);
  });

  it("ignores a severe predator that is still far away", () => {
    // Severity decides WHICH defence, never whether one is needed at all. Distance
    // decides that, which is what keeps a wolf on the horizon from freezing the world.
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    new EntityBuilder(scene.registry)
      .AddPosition(new Position(400, 400))
      .AddPredator(ClumpThreatTotal * 10)
      .GetEntity();

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.Forage);
  });

  it("draws closer together when it bunches than when it scatters", () => {
    // The behaviour the two states exist to produce, measured on the animals rather than
    // asserted about the weights.
    //
    // The pack PURSUES, held at a fixed offset from the herd's centre each tick. Parked
    // in one place it would simply be escaped -- correctly, since the herd runs and the
    // threat total falls back to nothing -- and the states under test would lapse back to
    // Forage before the spread had settled.
    // ONE pursuer each, identical but for its severity. Severity does not scale the
    // avoidance push -- that is deliberate in the design -- so both herds feel exactly the
    // same force from exactly the same place, and the only thing differing between the two
    // runs is which state the total put them in, and therefore which weights they used.
    // Six stacked predators for the clump case would have summed to six times the
    // avoidance and swamped the spacing this is measuring.
    const tiles = () => [[48, 48], [52, 48], [48, 52], [52, 52]] as [number, number][];

    const clumping = BuildHerdOn(BuildGrassWorld(), tiles());
    const scattering = BuildHerdOn(BuildGrassWorld(), tiles());

    const runs = [
      {scene : clumping, hunter : new Position(50, 47), severity : ClumpThreatTotal},
      {scene : scattering, hunter : new Position(50, 47), severity : ScatterThreatTotal}
    ];

    runs.forEach(({scene, hunter, severity}) => {
      new EntityBuilder(scene.registry).AddPosition(hunter).AddPredator(severity).GetEntity();
    });

    for (let tick = 0; tick < 90; tick++) {
      runs.forEach(({scene, hunter}) => {
        scene.FullTick(1 / 60, () => {
          // Held just inside the panic radius of whichever animal is nearest, so the state
          // persists for the whole run.
          //
          // The nearest ANIMAL rather than the herd's centre, because a scattering herd
          // empties its own middle: a pursuer tracking the centroid ends up standing where
          // nobody is left, the threat lapses, and the state under test reverts to Forage
          // before the spacing has settled. Tracking whoever is closest is also what a
          // predator would actually do.
          const nearest = scene.members
            .map((member) => PositionOf(scene.registry, member))
            .reduce((closest, position) =>
              Math.hypot(position.x - hunter.x, position.y - hunter.y)
                < Math.hypot(closest.x - hunter.x, closest.y - hunter.y) ? position : closest
            );

          hunter.x = nearest.x;
          hunter.y = nearest.y - 2;
        });
      });
    }

    expect(clumping.herdGoal.State).toBe(HerdState.DefensiveClump);
    expect(scattering.herdGoal.State).toBe(HerdState.DefensiveScatter);
    expect(SpreadOf(clumping)).toBeLessThan(SpreadOf(scattering));
  });
});

describe("sleeping", () => {
  it("stops an exhausted herd where it stands, and wakes it rested", () => {
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    scene.members.forEach((member) => {scene.needsOf(member).sleep = 0.01});

    scene.FullTick();

    expect(scene.herdGoal.State).toBe(HerdState.Sleep);

    const before = scene.members.map((member) => PositionOf(scene.registry, member).Copy());

    scene.FullTick();

    // Resting is the same mechanism as drinking: no target, so nothing moves it.
    scene.members.forEach((member, index) => {
      expect(PositionOf(scene.registry, member).x).toBe(before[index]!.x);
      expect(PositionOf(scene.registry, member).y).toBe(before[index]!.y);
      expect(TargetOf(scene.registry, member)).toBeUndefined();
    });

    // Sleep it off. A whole second per tick, so this does not take thousands of frames.
    for (let tick = 0; tick < 300 && scene.herdGoal.State === HerdState.Sleep; tick++) scene.FullTick(1);

    expect(scene.herdGoal.State).not.toBe(HerdState.Sleep);
  });
});

describe("walking up to a mountain", () => {
  /**
   * A wall of mountain across the whole world east of x = 70.
   *
   * A herd put to the west of it and pointed east has nowhere to go but along the face,
   * which is the situation that used to pin herds in place: the wander target sat inside
   * the range, the herd could never arrive at it, and nothing else would ever replace it.
   */
  const WallWorld = () => BuildTestWorld(ShapedNoise((x) => (x < 70 ? GrassNoise : MountainNoise)));

  /** How far the herd's centre travelled over a run. */
  function DistanceTravelled(scene : ReturnType<typeof BuildHerdOn>, ticks : number) {
    const CentreOf = () => {
      const positions = scene.members.map((member) => PositionOf(scene.registry, member));

      return new Position(
        positions.reduce((total, position) => total + position.x, 0) / positions.length,
        positions.reduce((total, position) => total + position.y, 0) / positions.length
      );
    };

    const start = CentreOf();

    for (let tick = 0; tick < ticks; tick++) scene.FullTick();

    return DistanceBetween(start, CentreOf());
  }

  it("does not stand about in front of it", () => {
    // The reported bug: a herd that met a mountain stopped dead a few tiles short of it
    // and stayed there.
    //
    // Measured on the herd's CENTRE, which is the thing that was really wrong. The
    // animals were never entirely motionless -- they jostled on the spot -- so a test
    // watching individuals move would have passed while the herd went nowhere at all.
    //
    // Ten seconds: long enough to include one stall and the decisive turn that follows
    // it, which is the mechanism under test, and still far short of the fifteen the herd
    // used to need before it thought to leave.
    const scene = BuildHerdOn(WallWorld(), [[66, 50], [67, 50], [66, 51], [67, 51]]);

    // Pointed straight at the wall, so the goal term fights the terrain term head-on.
    scene.herdGoal.WanderBearing = 0;
    scene.herdGoal.WanderTarget = new Position(92, 50);

    expect(DistanceTravelled(scene, 600)).toBeGreaterThan(8);
  });

  it("keeps every animal moving rather than freezing some of them", () => {
    // The twitch. A member whose steering pointed into the rock used to be given no
    // target at all, so it stood perfectly still until the terrain jitter happened to
    // produce a vector that passed the veto.
    const scene = BuildHerdOn(WallWorld(), [[66, 50], [67, 50], [66, 51], [67, 51]]);

    scene.herdGoal.WanderBearing = 0;
    scene.herdGoal.WanderTarget = new Position(92, 50);

    const before = scene.members.map((member) => PositionOf(scene.registry, member).Copy());

    for (let tick = 0; tick < 120; tick++) scene.FullTick();

    scene.members.forEach((member, index) => {
      expect(DistanceBetween(PositionOf(scene.registry, member), before[index]!)).toBeGreaterThan(1);
    });
  });

  it("gives up on an unreachable destination instead of waiting forever", () => {
    // The missing mechanism. A wander target was replaced only on ARRIVAL, and a herd
    // blocked by a mountain never arrives -- so nothing was ever going to tell it to
    // choose again.
    const scene = BuildHerdOn(WallWorld(), [[66, 50], [67, 50], [66, 51], [67, 51]]);

    scene.herdGoal.WanderBearing = 0;
    scene.herdGoal.WanderTarget = new Position(92, 50);

    const unreachable = scene.herdGoal.WanderTarget;

    // A little over the stall allowance, at a tick length that makes the arithmetic plain.
    for (let tick = 0; tick < StallSecondsMax + 2; tick++) scene.FullTick(1);

    expect(scene.herdGoal.WanderTarget).not.toBe(unreachable);
  });

  it("does not re-roll a leg that is making perfectly good progress", () => {
    // The other half of the stall rule. A timeout on the LEG would throw away long
    // journeys that were going fine; this is a timeout on getting nowhere.
    const scene = BuildHerdOn(BuildGrassWorld(), [[50, 50], [52, 50], [51, 52]]);

    scene.FullTick();

    const target = scene.herdGoal.WanderTarget;

    expect(target).toBeDefined();

    for (let tick = 0; tick < StallSecondsMax + 4; tick++) scene.FullTick(0.5);

    expect(scene.herdGoal.WanderTarget).toBe(target);
  });

  it("never puts an animal onto the mountain while working its way around", () => {
    const world = WallWorld();
    const scene = BuildHerdOn(world, [[66, 50], [67, 50], [66, 51], [67, 51]]);

    scene.herdGoal.WanderBearing = 0;
    scene.herdGoal.WanderTarget = new Position(92, 50);

    for (let tick = 0; tick < 300; tick++) {
      scene.FullTick();

      scene.members.forEach((member) => {
        expect(IsPassableTerrain(world, PositionOf(scene.registry, member).x, PositionOf(scene.registry, member).y)).toBe(true);
      });
    }
  });

  it("gets a thirsty herd around a wall to water on the far side", () => {
    // The end-to-end version: the water is genuinely reachable, but only by going around.
    // A herd that gives up on stalled destinations keeps choosing until one works.
    const world = BuildTestWorld(ShapedNoise((x, y) => {
      if (x > 70 && x < 80 && y > 20) return MountainNoise;
      if (x >= 80) return ShallowWaterNoise;

      return GrassNoise;
    }));

    const scene = BuildHerdOn(world, [[60, 50], [62, 50], [61, 52], [59, 51]]);

    MakeThirsty(scene);

    let everCollected = false;

    for (let tick = 0; tick < 6000; tick++) {
      scene.FullTick();

      if (scene.members.some((member) => scene.registry.GetComponent(member, CollectingResource))) {
        everCollected = true;
        break;
      }
    }

    expect(everCollected).toBe(true);
  });
});
