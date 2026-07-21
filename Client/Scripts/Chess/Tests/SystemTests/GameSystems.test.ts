// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { GlobalRegistry } from "../../Systems/Registry.ts";
import { EventQueue } from "../../Systems/EventQueue.ts";
import { HashMapComponentRegistry } from "../../Systems/ComponentRegistry.ts";
import { LinkedList } from "../../libraries/FastList/FastList.ts";
import { Position } from "../../Contracts/Position.ts";
import { Layer } from "../../Contracts/Layer.ts";
import { Representation } from "../../Contracts/Representation.ts";
import { SelectionState } from "../../Contracts/IsSelected.ts";
import { IsCollidable } from "../../Contracts/IsCollideable.ts";
import { IsMoveable } from "../../Contracts/IsMovable.ts";
import { IsSelectable } from "../../Contracts/IsSelectible.ts";
import { IsPlayer } from "../../Contracts/IsPlayer.ts";
import { IsConscious } from "../../Contracts/IsConcious.ts";
import { GameClickEvent } from "../../Contracts/GameClickEvent.ts";
import { GameCollisionEvent } from "../../Contracts/GameCollisionEvent.ts";
import { HandleInputEvents } from "../../Systems/HandleInputEvents.ts";
import { HandleMovement } from "../../Systems/HandleMovement.ts";
import { HandleCollision } from "../../Systems/HandleCollision.ts";
import { OwnedBy } from "../../Contracts/OwnedBy.ts";
import { Owns } from "../../Contracts/Owns.ts";
import { IsChessPiece } from "../../Contracts/IsChessPiece.ts";
import { IsCurrentTurn } from "../../Contracts/IsCurrentTurn.ts";
import { MovementRules } from "../../Contracts/MovementRules.ts";
import { IsGoingDown } from "../../Contracts/IsGoingDown.ts";
import { HasMoved } from "../../Contracts/HasMoved.ts";
import { EntityHandle, type Entity } from "../../Contracts/Entity.ts";
import { Color } from "../../Contracts/Color.ts";
import { TileSizePixels, ChessPieceLayer, BackgroundLayer } from "../../Configuration/DisplayConstants.ts";
import { GameWidth } from "../../Configuration/GameConstants.ts";
import { BuildPiece, BuildSide } from "../../Systems/BuildBoard.ts";
import { BishopRules, CavalryRules, KingRules, PawnRules, QueenRules, RookRules, type PieceRules } from "../../Systems/ConfiguredMovementRules.ts";
import { Omni } from "../../Systems/MoveGeneration.ts";
import { GetLegalMoves } from "../../Systems/GetLegalMoves.ts";
import { HandleSpecialMoves } from "../../Systems/HandleSpecialMoves.ts";
import { EntityBuilder } from "../../Systems/EntityBuilder.ts";
import { GameMovementEvent } from "../../Contracts/MovementEvent.ts";
import { JustDoubleStepped } from "../../Contracts/JustDoubleStepped.ts";
import { GameOver } from "../../Contracts/GameOver.ts";
import { HandleColorChanges } from "../../Systems/HandleColorChanges.ts";
import { EvaluateGameEnding, HandleWinCondition } from "../../Systems/HandleWinCondition.ts";
import { HandleTurnSwitching } from "../../Systems/HandleTurnSwitching.ts";
import { PendingPromotion } from "../../Contracts/PendingPromotion.ts";
import { PromotionOption } from "../../Contracts/PromotionOption.ts";
import { HandlePromotionChoice, PromotionChoices } from "../../Systems/HandlePromotionChoice.ts";
import { MoveHint } from "../../Contracts/MoveHint.ts";
import { HandleMoveHints } from "../../Systems/HandleMoveHints.ts";
import { GameKeyboardEvent } from "../../Contracts/KeyBoardEvent.ts";
import { SelectionUpdateEvent } from "../../Contracts/SelectionUpdate.ts";

function makeRegistry() {
  const r = new GlobalRegistry();
  for (const C of [Position, Layer, Representation, SelectionState, IsCollidable, IsMoveable, IsSelectable, IsPlayer, IsConscious, OwnedBy, Owns, IsChessPiece, IsCurrentTurn, MovementRules, IsGoingDown, HasMoved, JustDoubleStepped, GameOver, PendingPromotion, PromotionOption, MoveHint]) {
    r.RegisterComponentRegistry(C as any, new HashMapComponentRegistry(C as any));
  }
  return r;
}

// A canvas whose backing store equals its CSS box, tiles 16px each.
function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  (c as any).getBoundingClientRect = () => ({ left: 0, top: 0, width: 128, height: 128 });
  return c as HTMLCanvasElement;
}

function clickCell(col: number, row: number, canvas: HTMLCanvasElement) {
  // center of the target cell in pixels
  const px = col * TileSizePixels + TileSizePixels / 2;
  const py = row * TileSizePixels + TileSizePixels / 2;
  return new GameClickEvent({ clientX: px, clientY: py } as MouseEvent, canvas);
}

// The moves a piece currently generates, as sorted "x,y" strings.
function movesOf(r: GlobalRegistry, piece: Entity) {
  const rules = r.GetComponent(piece, MovementRules)!;
  const position = r.GetComponent(piece, Position)!;
  return rules.generateValidMoves(position, piece, r).map((p) => `${p.x},${p.y}`).sort();
}

