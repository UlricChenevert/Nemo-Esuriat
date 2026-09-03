import { describe, it, expect } from "vitest";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { ChunkWidth, MaxHerdSize, MaxLiveHerds, MinHerdSize } from "../../Configuration/WorldConstants.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Owns } from "../../Contracts/Components/Owns.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import type { IRandomNumberGenerator } from "../../Interfaces/IRandomNumberGenerator.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import { InMemoryKeyValueStore } from "../../Libraries/Storage/InMemoryKeyValueStore.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { PopulateHerds } from "../../Systems.Gameloop/PopulateHerds.ts";
import { StreamChunks } from "../../Systems.Gameloop/StreamChunks.ts";
import { AddCameraViewing, BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { FindCameraPosition } from "../../Utilities/CameraUtilities.ts";

/** Terrain noise that puts the whole world in one band. */
function FlatNoise(value : number) {
  return { GetNoise: () => value };
}

/** Above every threshold, so every tile is mountain and nothing is water. */
const AllLand = FlatNoise(0.99);

/** Below the grassland threshold everywhere, so no tile can hold a herd. */
const AllWater = FlatNoise(0);

function BuildWorld(noise : {GetNoise : (x : number, y : number) => number}) {
  return new WorldStreamingResources(noise, new InMemoryKeyValueStore(), 1000);
}

/**
 * A generator returning a fixed cycle, so a test can decide exactly which
 * spawn rolls succeed.
 *
 * PopulateHerds draws in a fixed order per chunk -- the spawn roll, then pairs
 * of tile coordinates, then the herd size -- and a cycling source lets a test
 * pin the roll without having to predict the draws in between.
 */
function CyclingRandom(...values : number[]) : IRandomNumberGenerator {
  let index = 0;

  return { Random: () => values[index++ % values.length]! };
}

/** Every herd owner in the registry. */
function HerdOwners(registry : GlobalRegistry) : Entity[] {
  const owners : Entity[] = [];

  registry.ForEachEntityWith([HerdOwner, Owns], (owner) => {owners.push(owner);});

  return owners;
}

function MembersOf(registry : GlobalRegistry, owner : Entity) : Entity[] {
  const owns = registry.GetComponent(owner, Owns);

  return owns ? owns.entities.filter((member) => registry.IsAlive(member)) : [];
}

/**
 * A herd whose animals all stand at the given tile, standing in for one the
 * world spawned earlier.
 */
function AddHerdAt(registry : GlobalRegistry, x : number, y : number) : Entity {
  const owner = registry.CreateEntity();

  registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
  registry.RegisterEntity(owner, Position, new Position(x, y));

  const member = registry.CreateEntity();

  registry.RegisterEntity(member, Position, new Position(x, y));
  registry.RegisterEntity(owner, Owns, new Owns(member));

  return owner;
}

/**
 * Adds the camera with the viewport's top-left corner on the given world tile,
 * and hands back its live Position so a test can pan it.
 *
 * Stated as the corner rather than the centre because these tests care whether
 * a spawn landed on screen, and the viewport's edges are what decide that.
 */
function ViewOrigin(registry : GlobalRegistry, originX : number, originY : number) : Position {
  AddCameraViewing(registry, originX, originY);

  return FindCameraPosition(registry)!;
}

/** Streams the initial buffer, leaving its chunks queued for population. */
function StreamInitialChunks(registry : GlobalRegistry, world : WorldStreamingResources) {
  StreamChunks(registry, world);
}

describe("populating streamed chunks", () => {
  it("spawns herds on newly loaded land", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    // Every roll succeeds, but the cap still applies.
    PopulateHerds(registry, world, CyclingRandom(0));

    expect(HerdOwners(registry).length).toBeGreaterThan(0);
  });

  it("spawns nothing when no chunks were loaded this tick", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0));

    const afterFirst = HerdOwners(registry).length;

    // The camera has not moved, so StreamChunks early-outs and loads nothing.
    StreamChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0));

    expect(HerdOwners(registry).length).toBe(afterFirst);
  });

  it("does not repopulate the same chunks on a later tick", () => {
    // The bug this guards against is StreamChunks' record of what it loaded
    // outliving the tick that filled it, which would put a herd on the same
    // ground every frame until the cap hid the leak.
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0));

    for (let tick = 0; tick < 5; tick++) {
      StreamChunks(registry, world);

      expect(world.chunksLoadedThisTick.length).toBe(0);
    }
  });

  it("respects the spawn chance", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    // Every roll is a certain miss.
    PopulateHerds(registry, world, CyclingRandom(0.999));

    expect(HerdOwners(registry)).toEqual([]);
  });

  it("leaves an all-water chunk empty", () => {
    // A land animal has nowhere to stand on open ocean, and the placement
    // search has to give up rather than drop one in the sea.
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllWater);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0));

    expect(HerdOwners(registry)).toEqual([]);
  });

  it("never places a herd on water", () => {
    // Ocean to the west of x = 0, mountain to the east. Only the herd's anchor
    // is guaranteed dry -- its animals scatter from there -- so the anchor is
    // what gets checked.
    const world = BuildWorld({GetNoise: (x : number) => (x < 0 ? 0 : 0.99)});
    const registry = BuildTestRegistry();
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, new LinearCongruentialGenerator(7));

    const anchors = HerdOwners(registry).map((owner) => registry.GetComponent(owner, Position)!);

    expect(anchors.length).toBeGreaterThan(0);
    anchors.forEach((anchor) => expect(anchor.x).toBeGreaterThanOrEqual(0));
  });

  it("does not spawn a herd inside the viewport", () => {
    // Animals winking into existence in front of the player is the thing to
    // avoid; off-screen ground is fair game.
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, new LinearCongruentialGenerator(3));

    HerdOwners(registry).forEach((owner) => {
      const anchor = registry.GetComponent(owner, Position)!;
      const onScreen = anchor.x >= 0 && anchor.x < GameWidth && anchor.y >= 0 && anchor.y < GameWidth;

      expect(onScreen).toBe(false);
    });
  });

  it("gives each herd a size within the configured range", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, new LinearCongruentialGenerator(11));

    const owners = HerdOwners(registry);

    expect(owners.length).toBeGreaterThan(0);

    owners.forEach((owner) => {
      const size = MembersOf(registry, owner).length;

      expect(size).toBeGreaterThanOrEqual(MinHerdSize);
      expect(size).toBeLessThanOrEqual(MaxHerdSize);
    });
  });

  it("draws different layouts for herds spawned in the same tick", () => {
    // Seeding a generator per herd from the clock made every herd streamed in
    // one tick an exact copy of its neighbour.
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    ViewOrigin(registry, 0, 0);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, new LinearCongruentialGenerator(5));

    const owners = HerdOwners(registry);

    expect(owners.length).toBeGreaterThan(1);

    // Each animal's offset from its own herd's anchor. Two herds built from the
    // same seed would produce identical offset lists.
    const layouts = owners.map((owner) => {
      const anchor = registry.GetComponent(owner, Position)!;

      return MembersOf(registry, owner)
        .map((member) => {
          const position = registry.GetComponent(member, Position)!;

          return `${(position.x - anchor.x).toFixed(4)},${(position.y - anchor.y).toFixed(4)}`;
        })
        .join(" ");
    });

    expect(new Set(layouts).size).toBe(layouts.length);
  });
});

