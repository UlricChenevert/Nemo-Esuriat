
import { UnknownModel } from "../../WebPlugins/Unknown/UnknownModel.js"
import { ChessModel } from "../../WebPlugins/Chess/ChessModel.js"
import { Utility } from "../Utility.js"

export const constructUnknownViewModel = ()=>{return Utility.BundleViewAndModel(new UnknownModel())}

export const constructChessViewModel = ()=>{return Utility.BundleViewAndModel(new ChessModel())}