describe("Color.ToHex", () => {
  it("clamps and pads channels, defaulting to fully opaque", () => {
    expect(new Color(260, -5, 40).ToHex()).toBe("#ff0028ff");
  });

  it("emits the opacity channel when one is given", () => {
    expect(new Color(0, 0, 0, 128).ToHex()).toBe("#00000080");
  });
});

describe("GameClickEvent", () => {
  it("maps pixels to grid cells", () => {
    const e = clickCell(4, 4, makeCanvas());
    expect(e.position.x).toBe(4);
    expect(e.position.y).toBe(4);
  });
});

describe("selection + movement", () => {
  it("clicking a piece then a destination moves the piece", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    // one conscious player, holding the turn
    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    // a moveable piece at (1,1), owned by that player
    const piece = r.CreateEntity();
    r.RegisterEntity(piece, Position, new Position(1, 1));
    r.RegisterEntity(piece, Layer, new Layer(ChessPieceLayer));
    r.RegisterEntity(piece, IsSelectable, new IsSelectable());
    r.RegisterEntity(piece, IsMoveable, new IsMoveable());
    r.RegisterEntity(piece, OwnedBy, new OwnedBy(player));
    // HandleMovement validates against MovementRules; (1,1)->(4,4) is a queen diagonal
    r.RegisterEntity(piece, MovementRules, new MovementRules(QueenRules.moves));

    // a destination tile at (4,4)
    const tile = r.CreateEntity();
    r.RegisterEntity(tile, Position, new Position(4, 4));
    r.RegisterEntity(tile, Layer, new Layer(BackgroundLayer));
    r.RegisterEntity(tile, IsSelectable, new IsSelectable());

    const canvas = makeCanvas();

    // Click the piece. SelectionState lives on the PLAYER, not the piece.
    eq.EnqueueEvent(clickCell(1, 1, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(player, SelectionState)?.source).toBe(piece);

    // Click the destination
    eq.EnqueueEvent(clickCell(4, 4, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(player, SelectionState)?.destination).toBe(tile);

    // Resolve movement
    HandleMovement(r, eq);

    const pos = r.GetComponent(piece, Position)!;
    expect(pos.x).toBe(4);
    expect(pos.y).toBe(4);
    // selection cleared after the move
    expect(r.GetComponent(player, SelectionState)).toBeUndefined();
  });

  it("does not select a piece the player does not own", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    const opponent = r.CreateEntity();

    const enemyPiece = r.CreateEntity();
    r.RegisterEntity(enemyPiece, Position, new Position(3, 3));
    r.RegisterEntity(enemyPiece, Layer, new Layer(ChessPieceLayer));
    r.RegisterEntity(enemyPiece, IsSelectable, new IsSelectable());
    r.RegisterEntity(enemyPiece, IsMoveable, new IsMoveable());
    r.RegisterEntity(enemyPiece, OwnedBy, new OwnedBy(opponent));

    eq.EnqueueEvent(clickCell(3, 3, makeCanvas()));
    HandleInputEvents(r, eq);
    eq.Clear();

    expect(r.GetComponent(player, SelectionState)).toBeUndefined();
  });

  it("re-clicking the selected piece deselects it", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    const piece = r.CreateEntity();
    r.RegisterEntity(piece, Position, new Position(2, 2));
    r.RegisterEntity(piece, Layer, new Layer(ChessPieceLayer));
    r.RegisterEntity(piece, IsSelectable, new IsSelectable());
    r.RegisterEntity(piece, IsMoveable, new IsMoveable());
    r.RegisterEntity(piece, OwnedBy, new OwnedBy(player));

    const canvas = makeCanvas();

    eq.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(player, SelectionState)?.source).toBe(piece);

    // clicking the same piece again clears the selection rather than queueing
    // a degenerate self-move
    eq.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, eq);
    eq.Clear();
    expect(r.GetComponent(player, SelectionState)).toBeUndefined();
  });
});

describe("entity allocator", () => {
  it("recycles destroyed slots and invalidates stale handles", () => {
    const r = makeRegistry();

    const a = r.CreateEntity();
    r.RegisterEntity(a, Position, new Position(1, 1));
    expect(r.IsAlive(a)).toBe(true);

    r.DestroyEntity(a);
    expect(r.IsAlive(a)).toBe(false);
    expect(r.GetComponent(a, Position)).toBeUndefined(); // components purged

    const b = r.CreateEntity();
    expect(EntityHandle.Index(b)).toBe(EntityHandle.Index(a)); // slot reused
    expect(b).not.toBe(a);                                     // but handle differs
    expect(r.IsAlive(b)).toBe(true);
    expect(r.IsAlive(a)).toBe(false);                          // stale handle stays dead

    r.DestroyEntity(a);            // idempotent double-free...
    expect(r.IsAlive(b)).toBe(true); // ...must not free b's slot
  });

  it("never mints a falsy handle", () => {
    const r = makeRegistry();

    for (let i = 0; i < 4; i++) {
      const e = r.CreateEntity();
      expect(e).toBeTruthy();
      expect(EntityHandle.Version(e)).toBeGreaterThanOrEqual(1);
      r.DestroyEntity(e);
    }
  });
});