describe("bounding the herd population", () => {
  it("never leaves more than the cap alive", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllLand);
    const camera = ViewOrigin(registry, 0, 0);

    // Walk a long way, streaming and populating the whole distance.
    for (let step = 0; step < 30; step++) {
      camera.x += ChunkWidth;

      StreamChunks(registry, world);
      PopulateHerds(registry, world, new LinearCongruentialGenerator(step + 1));

      expect(HerdOwners(registry).length).toBeLessThanOrEqual(MaxLiveHerds);
    }
  });

  it("retires the furthest herd first", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllWater);
    ViewOrigin(registry, 0, 0);

    const near = AddHerdAt(registry, 50, 50);
    const far : Entity[] = [];

    for (let index = 0; index < MaxLiveHerds; index++) {
      far.push(AddHerdAt(registry, 5000 + index * 100, 50));
    }

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0.999));

    expect(registry.IsAlive(near)).toBe(true);
    // The single most distant one goes, and only it: the population was one
    // over the cap.
    expect(registry.IsAlive(far[far.length - 1]!)).toBe(false);
    expect(far.filter((herd) => registry.IsAlive(herd)).length).toBe(MaxLiveHerds - 1);
  });

  it("judges distance by where the herd is now, not where it spawned", () => {
    // A herd roams a long way from its anchor. Culling on the stale anchor
    // would delete the herd standing next to the player.
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllWater);
    ViewOrigin(registry, 0, 0);

    const roamer = AddHerdAt(registry, 9000, 9000);

    // Its animal has since walked to the viewport, even though the owner's
    // anchor still says the far side of the world.
    const member = MembersOf(registry, roamer)[0]!;
    registry.GetComponent(member, Position)!.x = 50;
    registry.GetComponent(member, Position)!.y = 50;

    for (let index = 0; index < MaxLiveHerds; index++) AddHerdAt(registry, 500 + index, 500);

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0.999));

    expect(registry.IsAlive(roamer)).toBe(true);
  });

  it("takes a retired herd's animals with it", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllWater);
    ViewOrigin(registry, 0, 0);

    AddHerdAt(registry, 50, 50);

    const doomed : Entity[] = [];

    for (let index = 0; index <= MaxLiveHerds; index++) doomed.push(AddHerdAt(registry, 9000 + index * 100, 9000));

    const members = doomed.flatMap((herd) => MembersOf(registry, herd));

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0.999));

    const survivingMembers = members.filter((member) => registry.IsAlive(member));
    const survivingHerds = doomed.filter((herd) => registry.IsAlive(herd));

    // However many herds went, none of them left an orphaned animal behind.
    expect(survivingMembers.length).toBe(survivingHerds.length);
  });

  it("leaves a population under the cap untouched", () => {
    const registry = BuildTestRegistry();
    const world = BuildWorld(AllWater);
    ViewOrigin(registry, 0, 0);

    const herds = [AddHerdAt(registry, 9000, 9000), AddHerdAt(registry, 50, 50)];

    StreamInitialChunks(registry, world);
    PopulateHerds(registry, world, CyclingRandom(0.999));

    expect(herds.every((herd) => registry.IsAlive(herd))).toBe(true);
  });
});
