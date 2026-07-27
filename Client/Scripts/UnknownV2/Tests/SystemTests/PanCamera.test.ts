import { describe, it, expect } from "vitest";
import { PanCamera, ReleaseAllKeys } from "../../Systems.World/PanCamera.ts";
import { GameKeyboardEvent } from "../../Contracts/Events/KeyBoardEvent.ts";
import { Camera, InputResources, TimeResources } from "../../Contracts/SystemResources.ts";
import { CameraPanSpeed } from "../../Configuration/GameConstants.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";

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

const BuildContext = (camera = new Camera(), deltaSeconds = 1) =>
  ({ input: new InputResources(), camera, time: BuildTick(deltaSeconds) });

/** Runs one frame's worth of panning and reports where the camera ended up. */
function Pan(events : GameKeyboardEvent[], context = BuildContext()) {
  const queue = new EventQueue(new LinkedList());
  events.forEach((event) => queue.EnqueueEvent(event));

  PanCamera(queue, context.input, context.camera, context.time);

  return [context.camera.worldOriginX, context.camera.worldOriginY];
}

describe("pan keys", () => {
  // Y grows downward, so "up" decreases it.
  it("ArrowUp pans up", () => expect(Pan([KeyDown("ArrowUp")])).toEqual([0, -CameraPanSpeed]));
  it("ArrowDown pans down", () => expect(Pan([KeyDown("ArrowDown")])).toEqual([0, CameraPanSpeed]));
  it("ArrowLeft pans left", () => expect(Pan([KeyDown("ArrowLeft")])).toEqual([-CameraPanSpeed, 0]));
  it("ArrowRight pans right", () => expect(Pan([KeyDown("ArrowRight")])).toEqual([CameraPanSpeed, 0]));

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

  it("shift alone still pans", () => expect(Pan([KeyDown("KeyW", { shiftKey: true })])).toEqual([0, -CameraPanSpeed]));
});

describe("frame time", () => {
  it("pans by speed times elapsed seconds", () => {
    expect(Pan([KeyDown("ArrowRight")], BuildContext(new Camera(), 0.5))).toEqual([CameraPanSpeed * 0.5, 0]);
  });

  // The point of scaling by frame time: two half-second frames cover the same
  // ground as one full-second frame, so a faster display does not pan faster.
  it("is independent of how the elapsed time divides into frames", () => {
    const context = BuildContext(new Camera(), 0.5);

    Pan([KeyDown("ArrowRight")], context);
    Pan([], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed);
  });
});

describe("held keys", () => {
  it("keeps panning on frames with no events at all", () => {
    const context = BuildContext();

    Pan([KeyDown("ArrowRight")], context);
    Pan([], context);
    Pan([], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed * 3);
  });

  it("stops on release", () => {
    const context = BuildContext();

    Pan([KeyDown("ArrowRight")], context);
    Pan([KeyUp("ArrowRight")], context);
    Pan([], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed);
  });

  // A release carries whatever modifiers happen to be down with it. Ignoring it
  // the way a modified press is ignored would leave the key stuck down forever.
  it("releases a key even when the release is modified", () => {
    const context = BuildContext();

    Pan([KeyDown("ArrowRight")], context);
    Pan([new GameKeyboardEvent({ code: "ArrowRight", ctrlKey: true } as KeyboardEvent, false)], context);
    Pan([], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed);
  });

  it("ignores a release of a key that was never held", () => expect(Pan([KeyUp("ArrowRight")])).toEqual([0, 0]));

  // Holding a key makes the OS repeat keydown; the camera must not speed up.
  it("does not double up when a press repeats", () => {
    const context = BuildContext();

    Pan([KeyDown("ArrowRight"), KeyDown("ArrowRight")], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed);
  });

  it("forgets everything on ReleaseAllKeys", () => {
    const context = BuildContext();

    Pan([KeyDown("ArrowRight")], context);
    ReleaseAllKeys(context.input);
    Pan([], context);

    expect(context.camera.worldOriginX).toBe(CameraPanSpeed);
  });
});

describe("multiple keys at once", () => {
  it("pans diagonally at the same speed as it pans straight", () => {
    const [x, y] = Pan([KeyDown("ArrowRight"), KeyDown("ArrowDown")]);

    expect(Math.hypot(x!, y!)).toBeCloseTo(CameraPanSpeed);
    expect(x).toBeCloseTo(y!);
  });

  it("opposing keys cancel out", () => expect(Pan([KeyDown("ArrowLeft"), KeyDown("ArrowRight")])).toEqual([0, 0]));
});

describe("edge cases", () => {
  it("does nothing with no events", () => expect(Pan([])).toEqual([0, 0]));

  it("pans from wherever the camera already is", () => {
    expect(Pan([KeyDown("ArrowLeft")], BuildContext(new Camera(-450, -750)))).toEqual([-450 - CameraPanSpeed, -750]);
  });
});
