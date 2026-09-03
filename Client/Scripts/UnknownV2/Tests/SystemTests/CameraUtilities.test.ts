import { describe, it, expect } from "vitest";
import {
  CameraTileOrigin, CentreCameraOnPlayer, FindCameraEntity, FindCameraPosition,
  JumpCameraToEntity, JumpCameraToPosition, ScreenTileOfWorldTile, WorldTileOfScreenTile
} from "../../Utilities/CameraUtilities.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { AddCameraAt, AddCameraViewing, AddPlayerAt, BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";

const HalfViewport = GameWidth / 2;

/**
 * A camera whose viewport corner sits on the given world tile.
 *
 * The camera's own position is the viewport centre, but the mappings under test
 * are all expressed in terms of the corner, so stating the corner is what makes
 * these expectations readable.
 */
const CameraViewing = (originX : number, originY : number) =>
  new Position(originX + HalfViewport, originY + HalfViewport);

const OriginOf = (x : number, y : number) => {
  const { originX, originY } = CameraTileOrigin(CameraViewing(x, y));
  return [originX, originY];
};

const WorldTile = (cameraX : number, cameraY : number, screenX : number, screenY : number) => {
  const position = WorldTileOfScreenTile(CameraViewing(cameraX, cameraY), screenX, screenY);
  return [position.x, position.y];
};

describe("what the camera's position means", () => {
  // Centre rather than corner is what makes aiming the camera a plain copy of
  // the target's position, so it is worth pinning directly rather than only
  // through the corner-based mappings below.
  it("is the centre of the viewport", () => {
    const { screenX, screenY } = ScreenTileOfWorldTile(new Position(500, 300), 500, 300);

    expect([screenX, screenY]).toEqual([HalfViewport, HalfViewport]);
  });

  it("puts the corner half a viewport up and left of it", () =>
    expect(CameraTileOrigin(new Position(500, 300))).toEqual({ originX: 500 - HalfViewport, originY: 300 - HalfViewport }));
});

describe("the tile the camera starts on", () => {
  it("is the camera origin when it is already whole", () => expect(OriginOf(20, 30)).toEqual([20, 30]));

  it("is the tile the camera is inside of, part way across it", () => expect(OriginOf(20.9, 30.1)).toEqual([20, 30]));

  // Truncation would put -0.5 and +0.5 both in tile 0, making the origin row
  // twice as tall as every other row and shifting everything left of it.
  it("rounds down rather than towards zero", () => expect(OriginOf(-0.5, -0.5)).toEqual([-1, -1]));

  it("rounds down deep in negative space", () => expect(OriginOf(-450.25, -750.75)).toEqual([-451, -751]));
});

describe("screen to world", () => {
  it("maps the top-left screen tile to the camera's tile", () => expect(WorldTile(20, 30, 0, 0)).toEqual([20, 30]));

  it("offsets by the screen tile", () => expect(WorldTile(20, 30, 5, 7)).toEqual([25, 37]));

  it("ignores the sub-tile part of a pan", () => expect(WorldTile(20.9, 30.9, 5, 7)).toEqual([25, 37]));

  it("works in negative space", () => expect(WorldTile(-50.5, -50.5, 5, 5)).toEqual([-46, -46]));
});

describe("agreement with the renderer", () => {
  // Both sides floor through CameraTileOrigin. If they ever diverged, a click
  // would land a tile away from the glyph the player aimed at, but only at some
  // pan offsets -- so this pins the round trip rather than either half alone.
  it("inverts the renderer's world-to-screen mapping at every sub-tile offset", () => {
    for (const cameraX of [0, 0.1, 0.5, 0.9, -0.1, -0.5, -0.9, 137.37, -450.62]) {
      const camera = CameraViewing(cameraX, cameraX);
      const { originX, originY } = CameraTileOrigin(camera);

      for (const screenTile of [0, 1, 49, 99]) {
        const world = WorldTileOfScreenTile(camera, screenTile, screenTile);

        // What RenderCanvas does to place a world tile on screen.
        expect([world.x - originX, world.y - originY]).toEqual([screenTile, screenTile]);
      }
    }
  });

  it("world to screen is the exact inverse of screen to world", () => {
    for (const cameraX of [0, 0.9, -0.5, 137.37, -450.62]) {
      const camera = CameraViewing(cameraX, cameraX);

      for (const screenTile of [0, 1, 49, 99]) {
        const world = WorldTileOfScreenTile(camera, screenTile, screenTile);

        expect(ScreenTileOfWorldTile(camera, world.x, world.y)).toEqual({ screenX: screenTile, screenY: screenTile });
      }
    }
  });
});