describe("pawn movement rules", () => {
  // Builds a full side and returns the pawn sitting on `file`.
  function sideWithPawn(r: GlobalRegistry, owner: Entity, isGoingDown: boolean, file: number) {
    BuildSide(r, new Color(255, 255, 255), owner, isGoingDown);

    const homeRank = isGoingDown ? 1 : GameWidth - 2;

    let pawn: Entity | undefined;
    r.ForEachEntityWith([Position, MovementRules], (entity, position) => {
      if (position.x === file && position.y === homeRank) pawn ??= entity;
    });
    return pawn!;
  }

  it("puts back ranks on the board edges with pawns just inside", () => {
    const r = makeRegistry();
    const top = r.CreateEntity();
    const bottom = r.CreateEntity();

    BuildSide(r, new Color(255, 255, 255), top, true);
    BuildSide(r, new Color(0, 0, 0), bottom, false);

    const ranks = new Set<number>();
    r.ForEachEntityWith([Position, IsChessPiece], (_, position) => { ranks.add(position.y); });

    expect([...ranks].sort((a, b) => a - b)).toEqual([0, 1, 6, 7]);
  });

  it("offers two squares forward from home, in the side's own direction", () => {
    const r = makeRegistry();
    const downward = sideWithPawn(r, r.CreateEntity(), true, 3);

    // isGoingDown advances toward increasing y
    expect(movesOf(r, downward)).toEqual(["3,2", "3,3"]);
  });

  it("offers only one square after the pawn has moved", () => {
    const r = makeRegistry();
    const pawn = sideWithPawn(r, r.CreateEntity(), true, 3);
    r.RegisterEntity(pawn, HasMoved, new HasMoved());

    expect(movesOf(r, pawn)).toEqual(["3,2"]);
  });

  it("cannot advance at all when the square ahead is occupied", () => {
    const r = makeRegistry();
    const pawn = sideWithPawn(r, r.CreateEntity(), true, 3);

    const blocker = r.CreateEntity();
    r.RegisterEntity(blocker, Position, new Position(3, 2));
    r.RegisterEntity(blocker, IsCollidable, new IsCollidable());
    r.RegisterEntity(blocker, IsChessPiece, new IsChessPiece());

    // the double-step must not hop over the blocker either
    expect(movesOf(r, pawn)).toEqual([]);
  });

  it("takes a forward diagonal only when an enemy occupies it", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const opponent = r.CreateEntity();
    const pawn = sideWithPawn(r, owner, true, 3);

    const enemy = r.CreateEntity();
    r.RegisterEntity(enemy, Position, new Position(2, 2));
    r.RegisterEntity(enemy, IsCollidable, new IsCollidable());
    r.RegisterEntity(enemy, IsChessPiece, new IsChessPiece());
    r.RegisterEntity(enemy, OwnedBy, new OwnedBy(opponent));

    const friend = r.CreateEntity();
    r.RegisterEntity(friend, Position, new Position(4, 2));
    r.RegisterEntity(friend, IsCollidable, new IsCollidable());
    r.RegisterEntity(friend, IsChessPiece, new IsChessPiece());
    r.RegisterEntity(friend, OwnedBy, new OwnedBy(owner));

    // enemy diagonal is capturable, friendly diagonal is not
    expect(movesOf(r, pawn)).toEqual(["2,2", "3,2", "3,3"]);
  });

  it("never generates a move off the board", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    // a lone pawn on file 0 of the far rank, facing the edge
    const pawn = BuildPiece(r, new Position(0, 0), "P", new Color(0, 0, 0), owner, PawnRules.moves, false).GetEntity();

    expect(movesOf(r, pawn)).toEqual([]);
  });
});

