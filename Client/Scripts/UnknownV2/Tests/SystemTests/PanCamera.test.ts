import { describe, it, expect } from "vitest";
import { CameraActions, PanCamera, ReleaseAllKeys } from "../../Systems.Gameloop/PanCamera.ts";
import { ResolveInputActions } from "../../Systems.Gameloop/ResolveInputActions.ts";
import { GameKeyboardEvent } from "../../Contracts/Events/KeyBoardEvent.ts";
import { InputResources, TimeResources } from "../../Contracts/SystemResources.ts";
import { CameraPanSpeed } from "../../Configuration/GameConstants.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { AddCameraAt, BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { FindCameraPosition } from "../../Utilities/CameraUtilities.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";

/**
 * Panning is two systems now: ResolveInputActions turns keys into actions and
 * routes them to a listener, PanCamera moves the camera by what its own listener
 * heard. These tests drive both, because the behaviour worth pinning -- "holding
 * D scrolls right at a frame-rate-independent speed" -- is a property of the
 * pair, and testing PanCamera against a hand-filled `held` set would assert only
 * that the second half does arithmetic.
 *
 * WASD pans and the arrows do not: the arrows are bound to the Navigate actions,
 * which menus claim and the camera does not.
 */

const KeyDown = (code : string, modifiers : Partial<KeyboardEvent> = {}) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...modifiers } as KeyboardEvent, true);

const KeyUp = (code : string) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, false);

/** A tick of a fixed length, so an expected pan is a plain multiplication. */
function BuildTick(deltaSeconds = 1) {
  const time = new TimeResources();
  time.deltaSeconds = deltaSeconds;
  return time;
}

/**
 * A world with a camera in it, looking at (startX, startY), listening for the
 * pan actions on the bottom input layer.
 *
 * The camera's position is the viewport centre, but every assertion below is
 * about how far the camera moved, so where it starts only matters for the one
 * case that pans from somewhere other than the origin.
 */
const BuildContext = (startX = 0, startY = 0, deltaSeconds = 1) => {
  const registry = BuildTestRegistry();
  const input = new InputResources();

  const layer = PushInputLayer(registry, input);
  const camera = AddCameraAt(registry, startX, startY);

  new EntityBuilder(registry, camera).AddActionListener(layer, ...CameraActions);

  return { registry, input, camera: FindCameraPosition(registry)!, time: BuildTick(deltaSeconds) };
};

/** Runs one frame's worth of input plus panning, and reports where the camera ended up. */
function Pan(events : GameKeyboardEvent[], context = BuildContext()) {
  const queue = new EventQueue(new LinkedList());
  events.forEach((event) => queue.EnqueueEvent(event));

  ResolveInputActions(context.registry, queue, context.input);
  PanCamera(context.registry, context.time);

  return [context.camera.x, context.camera.y];
}

describe("pan keys", () => {
  // Y grows downward, so "up" decreases it.
  it("KeyW pans up", () => expect(Pan([KeyDown("KeyW")])).toEqual([0, -CameraPanSpeed]));
  it("KeyS pans down", () => expect(Pan([KeyDown("KeyS")])).toEqual([0, CameraPanSpeed]));
  it("KeyA pans left", () => expect(Pan([KeyDown("KeyA")])).toEqual([-CameraPanSpeed, 0]));
  it("KeyD pans right", () => expect(Pan([KeyDown("KeyD")])).toEqual([CameraPanSpeed, 0]));
});

describe("keys that should do nothing", () => {
  const ExpectNoPan = (code : string, modifiers : Partial<KeyboardEvent> = {}) =>
    expect(Pan([KeyDown(code, modifiers)])).toEqual([0, 0]);

  it("an unmapped key", () => ExpectNoPan("KeyQ"));
  it("ctrl-modified", () => ExpectNoPan("KeyW", { ctrlKey: true }));
  it("alt-modified", () => ExpectNoPan("KeyW", { altKey: true }));
  it("meta-modified", () => ExpectNoPan("KeyW", { metaKey: true }));

  // The arrows are bound, but to Navigate actions the camera never claims, so
  // they resolve to nobody rather than being ignored as unbound.
  it("ArrowUp is a menu key, not a pan key", () => ExpectNoPan("ArrowUp"));
  it("ArrowRight is a menu key, not a pan key", () => ExpectNoPan("ArrowRight"));

  it("shift alone still pans", () => expect(Pan([KeyDown("KeyW", { shiftKey: true })])).toEqual([0, -CameraPanSpeed]));
});

