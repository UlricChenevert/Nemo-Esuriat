import { describe, it, expect } from "vitest";
import { GlobalRegistry } from "../../Systems/Registry.ts";
import { HashMapComponentRegistry } from "../../Systems/ComponentRegistry.ts";
import { Position } from "../../Contracts/Position.ts";
import { Layer } from "../../Contracts/Layer.ts";
import { Representation } from "../../Contracts/Representation.ts";
import { SelectionState } from "../../Contracts/IsSelected.ts";
import { IsCollidable } from "../../Contracts/IsCollideable.ts";
import { IsMoveable } from "../../Contracts/IsMovable.ts";
import { IsSelectable } from "../../Contracts/IsSelectible.ts";
import { IsPlayer } from "../../Contracts/IsPlayer.ts";
import { IsConscious } from "../../Contracts/IsConcious.ts";
import { OwnedBy } from "../../Contracts/OwnedBy.ts";
import { Owns } from "../../Contracts/Owns.ts";
import { IsChessPiece } from "../../Contracts/IsChessPiece.ts";
import { IsCurrentTurn } from "../../Contracts/IsCurrentTurn.ts";
import { MovementRules } from "../../Contracts/MovementRules.ts";
import { IsGoingDown } from "../../Contracts/IsGoingDown.ts";
import { HasMoved } from "../../Contracts/HasMoved.ts";
import { JustDoubleStepped } from "../../Contracts/JustDoubleStepped.ts";
import { PendingPromotion } from "../../Contracts/PendingPromotion.ts";
import { Color } from "../../Contracts/Color.ts";
import { type Entity } from "../../Contracts/Entity.ts";
import { BuildPiece, BuildSide } from "../../Systems/BuildBoard.ts";
import { KingRules, PawnRules, QueenRules, RookRules, type PieceRules } from "../../Systems/ConfiguredMovementRules.ts";
import { EntityBuilder } from "../../Systems/EntityBuilder.ts";
import { GetLegalMoves, IsInCheck } from "../../Systems/GetLegalMoves.ts";
import { GetOpponentOf } from "../../Utilities/TeamUtilities.ts";
import { isSamePosition } from "../../Utilities/PositionUtilities.ts";
import { CloneGameState } from "../../Systems/Ai/CloneGameState.ts";
import { ApplyMove, EnumerateMoves, type CandidateMove } from "../../Systems/Ai/MoveEnumeration.ts";
import { FindBestMove } from "../../Systems/Ai/Search.ts";

function makeRegistry() {
  const r = new GlobalRegistry();
  for (const C of [Position, Layer, Representation, SelectionState, IsCollidable, IsMoveable, IsSelectable, IsPlayer, IsConscious, OwnedBy, Owns, IsChessPiece, IsCurrentTurn, MovementRules, IsGoingDown, HasMoved, JustDoubleStepped, PendingPromotion]) {
    r.RegisterComponentRegistry(C as any, new HashMapComponentRegistry(C as any));
  }
  return r;
}

// Two conscious sides. `mine` is the computer (no IsPlayer) and moves first.
function sides(r: GlobalRegistry) {
  const mine = new EntityBuilder(r).AddIsConsciousness(false, true).GetEntity();
  const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
  return { mine, theirs };
}

function put(r: GlobalRegistry, letter: string, rules: PieceRules, at: Position, owner: Entity, goingDown = false) {
  return BuildPiece(r, at, letter, new Color(0, 0, 0), owner, rules.moves, goingDown).GetEntity();
}

// A tiny deterministic PRNG so the legality fuzz is reproducible.
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe("CloneGameState", () => {
  it("reproduces pieces and isolates the copy from the original", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    const rook = put(r, "R", RookRules, new Position(0, 0), mine);
    put(r, "K", KingRules, new Position(4, 0), mine);
    put(r, "K", KingRules, new Position(4, 7), theirs);

    const clone = CloneGameState(r);
    const clonedRook = clone.translate.get(rook)!;

    // Same square in the copy...
    expect(clone.registry.GetComponent(clonedRook, Position)).toEqual(new Position(0, 0));

    // ...and mutating the copy leaves the source untouched.
    clone.registry.GetComponent(clonedRook, Position)!.x = 5;
    expect(r.GetComponent(rook, Position)).toEqual(new Position(0, 0));

    // Ownership is remapped onto the cloned side, not left dangling at the original.
    expect(clone.registry.GetComponent(clonedRook, OwnedBy)!.owner).toBe(clone.translate.get(mine));
  });

  it("gives a cloned piece the same legal moves as the original", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    const rook = put(r, "R", RookRules, new Position(0, 0), mine);
    put(r, "K", KingRules, new Position(4, 0), mine);
    put(r, "K", KingRules, new Position(4, 7), theirs);

    const clone = CloneGameState(r);
    const clonedRook = clone.translate.get(rook)!;

    const original = GetLegalMoves(rook, r).map((p) => `${p.x},${p.y}`).sort();
    const copied = GetLegalMoves(clonedRook, clone.registry).map((p) => `${p.x},${p.y}`).sort();

    expect(copied).toEqual(original);
  });
});

