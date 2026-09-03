import type { ClickGestureValue } from "../Actions/GameActions.ts";
import type { GameClickEvent } from "../Events/GameClickEvent.ts";
import type { Entity } from "./Entity.ts";

/**
 * An entity's declaration of which clicks it hears, and the mailbox ResolveClickTargets
 * delivers them to.
 *
 * The click half of ActionListener, and deliberately the same shape. Clicks used to skip
 * the layer stack entirely -- HandleInputEvents read them straight off the event queue,
 * and GetEventsOfType is a non-destructive filter with no notion of a click being
 * consumed. So a pushed layer could silence a keypress but not a click, and anything
 * wanting to intercept one had to special-case itself inside the gameplay system that
 * happened to read it first.
 *
 * On the listening entity rather than in a side table, so it dies with it: DestroyEntity
 * strips every component, which means a destroyed menu or debug layer stops listening
 * without anything having to remember to deregister it.
 */
export class ClickListener {
    /**
     * Clicks that resolved to this listener this frame.
     *
     * Rebuilt from scratch every frame, like ActionListener's sets, so a listener whose
     * layer has been buried does not hold last frame's clicks forever.
     */
    clicks : GameClickEvent[] = []

    /**
     * The gesture this entity claims on its layer.
     *
     * Claiming is what stops fallthrough: a gesture listed here is consumed at this layer
     * and never offered to the layers below, whether or not the entity does anything with
     * it on a given frame. Claiming one gesture and not the other is what lets the debug
     * layer take ctrl+click while ordinary clicks carry on down to the world.
     */
    constructor (public layer : Entity, public gesture : ClickGestureValue) {}
}
