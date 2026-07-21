import { SecondaryPieceColor, BackgroundLayer, BoardColorAlternate, BoardColorMain, ChessPieceLayer, KingRepresentationLetter, PrimaryPieceColor, PawnRepresentationLetter, RookRepresentationLetter, CavalryRepresentationLetter, BishopRepresentationLetter, QueenRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { Color } from "../Contracts/Color.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { Layer } from "../Contracts/Layer.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IGenerateValidMoves } from "../Interfaces/IGenerateValidMoves.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "./EntityBuilder.ts";
import { BishopRules, CavalryRules, KingRules, PawnRules, QueenRules, RookRules } from "./ConfiguredMovementRules.ts";

export function BuildScene (registry : IRegistry, player1 : Entity, player2 : Entity) {
    BuildSide(registry, PrimaryPieceColor, player1, false)
    BuildSide(registry, SecondaryPieceColor, player2, true)

    BuildBoard(registry)
}

export function BuildPiece(registry : IRegistry, position : Position, model: string, color: Color, owner : Entity, generateValidMoves: IGenerateValidMoves, isGoingDown : boolean) {
    return new EntityBuilder(registry)
        .AddPosition(position)
        .AddLayer(new Layer(ChessPieceLayer))
        .AddRepresentation(new Representation(model, color))
        .AddTags(true, true, true, true)
        .AddOwner(owner)
        .AddMovementRules(generateValidMoves, isGoingDown)
}

export function BuildSide(registry : IRegistry, color : Color, owner : Entity, isGoingDown : boolean) {
    const backYCoordinate = (isGoingDown)? 0 : GameWidth - 1
    const frontYCoordinate = (isGoingDown)? 1 : GameWidth - 2

    for (let i = 0; i < GameWidth; i++) {
        BuildPiece(registry, new Position(i, frontYCoordinate), PawnRepresentationLetter, color.Copy(), owner, PawnRules.moves, isGoingDown)
    }

    BuildPiece(registry, new Position(0, backYCoordinate), RookRepresentationLetter, color.Copy(), owner, RookRules.moves, isGoingDown)
    BuildPiece(registry, new Position(1, backYCoordinate), CavalryRepresentationLetter, color.Copy(), owner, CavalryRules.moves, isGoingDown)
    BuildPiece(registry, new Position(2, backYCoordinate), BishopRepresentationLetter, color.Copy(), owner, BishopRules.moves, isGoingDown)
    BuildPiece(registry, new Position(3, backYCoordinate), KingRepresentationLetter, color.Copy(), owner, KingRules.moves, isGoingDown)
    BuildPiece(registry, new Position(4, backYCoordinate), QueenRepresentationLetter, color.Copy(), owner, QueenRules.moves, isGoingDown)
    BuildPiece(registry, new Position(5, backYCoordinate), BishopRepresentationLetter, color.Copy(), owner, BishopRules.moves, isGoingDown)
    BuildPiece(registry, new Position(6, backYCoordinate), CavalryRepresentationLetter, color.Copy(), owner, CavalryRules.moves, isGoingDown)
    BuildPiece(registry, new Position(7, backYCoordinate), RookRepresentationLetter, color.Copy(), owner, RookRules.moves, isGoingDown)
}

export function BuildBoard(registry : IRegistry) {
    for (let i = 0; i < GameWidth; i ++) {
        for (let j = 0; j < GameWidth; j ++) {
            new EntityBuilder(registry)
                .AddPosition(new Position(i, j))
                .AddLayer(new Layer(BackgroundLayer))
                .AddRepresentation(new Representation("X", ((i + j) % 2 == 0)? BoardColorMain : BoardColorAlternate))
                .AddTags(true, false, false, false)

        }
    }
}