describe("ApplyMove", () => {
  it("removes a captured piece from the board", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    const rook = put(r, "R", RookRules, new Position(0, 0), mine);
    put(r, "K", KingRules, new Position(7, 0), mine);
    const victim = put(r, "P", PawnRules, new Position(0, 5), theirs);
    put(r, "K", KingRules, new Position(7, 7), theirs);

    ApplyMove(r, { piece: rook, from: new Position(0, 0), to: new Position(0, 5) });

    expect(r.GetComponent(rook, Position)).toEqual(new Position(0, 5));
    expect(r.IsAlive(victim)).toBe(false);
  });

  it("promotes a pawn that reaches the last rank", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    const pawn = put(r, "P", PawnRules, new Position(4, 1), mine);
    put(r, "K", KingRules, new Position(7, 0), mine);
    put(r, "K", KingRules, new Position(7, 7), theirs);

    ApplyMove(r, { piece: pawn, from: new Position(4, 1), to: new Position(4, 0) });

    // The cloned/searched side has no IsPlayer, so it auto-queens rather than prompting.
    expect(r.GetComponent(pawn, Representation)!.model).toBe("Q");
  });
});

describe("FindBestMove", () => {
  it("plays the move that delivers checkmate", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    put(r, "K", KingRules, new Position(2, 0), mine);
    const rook = put(r, "R", RookRules, new Position(5, 7), mine);
    put(r, "K", KingRules, new Position(0, 0), theirs);

    const move = FindBestMove(r, mine, 3);

    expect(move).toBeDefined();
    expect(move!.piece).toBe(rook);

    // Playing it leaves the enemy king mated: in check with no reply.
    const clone = CloneGameState(r);
    ApplyMove(clone.registry, { piece: clone.translate.get(move!.piece)!, from: move!.from, to: move!.to });
    const clonedEnemy = clone.translate.get(theirs)!;
    expect(EnumerateMoves(clone.registry, clonedEnemy)).toHaveLength(0);
    expect(IsInCheck(clonedEnemy, clone.registry)).toBe(true);
  });

  it("does not grab a defended pawn and hang its queen", () => {
    const r = makeRegistry();
    const { mine, theirs } = sides(r);
    put(r, "K", KingRules, new Position(0, 0), mine);
    put(r, "Q", QueenRules, new Position(3, 3), mine);
    put(r, "P", PawnRules, new Position(6, 1), mine, false);
    put(r, "K", KingRules, new Position(7, 7), theirs);
    put(r, "P", PawnRules, new Position(3, 5), theirs, true);
    put(r, "R", RookRules, new Position(7, 5), theirs); // defends the pawn along rank 5

    // Sanity: taking the pawn really is on the table before we ask the engine to shun it.
    const queen = mineQueen(r);
    expect(GetLegalMoves(queen, r).some((p) => isSamePosition(p, new Position(3, 5)))).toBe(true);

    const move = FindBestMove(r, mine, 2);

    expect(move).toBeDefined();
    // Whatever it does, it must not be the queen swallowing the defended pawn.
    expect(isSamePosition(move!.to, new Position(3, 5))).toBe(false);
  });
});

// Finds mine's queen by scanning — small helper for the readability of the test above.
function mineQueen(r: GlobalRegistry): Entity {
  let queen: Entity | undefined;
  r.ForEachEntityWith([Position, Representation], (entity, _p, rep) => {
    if (rep.model === "Q") queen ??= entity;
  });
  return queen!;
}

describe("AI move legality", () => {
  it("only ever returns legal moves across a played-out game", () => {
    const r = makeRegistry();
    const mine = new EntityBuilder(r).AddIsConsciousness(false, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
    BuildSide(r, new Color(230, 33, 0), mine, false);
    BuildSide(r, new Color(32, 194, 14), theirs, true);

    const rng = makeRng(20260720);
    let side = mine;

    // Depth 1 from the full board keeps the walk quick; legality does not depend on depth.
    for (let ply = 0; ply < 16; ply++) {
      const move = FindBestMove(r, side, 1);
      if (move === undefined) break; // checkmate or stalemate — nothing illegal about stopping

      // The engine's choice has to be something the rules actually permit.
      const legal = GetLegalMoves(move.piece, r).some((p) => isSamePosition(p, move.to));
      expect(legal).toBe(true);

      // Advance the real game with a random legal move to reach a fresh position.
      const all: CandidateMove[] = EnumerateMoves(r, side);
      const chosen = all[Math.floor(rng() * all.length)]!;
      ApplyMove(r, chosen);

      side = GetOpponentOf(side, r)!;
    }
  }, 30000);
});
