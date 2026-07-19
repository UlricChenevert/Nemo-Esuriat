// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { GlobalRegistry } from "../../Systems/Registry.ts";
import { EventQueue } from "../../Systems/EventQueue.ts";
import { HashMapComponentRegistry } from "../../Systems/ComponentRegistry.ts";
import { LinkedList } from "../../libraries/FastList/FastList.ts";
import { Position } from "../../Contracts/Position.ts";
import { Layer } from "../../Contracts/Layer.ts";
import { Representation } from "../../Contracts/Representation.ts";
import { SelectionState } from "../../Contracts/IsSelected.ts";
import { IsCollidable } from "../../Contracts/IsCollideable.ts";
import { IsMoveable } from "../../Contracts/IsMovable.ts";
import { IsSelectable } from "../../Contracts/IsSelectible.ts";
import { IsPlayer } from "../../Contracts/IsPlayer.ts";
import { IsConscious } from "../../Contracts/IsConcious.ts";
import { GameClickEvent } from "../../Contracts/GameClickEvent.ts";
import { GameCollisionEvent } from "../../Contracts/GameCollisionEvent.ts";
import { HandleInputEvents } from "../../Systems/HandleInputEvents.ts";
import { HandleMovement } from "../../Systems/HandleMovement.ts";
import { HandleCollision } from "../../Systems/HandleCollision.ts";
import { Color } from "../../Contracts/Color.ts";
import { TileSizePixels } from "../../Configuration/DisplayConstants.ts";

function makeRegistry() {
  const r = new GlobalRegistry();
  for (const C of [Position, Layer, Representation, SelectionState, IsCollidable, IsMoveable, IsSelectable, IsPlayer, IsConscious]) {
    r.RegisterComponentRegistry(C as any, new HashMapComponentRegistry(C as any));
  }
  return r;
}

// A canvas whose backing store equals its CSS box, tiles 16px each.
function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  (c as any).getBoundingClientRect = () => ({ left: 0, top: 0, width: 128, height: 128 });
  return c as HTMLCanvasElement;
}

function clickCell(col: number, row: number, canvas: HTMLCanvasElement) {
  // center of the target cell in pixels
  const px = col * TileSizePixels + TileSizePixels / 2;
  const py = row * TileSizePixels + TileSizePixels / 2;
  return new GameClickEvent({ clientX: px, clientY: py } as MouseEvent, canvas);
}

describe("Color.ToHex", () => {
  it("clamps and pads channels", () => {
    expect(new Color(260, -5, 40).ToHex()).toBe("#ff0028");
  });
});

describe("GameClickEvent", () => {
  it("maps pixels to grid cells", () => {
    const e = clickCell(4, 4, makeCanvas());
    expect(e.position.x).toBe(4);
    expect(e.position.y).toBe(4);
  });
});

describe("selection + movement", () => {
  it("clicking a piece then a destination moves the piece", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    // one conscious player
    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());

    // a moveable piece at (1,1)
    const piece = r.CreateEntity();
    r.RegisterEntity(piece, Position, new Position(1, 1));
    r.RegisterEntity(piece, IsSelectable, new IsSelectable());
    r.RegisterEntity(piece, IsMoveable, new IsMoveable());

    // a destination tile at (4,4)
    const tile = r.CreateEntity();
    r.RegisterEntity(tile, Position, new Position(4, 4));
    r.RegisterEntity(tile, IsSelectable, new IsSelectable());

    const canvas = makeCanvas();

    // Click the piece
    eq.EnqueueEvent(clickCell(1, 1, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(piece, SelectionState)).toBeDefined();

    // Click the destination
    eq.EnqueueEvent(clickCell(4, 4, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(tile, SelectionState)).toBeDefined();

    // Resolve movement
    HandleMovement(r, eq);

    const pos = r.GetComponent(piece, Position)!;
    expect(pos.x).toBe(4);
    expect(pos.y).toBe(4);
    // selections cleared after the move
    expect(r.GetComponent(piece, SelectionState)).toBeUndefined();
    expect(r.GetComponent(tile, SelectionState)).toBeUndefined();
  });

  it("only the selecting player may deselect", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());

    const tile = r.CreateEntity();
    r.RegisterEntity(tile, Position, new Position(2, 2));
    r.RegisterEntity(tile, IsSelectable, new IsSelectable());

    const canvas = makeCanvas();

    eq.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(tile, SelectionState)).toBeDefined();

    // clicking again deselects (same player)
    eq.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(tile, SelectionState)).toBeUndefined();
  });
});

describe("collision", () => {
  it("fires only for collidables sharing a cell", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    const a = r.CreateEntity();
    r.RegisterEntity(a, Position, new Position(2, 3));
    r.RegisterEntity(a, IsCollidable, new IsCollidable());

    const b = r.CreateEntity();
    r.RegisterEntity(b, Position, new Position(2, 3));
    r.RegisterEntity(b, IsCollidable, new IsCollidable());

    const c = r.CreateEntity();
    r.RegisterEntity(c, Position, new Position(5, 5));
    r.RegisterEntity(c, IsCollidable, new IsCollidable());

    HandleCollision(r, eq);
    const collisions = eq.GetEventsOfType(GameCollisionEvent);
    // b arriving onto a's cell fires one directed event (b -> a); c alone fires none.
    expect(collisions.length).toBe(1);
    expect(collisions[0]!.collidingEntity).toBe(b);
    expect(collisions[0]!.collidedEntity).toBe(a);
  });
});
