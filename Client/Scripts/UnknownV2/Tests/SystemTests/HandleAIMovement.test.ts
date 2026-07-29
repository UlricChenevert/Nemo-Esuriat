import { describe, it, expect } from "vitest";
import { AnimalSpeed, HumanSpeed } from "../../Configuration/GameConstants.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { TimeResources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandleAIMovement } from "../../Systems.Gameloop/HandleAIMovement.ts";
import { HandleMovement } from "../../Systems.Gameloop/HandleMovement.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

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

  const members = tiles.map(([x, y]) =>
    new EntityBuilder(registry)
      .AddPosition(new Position(x, y))
      .AddMovement(AnimalSpeed)
      .AddOwner(owner)
      .GetEntity()
  );

  return { registry, owner, members, herdOwner };
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
    herd.herdOwner.WanderTarget = new Position(60, 60);
    alone.herdOwner.WanderTarget = new Position(60, 60);

    HandleAIMovement(herd.registry);
    HandleAIMovement(alone.registry);

    expect(SteeringOf(herd.registry, herd.members[0]!))
      .toEqual(SteeringOf(alone.registry, alone.members[0]!));
  });

  it("outweighs the herd's own cohesion", () => {
    // The straggler's flock is on the same side as the person, so cohesion and
    // the wander goal both pull it back toward them. Fleeing has to win, or an
    // animal walks through someone to rejoin its herd.
    const herdOwner = new HerdOwner();
    const { registry, members } = BuildHerd([[50, 50], [40, 50], [40, 51], [41, 50]], herdOwner);

    herdOwner.WanderTarget = new Position(40, 50);

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
    registry.GetComponent(owner, HerdOwner)!.WanderTarget = undefined;

    expect(() => HandleAIMovement(registry)).not.toThrow();
  });
});

describe("the wander target", () => {
  it("is seeded from where the herd actually is", () => {
    const { registry, herdOwner } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 10));

    expect(herdOwner.WanderTarget).toBeUndefined();

    HandleAIMovement(registry);

    const target = herdOwner.WanderTarget!;

    expect(target).toBeDefined();
    expect(DistanceBetween(target, new Position(51, 50.666666666666664))).toBeCloseTo(10);
  });

  it("bends away from the current bearing rather than jumping", () => {
    // The complaint this guards against is the herd reversing on the spot every
    // time it arrived, which is what freely drawn destinations produce: half of
    // them sit behind the herd.
    const herdOwner = new HerdOwner(1, 2, 25, 2, 8, Math.PI / 5);
    const { registry } = BuildHerd([[50, 50], [52, 50], [51, 52]], herdOwner);

    HandleAIMovement(registry);

    let previous = herdOwner.WanderBearing!;

    for (let leg = 0; leg < 40; leg++) {
      // Stand the herd on its target so the next tick counts as an arrival.
      herdOwner.WanderTarget = new Position(51, 51);

      HandleAIMovement(registry);

      const turn = Math.abs(AngleBetween(previous, herdOwner.WanderBearing!));

      expect(turn).toBeLessThanOrEqual(Math.PI / 5 + 1e-9);

      previous = herdOwner.WanderBearing!;
    }
  });

  it("roams from wherever the herd is, however far from the origin", () => {
    // The world streams around the camera and has no border. Rejecting targets
    // against GameWidth -- which measures the viewport, not the world -- sent
    // every herd past the first hundred tiles to one shared fallback point, and
    // they piled up into a single enormous herd.
    const herdOwner = new HerdOwner();
    const { registry } = BuildHerd([[8000, 8000], [8002, 8000], [8001, 8002]], herdOwner);

    HandleAIMovement(registry);

    const target = herdOwner.WanderTarget!;

    expect(DistanceBetween(target, new Position(8001, 8000.666666666666))).toBeCloseTo(herdOwner.WanderRadius);
  });

  it("sends distant herds to different places", () => {
    // The same bug from the other side: two herds nowhere near each other must
    // not be handed the same destination.
    const first = new HerdOwner();
    const second = new HerdOwner();

    const registry = BuildTestRegistry();

    [
      {tiles: [[4000, 4000], [4002, 4000]] as [number, number][], owner: first},
      {tiles: [[-4000, -4000], [-4002, -4000]] as [number, number][], owner: second},
    ].forEach(({tiles, owner}) => {
      const herdEntity = new EntityBuilder(registry).GetEntity();

      registry.RegisterEntity(herdEntity, HerdOwner, owner);

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
    const { registry, herdOwner } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25));

    HandleAIMovement(registry);

    const first = herdOwner.WanderTarget!;

    HandleAIMovement(registry);

    expect(herdOwner.WanderTarget).toBe(first);
  });

  it("re-rolls once the herd arrives", () => {
    const { registry, herdOwner } = BuildHerd([[50, 50], [52, 50], [51, 52]]);

    HandleAIMovement(registry);

    const first = herdOwner.WanderTarget!;

    // Drop it on the herd's doorstep; the next tick should judge it reached.
    herdOwner.WanderTarget = new Position(51, 51);

    HandleAIMovement(registry);

    expect(herdOwner.WanderTarget).not.toBe(first);
    expect(herdOwner.WanderTarget).not.toEqual(new Position(51, 51));
  });

  it("always sits one wander radius from the herd", () => {
    const { registry, herdOwner } = BuildHerd([[50, 50], [52, 50], [51, 52]], new HerdOwner(1, 2, 25));

    for (let tick = 0; tick < 50; tick++) {
      // Stand the herd on its target so every iteration rolls a fresh one.
      herdOwner.WanderTarget = new Position(51, 50.666666666666664);

      HandleAIMovement(registry);

      expect(DistanceBetween(herdOwner.WanderTarget!, new Position(51, 50.666666666666664)))
        .toBeCloseTo(25);
    }
  });
});
