import { SecondaryPieceColor, BackgroundLayer, BoardColorAlternate, BoardColorMain, ChessPieceLayer, KingRepresentationLetter, PrimaryPieceColor } from "../Configuration/DisplayConstants";
import { GameWidth } from "../Configuration/GameConstants";
import { Color } from "../Contracts/Color";
import { Layer } from "../Contracts/Layer";
import { Position } from "../Contracts/Position";
import { Representation } from "../Contracts/Representation";
import type { IRegistry } from "../Interfaces/IRegistry";
import { EntityBuilder } from "./EntityBuilder";

export function BuildScene (registry : IRegistry) {
    
    BuildPiece(registry, new Position(1, 1), KingRepresentationLetter, SecondaryPieceColor)
    BuildPiece(registry, new Position(4, 4), KingRepresentationLetter, PrimaryPieceColor)

    BuildBoard(registry)
}

export function BuildPiece(registry : IRegistry, position : Position, model: string, color: Color) {
    return new EntityBuilder(registry)
        .AddPosition(position)
        .AddLayer(new Layer(ChessPieceLayer))
        .AddRepresentation(new Representation(model, color))
        .AddTags(true, true, true)
}

export function BuildBoard(registry : IRegistry) {
    for (let i = 0; i < GameWidth; i ++) {
        for (let j = 0; j < GameWidth; j ++) {
            new EntityBuilder(registry)
                .AddPosition(new Position(i, j))
                .AddLayer(new Layer(BackgroundLayer))
                .AddRepresentation(new Representation(" ", (j % 2 == 0)? BoardColorMain : BoardColorAlternate))
                .AddTags(true, false, false)

        }
    }
}