describe("finding the camera", () => {
  it("finds the one camera in the world", () => {
    const registry = BuildTestRegistry();
    const camera = AddCameraAt(registry, 10, 20);

    expect(FindCameraEntity(registry)).toBe(camera);
  });

  it("reports the camera's live Position, not a copy", () => {
    const registry = BuildTestRegistry();
    AddCameraAt(registry, 10, 20);

    FindCameraPosition(registry)!.x = 99;

    expect(FindCameraPosition(registry)!.x).toBe(99);
  });

  // Every system that reads the camera runs on registries that may not have one
  // -- a test fixture, or the frame before Initialization builds it -- and all
  // of them are written to do nothing rather than guess a viewpoint.
  it("is undefined when there is no camera", () => expect(FindCameraEntity(BuildTestRegistry())).toBeUndefined());

  it("ignores an entity tagged as a camera but carrying no Position", () => {
    const registry = BuildTestRegistry();
    new EntityBuilder(registry).AddCamera();

    expect(FindCameraEntity(registry)).toBeUndefined();
  });

  // Two cameras have no defined answer, and picking one silently would surface
  // much later as the view intermittently snapping somewhere else.
  it("throws rather than picking one of two cameras", () => {
    const registry = BuildTestRegistry();
    AddCameraAt(registry, 10, 20);
    AddCameraAt(registry, 30, 40);

    expect(() => FindCameraEntity(registry)).toThrow(/more than one camera/i);
  });
});

describe("jumping the camera", () => {
  it("puts a world position at the centre of the viewport", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);

    JumpCameraToPosition(registry, new Position(-400, 700));

    const { screenX, screenY } = ScreenTileOfWorldTile(FindCameraPosition(registry)!, -400, 700);
    expect([screenX, screenY]).toEqual([HalfViewport, HalfViewport]);
  });

  it("puts an entity at the centre of the viewport", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    const target = new EntityBuilder(registry).AddPosition(new Position(137, -42)).GetEntity();

    JumpCameraToEntity(registry, target);

    const { screenX, screenY } = ScreenTileOfWorldTile(FindCameraPosition(registry)!, 137, -42);
    expect([screenX, screenY]).toEqual([HalfViewport, HalfViewport]);
  });

  // Copied, not aliased: sharing the object would make the camera follow the
  // target forever, which is a different feature from jumping to it once.
  it("does not keep following an entity after the jump", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    const targetPosition = new Position(137, -42);
    const target = new EntityBuilder(registry).AddPosition(targetPosition).GetEntity();

    JumpCameraToEntity(registry, target);
    targetPosition.x = 9000;

    expect(FindCameraPosition(registry)!.x).toBe(137);
  });

  it("does nothing when the target has no Position", () => {
    const registry = BuildTestRegistry();
    AddCameraAt(registry, 80, 90);
    const target = registry.CreateEntity();

    JumpCameraToEntity(registry, target);

    expect([FindCameraPosition(registry)!.x, FindCameraPosition(registry)!.y]).toEqual([80, 90]);
  });

  it("does not throw with no camera", () =>
    expect(() => JumpCameraToPosition(BuildTestRegistry(), new Position(1, 2))).not.toThrow());
});

describe("following the player", () => {
  const CentreOf = (registry : ReturnType<typeof BuildTestRegistry>) => {
    const position = FindCameraPosition(registry)!;
    return [position.x, position.y];
  };

  it("centres the viewport on the player", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    AddPlayerAt(registry, 500, 300);

    CentreCameraOnPlayer(registry);

    expect(CentreOf(registry)).toEqual([500, 300]);
  });

  it("handles negative player positions", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    AddPlayerAt(registry, -400, -700);

    CentreCameraOnPlayer(registry);

    expect(CentreOf(registry)).toEqual([-400, -700]);
  });

  it("tracks the player as they move", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    const player = AddPlayerAt(registry, 0, 0);

    CentreCameraOnPlayer(registry);
    registry.RegisterEntity(player, Position, new Position(10, 10));
    CentreCameraOnPlayer(registry);

    expect(CentreOf(registry)).toEqual([10, 10]);
  });

  it("puts the player at the viewport centre in screen space", () => {
    const registry = BuildTestRegistry();
    AddCameraViewing(registry, 0, 0);
    AddPlayerAt(registry, 137, -42);

    CentreCameraOnPlayer(registry);

    expect(ScreenTileOfWorldTile(FindCameraPosition(registry)!, 137, -42))
      .toEqual({ screenX: HalfViewport, screenY: HalfViewport });
  });
});

describe("without a player", () => {
  it("does not throw", () => expect(() => CentreCameraOnPlayer(BuildTestRegistry())).not.toThrow());

  it("leaves the camera where it was", () => {
    // Holding position matters: snapping to the origin would jerk the view on
    // any frame between the player being destroyed and replaced.
    const registry = BuildTestRegistry();
    AddCameraAt(registry, 80, 90);

    CentreCameraOnPlayer(registry);

    expect([FindCameraPosition(registry)!.x, FindCameraPosition(registry)!.y]).toEqual([80, 90]);
  });
});