describe("sliding and stepping pieces", () => {
  // Places one piece on an otherwise empty board and returns it.
  function place(r: GlobalRegistry, letter: string, rules: PieceRules, at: Position, owner: Entity) {
    return BuildPiece(r, at, letter, new Color(0, 0, 0), owner, rules.moves, false).GetEntity();
  }

  // A bare blocker: occupies a square without any movement rules of its own.
  function blockerAt(r: GlobalRegistry, at: Position, owner: Entity) {
    const blocker = r.CreateEntity();
    r.RegisterEntity(blocker, Position, at);
    r.RegisterEntity(blocker, IsCollidable, new IsCollidable());
    r.RegisterEntity(blocker, IsChessPiece, new IsChessPiece());
    r.RegisterEntity(blocker, OwnedBy, new OwnedBy(owner));
    return blocker;
  }

  it("stops a rook short of a friendly piece", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const rook = place(r, "R", RookRules, new Position(0, 0), owner);
    blockerAt(r, new Position(0, 3), owner);

    const moves = movesOf(r, rook);
    // reaches 0,1 and 0,2 but neither lands on nor passes through 0,3
    expect(moves).toContain("0,1");
    expect(moves).toContain("0,2");
    expect(moves).not.toContain("0,3");
    expect(moves).not.toContain("0,4");
  });

  it("lets a rook capture an enemy but not continue past it", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const rook = place(r, "R", RookRules, new Position(0, 0), owner);
    blockerAt(r, new Position(0, 3), r.CreateEntity());

    const moves = movesOf(r, rook);
    expect(moves).toContain("0,3");
    expect(moves).not.toContain("0,4");
  });

  it("jumps a cavalry out of a fully surrounded square", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const cavalry = place(r, "C", CavalryRules, new Position(4, 4), owner);

    // wall the cavalry in on all eight adjacent squares
    for (const direction of Omni) blockerAt(r, new Position(4 + direction.x, 4 + direction.y), owner);

    expect(movesOf(r, cavalry).sort()).toEqual(["2,3", "2,5", "3,2", "3,6", "5,2", "5,6", "6,3", "6,5"]);
  });

  it("gives a bishop only diagonals and a queen both", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();

    const bishop = place(r, "B", BishopRules, new Position(4, 4), owner);
    expect(movesOf(r, bishop)).not.toContain("4,5");
    expect(movesOf(r, bishop)).toContain("5,5");

    const r2 = makeRegistry();
    const queen = place(r2, "Q", QueenRules, new Position(4, 4), r2.CreateEntity());
    expect(movesOf(r2, queen)).toContain("4,5");
    expect(movesOf(r2, queen)).toContain("5,5");
  });

  it("limits the king to one square in each direction", () => {
    const r = makeRegistry();
    const king = place(r, "K", KingRules, new Position(4, 4), r.CreateEntity());

    expect(movesOf(r, king).sort()).toEqual(["3,3", "3,4", "3,5", "4,3", "4,5", "5,3", "5,4", "5,5"]);
  });

  it("counts a defended friendly square as attacked but not moveable", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const rook = place(r, "R", RookRules, new Position(0, 0), owner);
    blockerAt(r, new Position(0, 3), owner);

    const position = r.GetComponent(rook, Position)!;
    const attacked = RookRules.attacks(position, rook, r).map((p) => `${p.x},${p.y}`);

    // the defended square is controlled even though the rook may not move onto it
    expect(attacked).toContain("0,3");
    expect(movesOf(r, rook)).not.toContain("0,3");
  });
});

describe("check and pins", () => {
  // Two conscious sides, so GetOpponentOf and king lookup have something to find.
  function twoSides(r: GlobalRegistry) {
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
    return { mine, theirs };
  }

  function put(r: GlobalRegistry, letter: string, rules: PieceRules, at: Position, owner: Entity) {
    return BuildPiece(r, at, letter, new Color(0, 0, 0), owner, rules.moves, false).GetEntity();
  }

  function legalOf(r: GlobalRegistry, piece: Entity) {
    return GetLegalMoves(piece, r).map((p) => `${p.x},${p.y}`).sort();
  }

  it("will not let a king capture a defended piece", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    const king = put(r, "K", KingRules, new Position(4, 4), mine);
    // an enemy pawn on 4,5 defended by an enemy rook far up the same file
    put(r, "P", PawnRules, new Position(4, 5), theirs);
    put(r, "R", RookRules, new Position(4, 7), theirs);

    expect(legalOf(r, king)).not.toContain("4,5");
  });

  it("will not let a king step onto a square an enemy pawn covers", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    const king = put(r, "K", KingRules, new Position(4, 4), mine);
    // an upward-moving enemy pawn at 3,6 covers 2,5 and 4,5 even though both are empty
    put(r, "P", PawnRules, new Position(3, 6), theirs);

    expect(legalOf(r, king)).not.toContain("4,5");
    // ...but the pawn's own square is not defended by it, so an adjacent square is fine
    expect(legalOf(r, king)).toContain("3,4");
  });

  it("gives a pinned piece no move that exposes its king", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    put(r, "K", KingRules, new Position(4, 0), mine);
    // our cavalry is pinned against the king by an enemy rook down the file
    const cavalry = put(r, "C", CavalryRules, new Position(4, 3), mine);
    put(r, "R", RookRules, new Position(4, 7), theirs);

    // every cavalry move leaves the file, so all of them are illegal
    expect(legalOf(r, cavalry)).toEqual([]);
  });

  it("restricts a checked side to moves that answer the check", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    const king = put(r, "K", KingRules, new Position(4, 0), mine);
    const rook = put(r, "R", RookRules, new Position(0, 3), mine);
    put(r, "R", RookRules, new Position(4, 7), theirs);

    // the king must leave the attacked file
    expect(legalOf(r, king).every((square) => !square.startsWith("4,"))).toBe(true);
    // our rook's only legal move is to interpose on the checking file
    expect(legalOf(r, rook)).toEqual(["4,3"]);
  });
});

