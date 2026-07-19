import { SecondaryPieceColor, BackgroundLayer, BoardColorAlternate, BoardColorMain, ChessPieceLayer, KingRepresentationLetter, PrimaryPieceColor, PawnRepresentationLetter, RookRepresentationLetter, CavalryRepresentationLetter, BishopRepresentationLetter, QueenRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import { Color } from "../Contracts/Color.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { Layer } from "../Contracts/Layer.ts";
import { Position } from "../Contracts/Position.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "./EntityBuilder.ts";

export function BuildScene (registry : IRegistry, player1 : Entity, player2 : Entity) {
    BuildSide(registry, 1, 0, PrimaryPieceColor, player1)
    BuildSide(registry, GameWidth - 2, GameWidth - 1, SecondaryPieceColor, player2)

    BuildBoard(registry)
}

export function BuildPiece(registry : IRegistry, position : Position, model: string, color: Color, owner : Entity) {
    return new EntityBuilder(registry)
        .AddPosition(position)
        .AddLayer(new Layer(ChessPieceLayer))
        .AddRepresentation(new Representation(model, color))
        .AddTags(true, true, true)
        .AddOwner(owner)
}

export function BuildSide(registry : IRegistry, frontYCoordinate : number, backYCoordinate : number, color : Color, owner : Entity) {
    for (let i = 0; i < GameWidth; i++) {
        BuildPiece(registry, new Position(i, frontYCoordinate), PawnRepresentationLetter, color, owner)
    }

    BuildPiece(registry, new Position(0, backYCoordinate), RookRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(1, backYCoordinate), CavalryRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(2, backYCoordinate), BishopRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(3, backYCoordinate), KingRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(4, backYCoordinate), QueenRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(5, backYCoordinate), BishopRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(6, backYCoordinate), CavalryRepresentationLetter, color, owner)
    BuildPiece(registry, new Position(7, backYCoordinate), RookRepresentationLetter, color, owner)
}

export function BuildBoard(registry : IRegistry) {
    for (let i = 0; i < GameWidth; i ++) {
        for (let j = 0; j < GameWidth; j ++) {
            new EntityBuilder(registry)
                .AddPosition(new Position(i, j))
                .AddLayer(new Layer(BackgroundLayer))
                .AddRepresentation(new Representation("X", ((i + j) % 2 == 0)? BoardColorMain : BoardColorAlternate))
                .AddTags(true, false, false)

        }
    }
}