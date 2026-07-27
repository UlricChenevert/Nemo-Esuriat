import { describe, it, expect } from "vitest";
import { PlayerLayer } from "../../Configuration/DisplayConstants.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import { Layer } from "../../Contracts/Components/Layer.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { SelectionState } from "../../Contracts/Components/SelectionState.ts";
import { TargetLocation } from "../../Contracts/Components/TargetLocation.ts";
import { GameClickEvent } from "../../Contracts/Events/GameClickEvent.ts";
import { MovementFlag } from "../../Contracts/Tags/MovementFlag.ts";
import { TimeResources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";
import { HandleInputEvents } from "../../Systems.Gameloop/HandleInputEvents.ts";
import { HandleMovement } from "../../Systems.Gameloop/HandleMovement.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

/**
 * GameClickEvent derives its position from a MouseEvent, a canvas and a camera,
 * none of which exist here. The systems only ever read `position`, so the event is
 * built on the prototype directly -- faking a bounding rectangle would test
 * WorldTileOfScreenTile rather than the click handling this file is about.
 */
function ClickAt(x : number, y : number) : GameClickEvent {
  return Object.assign(Object.create(GameClickEvent.prototype) as GameClickEvent, { position: new Position(x, y) });
}

/** A player owning one selectable, moveable character at the given tile. */
function BuildWorld(characterX = 10, characterY = 10, speed = 1) {
  const registry = BuildTestRegistry();

  const player = new EntityBuilder(registry)
    .AddTags(false, false, true, false)
    .GetEntity();

  const character = new EntityBuilder(registry)
    .AddPosition(new Position(characterX, characterY))
    .AddLayer(new Layer(PlayerLayer))
    .AddMovement(speed)
    .AddTags(true, true, false, false)
    .AddOwner(player)
    .GetEntity();

  return { registry, player, character };
}

/** Runs one frame of input handling for the given clicks. */
function Click(registry : GlobalRegistry, ...clicks : GameClickEvent[]) {
  const queue = new EventQueue(new LinkedList());
  clicks.forEach((click) => queue.EnqueueEvent(click));

  HandleInputEvents(registry, queue);

  return queue;
}

/** Every live movement flag, so "was it replaced" and "was it removed" are both checkable. */
function FlagsIn(registry : GlobalRegistry) {
  const flags : { entity : Entity, position : Position }[] = [];

  registry.ForEachEntityWith([MovementFlag, Position], (entity, _, position) => { flags.push({ entity, position }) });

  return flags;
}

const TargetOf = (registry : GlobalRegistry, entity : Entity) => registry.GetComponent(entity, TargetLocation)?.TargetLocation;

describe("selecting", () => {
  it("selects an owned character on the clicked tile", () => {
    const { registry, player, character } = BuildWorld();

    Click(registry, ClickAt(10, 10));

    const selection = registry.GetComponent(player, SelectionState);

    expect(selection?.source).toBe(character);
    expect(selection?.MovementFlag).toBeUndefined();
    expect(FlagsIn(registry)).toHaveLength(0);
  });

  it("ignores a click on an empty tile", () => {
    const { registry, player } = BuildWorld();

    Click(registry, ClickAt(20, 20));

    expect(registry.GetComponent(player, SelectionState)).toBeUndefined();
  });
});

describe("setting a destination", () => {
  it("plants a flag and gives the character a target", () => {
    const { registry, player, character } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 12));

    const flags = FlagsIn(registry);

    expect(flags).toHaveLength(1);
    expect(flags[0]!.position).toEqual(new Position(15, 12));
    expect(registry.GetComponent(player, SelectionState)?.MovementFlag).toBe(flags[0]!.entity);
    expect(TargetOf(registry, character)).toEqual(new Position(15, 12));
  });

  it("moves the flag when another tile is clicked", () => {
    const { registry, character } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 12));
    const oldFlag = FlagsIn(registry)[0]!.entity;

    Click(registry, ClickAt(3, 4));

    const flags = FlagsIn(registry);

    expect(registry.IsAlive(oldFlag)).toBe(false);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.position).toEqual(new Position(3, 4));
    expect(TargetOf(registry, character)).toEqual(new Position(3, 4));
  });
});

describe("clicking the flag cancels the move", () => {
  it("removes the flag without planting a new one", () => {
    const { registry } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 12));
    const flag = FlagsIn(registry)[0]!.entity;

    Click(registry, ClickAt(15, 12));

    expect(registry.IsAlive(flag)).toBe(false);
    expect(FlagsIn(registry)).toHaveLength(0);
  });

  it("stops the character where it stands", () => {
    const { registry, character } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 12));
    Click(registry, ClickAt(15, 12));

    expect(TargetOf(registry, character)).toBeUndefined();

    const time = new TimeResources();
    time.deltaSeconds = 1;

    HandleMovement(registry, new EventQueue(new LinkedList()), time);

    expect(registry.GetComponent(character, Position)).toEqual(new Position(10, 10));
  });

  it("drops the selection, so the next click starts over", () => {
    const { registry, player, character } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 12));
    Click(registry, ClickAt(15, 12));

    expect(registry.GetComponent(player, SelectionState)).toBeUndefined();

    Click(registry, ClickAt(10, 10));

    expect(registry.GetComponent(player, SelectionState)?.source).toBe(character);
  });

  // The flag sits on a whole tile while the character walks fractional steps, so a
  // click is matched by tile. It must still cancel once the walk is under way.
  it("cancels mid-walk", () => {
    const { registry, character } = BuildWorld();

    Click(registry, ClickAt(10, 10), ClickAt(15, 10));

    const time = new TimeResources();
    time.deltaSeconds = 1;
    HandleMovement(registry, new EventQueue(new LinkedList()), time);

    expect(registry.GetComponent(character, Position)).toEqual(new Position(11, 10));

    Click(registry, ClickAt(15, 10));

    expect(FlagsIn(registry)).toHaveLength(0);
    expect(TargetOf(registry, character)).toBeUndefined();
  });
});
