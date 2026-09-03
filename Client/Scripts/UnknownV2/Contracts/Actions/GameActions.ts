/**
 * Every action the game can be asked to perform, named by intent rather than by
 * the key that happens to produce it.
 *
 * This list is the whole point of the indirection: systems listen for
 * "PanCameraUp", not for "KeyW", so rebinding a key is a change to KeyBindings
 * and nothing downstream notices. It is also what the keybindings screen
 * enumerates, so an action with no entry here cannot be displayed or rebound.
 */
export const AllGameActions = [
    "PanCameraUp",
    "PanCameraDown",
    "PanCameraLeft",
    "PanCameraRight",
    "NavigateUp",
    "NavigateDown",
    "NavigateLeft",
    "NavigateRight",
    "Interact",
    "OpenMenu"
] as const

export type GameAction = typeof AllGameActions[number]

/**
 * The bindings a fresh game starts with, by KeyboardEvent.code.
 *
 * Keyed on `code` rather than `key` because that is what GameKeyboardEvent
 * captures, and because it is layout-independent: the key physically where W
 * sits reports "KeyW" whether the layout is QWERTY, AZERTY, or Dvorak.
 *
 * An action may have several codes, but a code maps to exactly one action --
 * a key press has to resolve to a single intent before the layer stack can
 * decide who hears it. This is why there is no separate "Cancel": Escape is
 * OpenMenu, and an already-open menu reads OpenMenu as "back", which is the
 * same key doing the same thing one level down rather than two actions
 * fighting over one code.
 *
 * For the same reason there is no separate "Confirm". Choosing a menu row and
 * acting on the world are one intent -- "do the thing in front of me" -- and
 * splitting them meant two actions competing for Space. Which of the two a press
 * means is already answered by the layer stack: a menu's layer sits above the
 * world's and claims Interact while it is open, so the player never hears it.
 *
 * WASD pans the camera and the arrows drive menus, so the two never contend.
 */
export const DefaultKeyBindings : Readonly<Record<GameAction, readonly string[]>> = {
    PanCameraUp: ["KeyW"],
    PanCameraDown: ["KeyS"],
    PanCameraLeft: ["KeyA"],
    PanCameraRight: ["KeyD"],
    NavigateUp: ["ArrowUp"],
    NavigateDown: ["ArrowDown"],
    NavigateLeft: ["ArrowLeft"],
    NavigateRight: ["ArrowRight"],
    Interact: ["Space", "Enter"],
    OpenMenu: ["Escape"]
}

/**
 * The kinds of click the game distinguishes, named by intent rather than by which
 * modifier happens to produce them.
 *
 * A gesture is to a click what an action is to a key, and it exists for the same reason:
 * so the layer stack has a single thing to route on. A plain click means "act on the
 * world here"; a control click means "tell me about this", which is what the debug
 * inspector claims.
 *
 * Kept deliberately small. This is not a modifier bitfield -- if a third gesture is ever
 * wanted it should earn a name here rather than callers testing modifiers themselves,
 * which is exactly the special-casing routing through the stack is meant to remove.
 */
export const ClickGesture = {
    Plain : 0,
    Control : 1
} as const

export type ClickGestureValue = typeof ClickGesture[keyof typeof ClickGesture]

export const ClickGestureNames : readonly string[] = ["Plain", "Control"]