describe("castling, en passant and promotion", () => {
  function twoSides(r: GlobalRegistry) {
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
    return { mine, theirs };
  }

  function put(r: GlobalRegistry, letter: string, rules: PieceRules, at: Position, owner: Entity) {
    return BuildPiece(r, at, letter, new Color(0, 0, 0), owner, rules.moves, false).GetEntity();
  }

  // King on file 3 with a rook on file 7: castling hops the king to file 5.
  function castlingSetup(r: GlobalRegistry) {
    const { mine, theirs } = twoSides(r);
    const king = put(r, "K", KingRules, new Position(3, 0), mine);
    const rook = put(r, "R", RookRules, new Position(7, 0), mine);
    return { mine, theirs, king, rook };
  }

  it("offers the castling hop when the path is clear", () => {
    const r = makeRegistry();
    const { king } = castlingSetup(r);

    expect(GetLegalMoves(king, r).map((p) => `${p.x},${p.y}`)).toContain("5,0");
  });

  it("withholds castling once the rook has moved", () => {
    const r = makeRegistry();
    const { king, rook } = castlingSetup(r);
    r.RegisterEntity(rook, HasMoved, new HasMoved());

    expect(GetLegalMoves(king, r).map((p) => `${p.x},${p.y}`)).not.toContain("5,0");
  });

  it("withholds castling across an attacked square", () => {
    const r = makeRegistry();
    const { king, theirs } = castlingSetup(r);
    // enemy rook bearing down on file 4, which the king would cross
    put(r, "R", RookRules, new Position(4, 7), theirs);

    expect(GetLegalMoves(king, r).map((p) => `${p.x},${p.y}`)).not.toContain("5,0");
  });

  it("relocates the rook when the king castles", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { king, rook, mine } = castlingSetup(r);

    eq.EnqueueEvent(new GameMovementEvent(mine, king, new Position(3, 0), new Position(5, 0)));
    HandleSpecialMoves(r, eq);

    const rookPosition = r.GetComponent(rook, Position)!;
    expect(`${rookPosition.x},${rookPosition.y}`).toBe("4,0");
  });

  it("offers en passant only while the double-step is fresh", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    // our upward pawn on 3,3; their pawn just double-stepped to 4,3
    const ours = put(r, "P", PawnRules, new Position(3, 3), mine);
    const theirPawn = put(r, "P", PawnRules, new Position(4, 3), theirs);
    r.RegisterEntity(theirPawn, JustDoubleStepped, new JustDoubleStepped());

    expect(movesOf(r, ours)).toContain("4,2");

    r.RemoveComponent(theirPawn, JustDoubleStepped);
    expect(movesOf(r, ours)).not.toContain("4,2");
  });

  it("removes the passed pawn when en passant is taken", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { mine, theirs } = twoSides(r);

    const ours = put(r, "P", PawnRules, new Position(4, 2), mine);
    const theirPawn = put(r, "P", PawnRules, new Position(4, 3), theirs);
    r.RegisterEntity(theirPawn, JustDoubleStepped, new JustDoubleStepped());

    // our pawn has already been moved diagonally onto the empty square behind theirs
    eq.EnqueueEvent(new GameMovementEvent(mine, ours, new Position(3, 3), new Position(4, 2)));
    HandleSpecialMoves(r, eq);

    expect(r.IsAlive(theirPawn)).toBe(false);
  });

  it("auto-queens a pawn belonging to a side with nobody at the controls", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { theirs } = twoSides(r);

    // `theirs` has no IsPlayer, so there is nobody to answer a prompt.
    const pawn = put(r, "P", PawnRules, new Position(4, 0), theirs);
    eq.EnqueueEvent(new GameMovementEvent(theirs, pawn, new Position(4, 1), new Position(4, 0)));
    HandleSpecialMoves(r, eq);

    expect(r.GetComponent(pawn, PendingPromotion)).toBeUndefined();
    expect(r.GetComponent(pawn, Representation)!.model).toBe("Q");
    // and it now moves like a queen — diagonals included
    expect(movesOf(r, pawn)).toContain("5,1");
  });

  it("asks a human which piece the pawn becomes instead of assuming a queen", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { mine } = twoSides(r);

    const pawn = put(r, "P", PawnRules, new Position(4, 0), mine);
    eq.EnqueueEvent(new GameMovementEvent(mine, pawn, new Position(4, 1), new Position(4, 0)));
    HandleSpecialMoves(r, eq);

    expect(r.GetComponent(pawn, PendingPromotion)).toBeDefined();
    expect(r.GetComponent(pawn, Representation)!.model).toBe("P");
  });
});

