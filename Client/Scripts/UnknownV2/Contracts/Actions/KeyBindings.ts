import { AllGameActions, DefaultKeyBindings, type GameAction } from "./GameActions.ts";

/**
 * The map between physical keys and the actions they mean.
 *
 * Two indexes over the same data, kept in step by Rebind: codes are looked up
 * per key event, so that direction has to be a hash rather than a scan, and
 * actions are listed by the keybindings screen, so that direction has to be
 * enumerable in a stable order.
 */
export class KeyBindings {
    private _codeToAction = new Map<string, GameAction>()
    private _actionToCodes = new Map<GameAction, string[]>()

    constructor (initial : Readonly<Record<GameAction, readonly string[]>> = DefaultKeyBindings) {
        // Seeded from AllGameActions rather than Object.keys(initial) so every
        // action has an entry -- an unbound action still has to appear on the
        // keybindings screen, otherwise there is no row to rebind it from.
        for (const action of AllGameActions) this._actionToCodes.set(action, [])

        for (const action of AllGameActions) this.Rebind(action, [...(initial[action] ?? [])])
    }

    ActionForCode(code : string) : GameAction | undefined {
        return this._codeToAction.get(code)
    }

    CodesForAction(action : GameAction) : readonly string[] {
        return this._actionToCodes.get(action) ?? []
    }

    /**
     * Points `action` at exactly `codes`, releasing whatever it held before.
     *
     * A code claimed by another action is taken from it rather than shared: one
     * code means one action, or a press has no single intent for the layer stack
     * to route. Rebinding is therefore always well defined, at the cost of
     * silently unbinding the loser -- which the keybindings screen shows.
     */
    Rebind(action : GameAction, codes : readonly string[]) : void {
        for (const oldCode of this._actionToCodes.get(action) ?? []) this._codeToAction.delete(oldCode)

        const claimed : string[] = []

        for (const code of codes) {
            const previousOwner = this._codeToAction.get(code)

            if (previousOwner !== undefined && previousOwner !== action) {
                const previousCodes = this._actionToCodes.get(previousOwner)

                if (previousCodes) this._actionToCodes.set(previousOwner, previousCodes.filter((each)=>each !== code))
            }

            // Guard against the same code appearing twice in one call, which
            // would list it twice on the keybindings screen.
            if (claimed.includes(code)) continue

            this._codeToAction.set(code, action)
            claimed.push(code)
        }

        this._actionToCodes.set(action, claimed)
    }

    /**
     * Every action with the codes currently bound to it, in AllGameActions
     * order. What the keybindings screen renders.
     */
    Pairs() : { action : GameAction, codes : readonly string[] }[] {
        return AllGameActions.map((action)=>({ action, codes: this.CodesForAction(action) }))
    }
}
