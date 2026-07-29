
import { UnknownModel } from "../../WebPlugins/Unknown/UnknownModel.js"
import { UnknownV2Model } from "../../WebPlugins/UnknownV2/UnknownV2Model.js"
import { ChessModel } from "../../WebPlugins/Chess/ChessModel.js"
import { Utility } from "../Utility.js"

export const constructUnknownViewModel = ()=>{return Utility.BundleViewAndModel(new UnknownModel())}

export const constructUnknownV2ViewModel = ()=>{return Utility.BundleViewAndModel(new UnknownV2Model())}

export const constructChessViewModel = ()=>{return Utility.BundleViewAndModel(new ChessModel())}