describe("promotion picker", () => {
  function twoSides(r: GlobalRegistry) {
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
    return { mine, theirs };
  }

  // A human-owned pawn already sitting on the last rank, waiting to be asked.
  function pawnAwaitingChoice(r: GlobalRegistry, eq: EventQueue, owner: Entity) {
    const pawn = BuildPiece(r, new Position(4, 0), "P", new Color(0, 0, 0), owner, PawnRules.moves, false).GetEntity();
    eq.EnqueueEvent(new GameMovementEvent(owner, pawn, new Position(4, 1), new Position(4, 0)));
    HandleSpecialMoves(r, eq);
    return pawn;
  }

  function pickerSquares(r: GlobalRegistry) {
    const squares: Record<string, Position> = {};
    r.ForEachEntityWith([PromotionOption, Position], (_e, option, position) => {
      squares[option.letter] = position;
    });
    return squares;
  }

  it("offers a queen, rook, bishop and cavalry", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { mine } = twoSides(r);

    pawnAwaitingChoice(r, eq, mine);
    HandlePromotionChoice(r, eq);

    expect(Object.keys(pickerSquares(r)).sort()).toEqual([...PromotionChoices].sort());
  });

  // Each offer must change both what the piece looks like and how it moves — the two
  // are read by different systems, so setting only one produces a convincing liar.
  const expectations: Array<[string, string, string]> = [
    ["Q", "queen", "5,1"],
    ["R", "rook", "4,1"],
    ["B", "bishop", "5,1"],
    ["C", "cavalry", "5,2"],
  ];

  for (const [letter, name, reachable] of expectations) {
    it(`turns the pawn into a ${name} when ${name} is clicked`, () => {
      const r = makeRegistry();
      const eq = new EventQueue(new LinkedList());
      const canvas = makeCanvas();
      const { mine } = twoSides(r);

      const pawn = pawnAwaitingChoice(r, eq, mine);
      HandlePromotionChoice(r, eq);
      eq.Clear();

      const square = pickerSquares(r)[letter]!;
      eq.EnqueueEvent(clickCell(square.x, square.y, canvas));
      HandlePromotionChoice(r, eq);

      expect(r.GetComponent(pawn, Representation)!.model).toBe(letter);
      expect(movesOf(r, pawn)).toContain(reachable);
      expect(r.GetComponent(pawn, PendingPromotion)).toBeUndefined();
    });
  }

  it("clears the picker away once a choice is made", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();
    const { mine } = twoSides(r);

    pawnAwaitingChoice(r, eq, mine);
    HandlePromotionChoice(r, eq);
    eq.Clear();

    const square = pickerSquares(r)["R"]!;
    eq.EnqueueEvent(clickCell(square.x, square.y, canvas));
    HandlePromotionChoice(r, eq);

    expect(Object.keys(pickerSquares(r))).toEqual([]);
  });

  it("ignores a click that misses every offer", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();
    const { mine } = twoSides(r);

    const pawn = pawnAwaitingChoice(r, eq, mine);
    HandlePromotionChoice(r, eq);
    eq.Clear();

    // The picker sits on row 4; row 7 is nowhere near it.
    eq.EnqueueEvent(clickCell(0, 7, canvas));
    HandlePromotionChoice(r, eq);

    expect(r.GetComponent(pawn, PendingPromotion)).toBeDefined();
    expect(Object.keys(pickerSquares(r)).length).toBe(PromotionChoices.length);
  });

  it("holds the turn until the choice comes in, then passes it", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();
    const { mine, theirs } = twoSides(r);

    pawnAwaitingChoice(r, eq, mine);
    HandlePromotionChoice(r, eq);

    // The movement event is still on the queue, but the promotion outranks it.
    HandleTurnSwitching(r, eq);
    expect(r.GetComponent(mine, IsCurrentTurn)).toBeDefined();
    expect(r.GetComponent(theirs, IsCurrentTurn)).toBeUndefined();

    eq.Clear();

    const square = pickerSquares(r)["Q"]!;
    eq.EnqueueEvent(clickCell(square.x, square.y, canvas));
    HandlePromotionChoice(r, eq);
    HandleTurnSwitching(r, eq);

    expect(r.GetComponent(mine, IsCurrentTurn)).toBeUndefined();
    expect(r.GetComponent(theirs, IsCurrentTurn)).toBeDefined();
  });

  it("does not accept board input while the prompt is up", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();
    const { mine } = twoSides(r);

    pawnAwaitingChoice(r, eq, mine);
    HandlePromotionChoice(r, eq);
    eq.Clear();

    const other = BuildPiece(r, new Position(1, 6), "R", new Color(0, 0, 0), mine, RookRules.moves, false).GetEntity();

    eq.EnqueueEvent(clickCell(1, 6, canvas));
    HandleInputEvents(r, eq);

    expect(r.GetComponent(mine, SelectionState)).toBeUndefined();
    expect(r.GetComponent(other, Position)).toEqual(new Position(1, 6));
  });
});

describe("move hints", () => {
  function hintSquares(r: GlobalRegistry) {
    const squares: string[] = [];
    r.ForEachEntityWith([MoveHint, Position], (_e, _h, position) => {
      squares.push(`${position.x},${position.y}`);
    });
    return squares.sort();
  }

  it("marks exactly the selected piece's legal squares", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const owner = r.CreateEntity();
    const rook = BuildPiece(r, new Position(0, 0), "R", new Color(0, 0, 0), owner, RookRules.moves, false).GetEntity();

    eq.EnqueueEvent(new SelectionUpdateEvent(rook, true));
    HandleMoveHints(r, eq);

    expect(hintSquares(r)).toEqual(GetLegalMoves(rook, r).map((p) => `${p.x},${p.y}`).sort());
    expect(hintSquares(r).length).toBeGreaterThan(0);
  });

  it("clears every hint when the piece is released", () => {
    const r = makeRegistry();
    const owner = r.CreateEntity();
    const rook = BuildPiece(r, new Position(0, 0), "R", new Color(0, 0, 0), owner, RookRules.moves, false).GetEntity();

    const select = new EventQueue(new LinkedList());
    select.EnqueueEvent(new SelectionUpdateEvent(rook, true));
    HandleMoveHints(r, select);
    expect(hintSquares(r).length).toBeGreaterThan(0);

    const release = new EventQueue(new LinkedList());
    release.EnqueueEvent(new SelectionUpdateEvent(rook, false));
    HandleMoveHints(r, release);

    expect(hintSquares(r)).toEqual([]);
  });

  it("leaves no hint on a square that would expose the king", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();

    BuildPiece(r, new Position(4, 0), "K", new Color(0, 0, 0), mine, KingRules.moves, false);
    // A cavalry pinned to the king down the file: every hint would be illegal.
    const cavalry = BuildPiece(r, new Position(4, 3), "C", new Color(0, 0, 0), mine, CavalryRules.moves, false).GetEntity();
    BuildPiece(r, new Position(4, 7), "R", new Color(0, 0, 0), theirs, RookRules.moves, false);

    eq.EnqueueEvent(new SelectionUpdateEvent(cavalry, true));
    HandleMoveHints(r, eq);

    expect(hintSquares(r)).toEqual([]);
  });
});

