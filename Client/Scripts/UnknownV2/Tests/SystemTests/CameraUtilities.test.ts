import { describe, it, expect } from "vitest";
import { CameraTileOrigin, WorldTileOfScreenTile } from "../../Utilities/CameraUtilities.ts";
import { Camera } from "../../Contracts/SystemResources.ts";

const OriginOf = (x : number, y : number) => {
  const { originX, originY } = CameraTileOrigin(new Camera(x, y));
  return [originX, originY];
};

const WorldTile = (cameraX : number, cameraY : number, screenX : number, screenY : number) => {
  const position = WorldTileOfScreenTile(new Camera(cameraX, cameraY), screenX, screenY);
  return [position.x, position.y];
};

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
      const camera = new Camera(cameraX, cameraX);
      const { originX, originY } = CameraTileOrigin(camera);

      for (const screenTile of [0, 1, 49, 99]) {
        const world = WorldTileOfScreenTile(camera, screenTile, screenTile);

        // What RenderCanvas does to place a world tile on screen.
        expect([world.x - originX, world.y - originY]).toEqual([screenTile, screenTile]);
      }
    }
  });
});
