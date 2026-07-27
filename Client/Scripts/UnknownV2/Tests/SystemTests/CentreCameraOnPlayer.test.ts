import { describe, it, expect } from "vitest";
import { CentreCameraOnPlayer } from "../../Systems.World/CentreCameraOnPlayer.ts";
import { Camera } from "../../Contracts/SystemResources.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { BuildTestRegistry, AddPlayerAt } from "../TestHelpers/BuildTestRegistry.ts";

const HalfViewport = Math.floor(GameWidth / 2);

describe("following the player", () => {
  it("centres the viewport horizontally", () => {
    const registry = BuildTestRegistry();
    const camera = new Camera();
    AddPlayerAt(registry, 500, 500);

    CentreCameraOnPlayer(registry, camera);

    expect(camera.worldOriginX).toBe(500 - HalfViewport);
  });

  it("centres the viewport vertically", () => {
    const registry = BuildTestRegistry();
    const camera = new Camera();
    AddPlayerAt(registry, 500, 300);

    CentreCameraOnPlayer(registry, camera);

    expect(camera.worldOriginY).toBe(300 - HalfViewport);
  });

  it("handles negative player positions", () => {
    const registry = BuildTestRegistry();
    const camera = new Camera();
    AddPlayerAt(registry, -400, -700);

    CentreCameraOnPlayer(registry, camera);

    expect([camera.worldOriginX, camera.worldOriginY]).toEqual([-400 - HalfViewport, -700 - HalfViewport]);
  });

  it("tracks the player as they move", () => {
    const registry = BuildTestRegistry();
    const camera = new Camera();
    const player = AddPlayerAt(registry, 0, 0);

    CentreCameraOnPlayer(registry, camera);
    registry.RegisterEntity(player, Position, new Position(10, 10));
    CentreCameraOnPlayer(registry, camera);

    expect(camera.worldOriginX).toBe(10 - HalfViewport);
  });

  it("puts the player at the viewport centre in screen space", () => {
    const registry = BuildTestRegistry();
    const camera = new Camera();
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry, camera);

    expect([137 - camera.worldOriginX, -42 - camera.worldOriginY]).toEqual([HalfViewport, HalfViewport]);
  });
});

describe("without a player", () => {
  it("does not throw", () => expect(() => CentreCameraOnPlayer(BuildTestRegistry(), new Camera())).not.toThrow());

  it("leaves the camera where it was", () => {
    // Holding position matters: snapping to the origin would jerk the view on
    // any frame between the player being destroyed and replaced.
    const camera = new Camera(80, 90);

    CentreCameraOnPlayer(BuildTestRegistry(), camera);

    expect([camera.worldOriginX, camera.worldOriginY]).toEqual([80, 90]);
  });
});
