import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { IsCamera } from "../Contracts/Tags/IsCamera.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { FindPlayerPosition } from "./PlayerUtilities.ts";
import { FindUniqueEntityWith } from "./RegistryUtilities.ts";

/** Half the viewport, in tiles: the offset from the camera's centre to its corner. */
const HalfViewport = GameWidth / 2

/**
 * The camera entity, or undefined when the world has none.
 *
 * Undefined is a real state, not an error — a registry built by a test that does
 * not care about the view has no camera, and every system that reads one is
 * written to do nothing in that case. Two cameras, on the other hand, throws.
 */
export function FindCameraEntity (registry : IRegistry) : Entity | undefined {
    return FindUniqueEntityWith(registry, [IsCamera, Position], "camera")
}

/**
 * Where the camera is looking: the world tile at the CENTRE of the viewport.
 *
 * The component itself, not a copy — PanCamera moves the view by mutating it in
 * place, the same way HandleMovement moves everything else.
 *
 * Centre rather than the top-left corner the renderer needs, because centre is
 * what every caller actually means. Aiming the camera at an entity is then a
 * copy of that entity's Position with no half-viewport arithmetic at the call
 * site, and the one place that does need the corner derives it below.
 */
export function FindCameraPosition (registry : IRegistry) : Position | undefined {
    const cameraEntity = FindCameraEntity(registry)

    if (cameraEntity === undefined) return undefined

    return registry.GetComponent(cameraEntity, Position)
}

/**
 * The world tile drawn at the viewport's top-left corner.
 *
 * The camera's position is continuous -- PanCamera moves it by a fraction of a
 * tile every frame -- but the screen is a whole-tile grid, so somewhere the
 * origin has to become an integer. That happens here, once, and both the
 * renderer and click handling go through it.
 *
 * Sharing the floor is the point, not a convenience. If the two floored
 * independently, or one floored while the other truncated, a click would land a
 * tile away from the glyph the player aimed at for half of all pan offsets --
 * and only for negative coordinates, which is the hardest kind of bug to catch.
 */
export function CameraTileOrigin (cameraPosition : Position) : { originX : number, originY : number } {
    // Math.floor rather than truncation, so an origin of -0.5 is tile -1 rather
    // than sharing tile 0 with +0.5 and making the origin row twice as tall.
    return {
        originX: Math.floor(cameraPosition.x - HalfViewport),
        originY: Math.floor(cameraPosition.y - HalfViewport)
    }
}

/**
 * The world tile shown at a given screen tile: the inverse of the mapping
 * RenderCanvas draws with.
 */
export function WorldTileOfScreenTile (cameraPosition : Position, screenX : number, screenY : number) : Position {
    const { originX, originY } = CameraTileOrigin(cameraPosition)

    return new Position(originX + screenX, originY + screenY)
}

/**
 * The screen tile a world tile is drawn at. May be outside the viewport; pair it
 * with IsOutsideViewport to find out.
 *
 * Returns coordinates rather than a Position because callers ask this per tile
 * and a throwaway object each time would allocate thousands per frame.
 *
 * The counterpart of WorldTileOfScreenTile, and for the same reason: this
 * mapping was previously open-coded as `position.x - cameraOriginX` in the
 * renderer and again in herd placement, which is exactly the split floor this
 * file exists to prevent.
 */
export function ScreenTileOfWorldTile (cameraPosition : Position, worldX : number, worldY : number) : { screenX : number, screenY : number } {
    const { originX, originY } = CameraTileOrigin(cameraPosition)

    return { screenX: worldX - originX, screenY: worldY - originY }
}

/**
 * Puts a world position at the centre of the viewport.
 *
 * Does nothing when there is no camera or no position to aim at, so a frame
 * between a target being destroyed and replaced holds the view where it is
 * rather than snapping it to the origin.
 */
export function JumpCameraToPosition (registry : IRegistry, position : Position | undefined) {
    if (position === undefined) return

    const cameraPosition = FindCameraPosition(registry)

    if (cameraPosition === undefined) return

    // Written into the existing component rather than replacing it: anything
    // holding the camera's Position for the rest of the frame keeps a live
    // reference, matching how every other position in the game is moved.
    cameraPosition.x = position.x
    cameraPosition.y = position.y
}

/** Puts an entity at the centre of the viewport. */
export function JumpCameraToEntity (registry : IRegistry, target : Entity) {
    JumpCameraToPosition(registry, registry.GetComponent(target, Position))
}

/**
 * Puts the player at the centre of the viewport.
 *
 * Called once at startup rather than every frame: the camera is free, and
 * PanCamera is the only thing that moves it afterwards. Re-centring per frame
 * would undo any pan as soon as anything moved, which is exactly what a free
 * camera is not. It keeps its own name, rather than being inlined into
 * initialization, because a "recentre on my units" key is the obvious next thing
 * to want and this is already what it would do.
 *
 * No clamping: the world is unbounded in every direction. If a finite world is
 * ever wanted, the limits belong here rather than in the renderer, so that the
 * renderer keeps knowing only how to draw what the camera points at.
 */
export function CentreCameraOnPlayer (registry : IRegistry) {
    JumpCameraToPosition(registry, FindPlayerPosition(registry))
}
