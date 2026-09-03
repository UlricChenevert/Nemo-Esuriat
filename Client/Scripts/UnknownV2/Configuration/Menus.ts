import type { Entity } from "../Contracts/Components/Entity.ts";
import type { ISystemContext } from "../Interfaces/ISystemContext.ts";
import { MenuBuilder } from "../Systems.Framework/MenuBuilder.ts";
import { BuildMenuLoopLayer } from "./GameLoopLayers.ts";
import { TitleArt } from "./TitleArt.ts";

/**
 * Every screen in the game, as a list of rows.
 *
 * MenuBuilder does all of the wiring -- layers, listeners, glyphs, teardown --
 * so a screen is nothing but its title and what its rows do. Adding one means
 * adding a function here and calling it.
 */

/**
 * The screen the game opens on. Gameplay is dormant beneath it until closed.
 *
 * The only screen with artwork: a title screen is the one place worth showing a
 * picture, and a pause menu wants the game visible behind it instead.
 */
export function OpenStartMenu (context : ISystemContext) : Entity {
    return new MenuBuilder(context, BuildMenuLoopLayer)
        .SetTitle("UNKNOWN")
        .WithArt(TitleArt)
        .AddCloseItem("Start Game")
        .AddSubMenuItem("Show Keybindings", BuildKeybindingsMenu)
        .Open()
}

/** Opened by the OpenMenu action during play. */
export function OpenPauseMenu (context : ISystemContext) : Entity {
    return new MenuBuilder(context, BuildMenuLoopLayer)
        .SetTitle("PAUSED")
        .AddCloseItem("Return to Game")
        .AddSubMenuItem("Show Keybindings", BuildKeybindingsMenu)
        .Open()
}

/**
 * Opened when the player has no bodies left to control.
 *
 * Not opened when a body dies -- only when the last one does. See
 * HandlePlayerDefeat.
 *
 * Its one row closes it and returns to a world that carries on without anybody in
 * it, because there is nothing here to restart yet. That is a gap, not a design:
 * the screen exists so running out of humans is legible rather than silent.
 */
export function OpenDeathMenu (context : ISystemContext) : Entity {
    return new MenuBuilder(context, BuildMenuLoopLayer)
        .SetTitle("YOU DIED")
        .AddStaticRow("Hunger and thirst took the last of you.")
        .AddCloseItem("Keep Watching")
        .Open()
}

/**
 * Every action and the keys currently bound to it.
 *
 * Read straight off KeyBindings rather than from a hand-written list, so it
 * cannot drift: an action added to AllGameActions appears here, and a Rebind is
 * reflected the next time the screen is opened.
 *
 * Rows are static -- this screen shows bindings, it does not yet change them --
 * which is why navigation skips them and only Back can be selected.
 */
export function BuildKeybindingsMenu (builder : MenuBuilder) {
    builder.SetTitle("KEYBINDINGS")

    for (const { action, codes } of builder.context.resources.Input.bindings.Pairs()) {
        builder.AddStaticRow(`${action.padEnd(16, ".")} ${codes.length > 0 ? codes.join(", ") : "unbound"}`)
    }

    builder.AddCloseItem("Back")
}
