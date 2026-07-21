import type { Entity } from "../../Contracts/Entity.ts";
import type { IRegistry } from "../../Interfaces/IRegistry.ts";
import { GetOpponentOf } from "../../Utilities/TeamUtilities.ts";
import { IsInCheck } from "../GetLegalMoves.ts";
import { CloneGameState } from "./CloneGameState.ts";
import { Evaluate } from "./Evaluate.ts";
import { ApplyMove, EnumerateMoves, type CandidateMove } from "./MoveEnumeration.ts";

/** A checkmate is scored near this; the ply offset makes the engine prefer a faster one. */
const MateScore = 1_000_000

/**
 * Negamax with alpha-beta pruning. Returns the value of the position for the side to
 * move. Each branch runs on its own clone, so the caller's board is never touched.
 */
function Negamax (registry : IRegistry, side : Entity, depth : number, ply : number, alpha : number, beta : number) : number {
    const moves = EnumerateMoves(registry, side)

    if (moves.length === 0) {
        // No reply: mate if the king is under attack, otherwise a draw by stalemate.
        return IsInCheck(side, registry)? -(MateScore - ply) : 0
    }

    if (depth === 0) return Evaluate(registry, side)

    let best = -Infinity

    for (const move of moves) {
        const score = -ScoreChild(registry, side, move, depth, ply, -beta, -alpha)

        if (score > best) best = score
        if (best > alpha) alpha = best
        if (alpha >= beta) break // this line is already too good for the opponent to allow
    }

    return best
}

/** Clones, plays `move`, and hands the resulting position to the opponent to evaluate. */
function ScoreChild (registry : IRegistry, side : Entity, move : CandidateMove, depth : number, ply : number, alpha : number, beta : number) : number {
    const child = CloneGameState(registry)
    const clonedMove : CandidateMove = { piece: child.translate.get(move.piece)!, from: move.from, to: move.to }

    ApplyMove(child.registry, clonedMove)

    const mover = child.translate.get(side)!
    const opponent = GetOpponentOf(mover, child.registry)

    if (opponent === undefined) return Evaluate(child.registry, mover)

    return Negamax(child.registry, opponent, depth - 1, ply + 1, alpha, beta)
}

/**
 * The best move `side` can make on `registry`, or undefined if it has none. The returned
 * move's handles and positions belong to `registry`, ready to submit to the live game.
 */
export function FindBestMove (registry : IRegistry, side : Entity, depth : number) : CandidateMove | undefined {
    const moves = EnumerateMoves(registry, side)

    let best : CandidateMove | undefined
    let bestScore = -Infinity

    for (const move of moves) {
        const score = -ScoreChild(registry, side, move, depth, 1, -Infinity, Infinity)

        if (score > bestScore) {
            bestScore = score
            best = move
        }
    }

    return best
}