describe("frame time", () => {
  it("pans by speed times elapsed seconds", () => {
    expect(Pan([KeyDown("KeyD")], BuildContext(0, 0, 0.5))).toEqual([CameraPanSpeed * 0.5, 0]);
  });

  // The point of scaling by frame time: two half-second frames cover the same
  // ground as one full-second frame, so a faster display does not pan faster.
  it("is independent of how the elapsed time divides into frames", () => {
    const context = BuildContext(0, 0, 0.5);

    Pan([KeyDown("KeyD")], context);
    Pan([], context);

    expect(context.camera.x).toBe(CameraPanSpeed);
  });
});

describe("held keys", () => {
  it("keeps panning on frames with no events at all", () => {
    const context = BuildContext();

    Pan([KeyDown("KeyD")], context);
    Pan([], context);
    Pan([], context);

    expect(context.camera.x).toBe(CameraPanSpeed * 3);
  });

  it("stops on release", () => {
    const context = BuildContext();

    Pan([KeyDown("KeyD")], context);
    Pan([KeyUp("KeyD")], context);
    Pan([], context);

    expect(context.camera.x).toBe(CameraPanSpeed);
  });

  // A release carries whatever modifiers happen to be down with it. Ignoring it
  // the way a modified press is ignored would leave the key stuck down forever.
  it("releases a key even when the release is modified", () => {
    const context = BuildContext();

    Pan([KeyDown("KeyD")], context);
    Pan([new GameKeyboardEvent({ code: "KeyD", ctrlKey: true } as KeyboardEvent, false)], context);
    Pan([], context);

    expect(context.camera.x).toBe(CameraPanSpeed);
  });

  it("ignores a release of a key that was never held", () => expect(Pan([KeyUp("KeyD")])).toEqual([0, 0]));

  // Holding a key makes the OS repeat keydown; the camera must not speed up.
  it("does not double up when a press repeats", () => {
    const context = BuildContext();

    Pan([KeyDown("KeyD"), KeyDown("KeyD")], context);

    expect(context.camera.x).toBe(CameraPanSpeed);
  });

  it("forgets everything on ReleaseAllKeys", () => {
    const context = BuildContext();

    Pan([KeyDown("KeyD")], context);
    ReleaseAllKeys(context.input);
    Pan([], context);

    expect(context.camera.x).toBe(CameraPanSpeed);
  });
});

describe("multiple keys at once", () => {
  it("pans diagonally at the same speed as it pans straight", () => {
    const [x, y] = Pan([KeyDown("KeyD"), KeyDown("KeyS")]);

    expect(Math.hypot(x!, y!)).toBeCloseTo(CameraPanSpeed);
    expect(x).toBeCloseTo(y!);
  });

  it("opposing keys cancel out", () => expect(Pan([KeyDown("KeyA"), KeyDown("KeyD")])).toEqual([0, 0]));
});

describe("edge cases", () => {
  it("does nothing with no events", () => expect(Pan([])).toEqual([0, 0]));

  it("pans from wherever the camera already is", () => {
    expect(Pan([KeyDown("KeyA")], BuildContext(-450, -750))).toEqual([-450 - CameraPanSpeed, -750]);
  });

  // The camera claims the pan actions itself, so one with no listener is deaf
  // rather than driven by whatever else is on screen.
  it("a camera with no listener does not move", () => {
    const registry = BuildTestRegistry();
    const input = new InputResources();

    PushInputLayer(registry, input);
    AddCameraAt(registry, 0, 0);

    const queue = new EventQueue(new LinkedList());
    queue.EnqueueEvent(KeyDown("KeyD"));

    ResolveInputActions(registry, queue, input);
    PanCamera(registry, BuildTick());

    expect(FindCameraPosition(registry)!.x).toBe(0);
  });
});

describe("without a camera", () => {
  const ResolveWithoutCamera = (events : GameKeyboardEvent[], input = new InputResources()) => {
    const registry = BuildTestRegistry();
    const queue = new EventQueue(new LinkedList());

    events.forEach((event) => queue.EnqueueEvent(event));

    ResolveInputActions(registry, queue, input);
    PanCamera(registry, BuildTick());

    return input;
  };

  it("does not throw", () => expect(() => ResolveWithoutCamera([KeyDown("KeyD")])).not.toThrow());

  // Key state is tracked whether or not there is anything to move, so a key
  // pressed before the camera exists is not still "down" once it does.
  it("still records and releases held keys", () => {
    const input = ResolveWithoutCamera([KeyDown("KeyD")]);

    expect(input.heldKeyCodes.has("KeyD")).toBe(true);

    ResolveWithoutCamera([KeyUp("KeyD")], input);

    expect(input.heldKeyCodes.has("KeyD")).toBe(false);
  });
});