describe("escape to deselect", () => {
  it("drops a held piece and clears its highlight and hints", () => {
    const r = makeRegistry();
    const canvas = makeCanvas();
    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    const pawn = BuildPiece(r, new Position(2, 2), "P", new Color(0, 0, 0), player, PawnRules.moves, false).GetEntity();

    // Pick the pawn up through the real input path, hints and all.
    const pick = new EventQueue(new LinkedList());
    pick.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, pick);
    HandleMoveHints(r, pick);
    expect(r.GetComponent(player, SelectionState)).toBeDefined();

    // Escape puts it back down.
    const escape = new EventQueue(new LinkedList());
    escape.EnqueueEvent(new GameKeyboardEvent({ code: "Escape" } as KeyboardEvent));
    HandleInputEvents(r, escape);
    HandleMoveHints(r, escape);

    expect(r.GetComponent(player, SelectionState)).toBeUndefined();
    let hintCount = 0;
    r.ForEachEntityWith([MoveHint], () => { hintCount++ });
    expect(hintCount).toBe(0);
    // The pawn stayed put.
    expect(r.GetComponent(pawn, Position)).toEqual(new Position(2, 2));
  });

  it("does nothing when no piece is held", () => {
    const r = makeRegistry();
    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    const eq = new EventQueue(new LinkedList());
    eq.EnqueueEvent(new GameKeyboardEvent({ code: "Escape" } as KeyboardEvent));

    expect(() => HandleInputEvents(r, eq)).not.toThrow();
    expect(r.GetComponent(player, SelectionState)).toBeUndefined();
  });
});

describe("win condition", () => {
  // Two conscious sides; `mine` moves first and is the one we mate or stalemate.
  function twoSides(r: GlobalRegistry) {
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();
    return { mine, theirs };
  }

  function put(r: GlobalRegistry, letter: string, rules: PieceRules, at: Position, owner: Entity) {
    return BuildPiece(r, at, letter, new Color(0, 0, 0), owner, rules.moves, false).GetEntity();
  }

  function isOver(r: GlobalRegistry) {
    let over = false;
    r.ForEachEntityWith([GameOver], () => { over = true });
    return over;
  }

  it("calls a supported queen beside the king checkmate", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    // Our cornered king is checked by a queen it cannot take, because the enemy king
    // defends her, and every flight square is covered by that same queen.
    put(r, "K", KingRules, new Position(0, 0), mine);
    put(r, "Q", QueenRules, new Position(1, 0), theirs);
    put(r, "K", KingRules, new Position(2, 0), theirs);

    expect(EvaluateGameEnding(r)).toBe("checkmate");
  });

  it("calls a king with no safe square but no check stalemate", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    // Cornered king, not attacked, every escape square covered by the enemy queen.
    put(r, "K", KingRules, new Position(0, 0), mine);
    put(r, "Q", QueenRules, new Position(2, 1), theirs);
    put(r, "K", KingRules, new Position(7, 7), theirs);

    expect(EvaluateGameEnding(r)).toBe("stalemate");
  });

  it("does not end the game on a check the side to move can answer", () => {
    const r = makeRegistry();
    const { mine, theirs } = twoSides(r);

    // In check from the rook, but the king simply steps off the file.
    put(r, "K", KingRules, new Position(4, 0), mine);
    put(r, "R", RookRules, new Position(4, 7), theirs);

    expect(EvaluateGameEnding(r)).toBeUndefined();
  });

  it("tags GameOver and posts a banner when a move delivers mate", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const { mine, theirs } = twoSides(r);

    put(r, "K", KingRules, new Position(0, 0), mine);
    const queen = put(r, "Q", QueenRules, new Position(1, 0), theirs);
    put(r, "K", KingRules, new Position(2, 0), theirs);

    expect(isOver(r)).toBe(false);

    // Nothing happens on a quiet frame — the scan is gated on a move having landed.
    HandleWinCondition(r, eq);
    expect(isOver(r)).toBe(false);

    eq.EnqueueEvent(new GameMovementEvent(theirs, queen, new Position(1, 7), new Position(1, 0)));
    HandleWinCondition(r, eq);

    expect(isOver(r)).toBe(true);
  });

  it("stops accepting input once the game is over", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();
    const { mine } = twoSides(r);

    const pawn = put(r, "P", PawnRules, new Position(2, 2), mine);
    r.RegisterEntity(mine, GameOver, new GameOver());

    eq.EnqueueEvent(clickCell(2, 2, canvas));
    HandleInputEvents(r, eq);

    // No selection was recorded, so the piece cannot be moved either.
    expect(r.GetComponent(mine, SelectionState)).toBeUndefined();
    expect(r.GetComponent(pawn, Position)).toEqual(new Position(2, 2));
  });
});

