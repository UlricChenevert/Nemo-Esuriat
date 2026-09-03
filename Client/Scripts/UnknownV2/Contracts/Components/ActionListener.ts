import type { GameAction } from "../Actions/GameActions.ts";
import type { Entity } from "./Entity.ts";

/**
 * An entity's declaration of which actions it hears, and the mailbox
 * ResolveInputActions delivers them to.
 *
 * On the listening entity itself rather than in a side table, so it dies with
 * it: DestroyEntity strips every component, which means a destroyed menu, unit,
 * or camera stops listening without anything having to remember to deregister
 * it. Combined with Owns, destroying a menu root silently retires the whole
 * subtree's listeners.
 */
export class ActionListener {
    /**
     * The actions this entity claims on its layer.
     *
     * Claiming is what stops fallthrough: an action listed here is consumed at
     * this layer and never offered to the layers below, whether or not the
     * entity does anything with it on a given frame.
     */
    actions : Set<GameAction>

    /**
     * Actions that were pressed this frame and resolved to this listener.
     *
     * Edges, for things that should happen once per keystroke -- opening a menu,
     * confirming a selection. Rebuilt from scratch every frame.
     */
    triggered = new Set<GameAction>()

    /**
     * Actions whose key is down right now AND still resolves to this listener.
     *
     * State, for continuous effects like panning. Also rebuilt from scratch
     * every frame rather than accumulated, which is what makes a layer pushed
     * over a held key stop the camera on the next frame instead of leaving it
     * scrolling until the key is released over a layer that cannot hear it.
     */
    held = new Set<GameAction>()

    constructor (public layer : Entity, ...actions : GameAction[]) {
        this.actions = new Set(actions)
    }
}
