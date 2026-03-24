import { constructBlogPreviewViewModel, constructHomeViewModel, constructProjectPreviewViewModel } from "../../WebPlugins/Blog/Configuration/ConfiguredViewModels.js"; //constructMinecraftProjectsViewModel, constructSpaceEngineersViewModel
import { PageOption, ResolveURLData } from "../Contracts/PageOption.js";
import { constructUnknownViewModel } from "./ConfiguredViewModels.js";

export const navigationOptions : PageOption<void, ResolveURLData<void>>[] = [
        {FriendlyName: "Home", pageKey: "Home", modelConstructor: constructHomeViewModel},
        {FriendlyName: "Blogs", pageKey: "Blogs", modelConstructor: constructBlogPreviewViewModel},
        {FriendlyName: "Projects", pageKey: "Projects", modelConstructor: constructProjectPreviewViewModel},
    ]
    
export const contactNavigationOption : PageOption<void, ResolveURLData<void>> = {FriendlyName: "Contact", pageKey: "Contact", modelConstructor: constructHomeViewModel}