describe("turn switching", () => {
  it("hands the turn to the other conscious side after a move", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    const theirs = new EntityBuilder(r).AddIsConsciousness(false).GetEntity();

    const pawn = BuildPiece(r, new Position(2, 2), "P", new Color(0, 0, 0), mine, PawnRules.moves, false).GetEntity();

    eq.EnqueueEvent(new GameMovementEvent(mine, pawn, new Position(2, 3), new Position(2, 2)));
    HandleTurnSwitching(r, eq);

    expect(r.GetComponent(mine, IsCurrentTurn)).toBeUndefined();
    expect(r.GetComponent(theirs, IsCurrentTurn)).toBeDefined();
  });

  it("leaves the turn alone on a frame with no move", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());
    const mine = new EntityBuilder(r).AddIsConsciousness(true, true).GetEntity();
    new EntityBuilder(r).AddIsConsciousness(false).GetEntity();

    HandleTurnSwitching(r, eq);

    expect(r.GetComponent(mine, IsCurrentTurn)).toBeDefined();
  });
});

describe("selection highlighting", () => {
  // A player owning one selectable, moveable piece painted from a shared palette color.
  function selectableSetup(r: GlobalRegistry, palette: Color) {
    const player = r.CreateEntity();
    r.RegisterEntity(player, IsConscious, new IsConscious());
    r.RegisterEntity(player, IsPlayer, new IsPlayer());
    r.RegisterEntity(player, IsCurrentTurn, new IsCurrentTurn());

    const piece = BuildPiece(r, new Position(2, 2), "P", palette, player, PawnRules.moves, false).GetEntity();

    return { player, piece };
  }

  function colorOf(r: GlobalRegistry, entity: Entity) {
    const { red, green, blue } = r.GetComponent(entity, Representation)!.color;
    return `${red},${green},${blue}`;
  }

  // One full select-then-deselect cycle through the real input and color systems.
  function clickTwice(r: GlobalRegistry, at: [number, number]) {
    const eq = new EventQueue(new LinkedList());
    const canvas = makeCanvas();

    for (let click = 0; click < 2; click++) {
      eq.EnqueueEvent(clickCell(at[0], at[1], canvas));
      HandleInputEvents(r, eq);
      HandleColorChanges(r, eq);
      eq.Clear();
    }
  }

  it("restores the original color when a piece is deselected by re-clicking", () => {
    const r = makeRegistry();
    const { piece } = selectableSetup(r, new Color(100, 100, 100));
    const before = colorOf(r, piece);

    clickTwice(r, [2, 2]);

    expect(colorOf(r, piece)).toBe(before);
  });

  it("does not accumulate lightening across repeated select/deselect cycles", () => {
    const r = makeRegistry();
    const { piece } = selectableSetup(r, new Color(100, 100, 100));
    const before = colorOf(r, piece);

    for (let cycle = 0; cycle < 5; cycle++) clickTwice(r, [2, 2]);

    expect(colorOf(r, piece)).toBe(before);
  });

  it("gives each piece its own color instance so highlighting stays local", () => {
    const r = makeRegistry();
    const palette = new Color(100, 100, 100);
    const { piece } = selectableSetup(r, palette);

    // a second piece painted from the very same palette constant
    const sibling = BuildPiece(r, new Position(5, 5), "P", palette, r.CreateEntity(), PawnRules.moves, false).GetEntity();
    const siblingBefore = colorOf(r, sibling);

    const eq = new EventQueue(new LinkedList());
    eq.EnqueueEvent(clickCell(2, 2, makeCanvas()));
    HandleInputEvents(r, eq);
    HandleColorChanges(r, eq);

    // the selected piece brightened, but nothing else did
    expect(colorOf(r, piece)).not.toBe(siblingBefore);
    expect(colorOf(r, sibling)).toBe(siblingBefore);
    // and the shared palette constant itself is untouched
    expect(`${palette.red},${palette.green},${palette.blue}`).toBe("100,100,100");
  });
});

describe("collision", () => {
  it("fires only for collidables sharing a cell", () => {
    const r = makeRegistry();
    const eq = new EventQueue(new LinkedList());

    const a = r.CreateEntity();
    r.RegisterEntity(a, Position, new Position(2, 3));
    r.RegisterEntity(a, IsCollidable, new IsCollidable());

    const b = r.CreateEntity();
    r.RegisterEntity(b, Position, new Position(2, 3));
    r.RegisterEntity(b, IsCollidable, new IsCollidable());

    const c = r.CreateEntity();
    r.RegisterEntity(c, Position, new Position(5, 5));
    r.RegisterEntity(c, IsCollidable, new IsCollidable());

    HandleCollision(r, eq);
    const collisions = eq.GetEventsOfType(GameCollisionEvent);
    // b arriving onto a's cell fires one directed event (b -> a); c alone fires none.
    expect(collisions.length).toBe(1);
    expect(collisions[0]!.collidingEntity).toBe(b);
    expect(collisions[0]!.collidedEntity).toBe(a);
  });
});
