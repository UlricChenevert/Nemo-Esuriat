import { ko } from "../../../Framework/Knockout/ko.js";
import { Observable } from "../../../Framework/Knockout/knockout.js";
import { PageOption, ResolveURLData } from "../../../WebCore/Contracts/PageOption.js";
import { customEvents } from "../Configuration/Events.js";
import { PopHistory, UpdateHistoryAndPage } from "../Utility/History.js";
export class BlogPreviewer implements IHTMLInjectable<void, ResolveURLData<void>> {
    isLoading: Observable<boolean>;
    public readonly ViewUrl : string = "WebPlugins/BlogPreviewer.html"
    urlData? : ResolveURLData<void>
    
    constructor(public options: PageOption<void, ResolveURLData<void>>[]) {
        this.isLoading = ko.observable(true);
    }

    Init (initiationObject? : ResolveURLData<void>) : Promise<void> {
        if (!initiationObject) throw "URL Data not given"
        this.urlData = initiationObject

        const urlParts = initiationObject.URLPath
        if (urlParts.length == 0) return Promise.resolve().then(()=>this.isLoading(false));

        const desiredBlogName = urlParts.shift()

        const desiredBlog = this.options.find((option)=>option.pageKey == desiredBlogName)

        if (!desiredBlog) return Promise.resolve().then(()=>this.isLoading(false));
        
        return UpdateHistoryAndPage<void>(initiationObject.CurrentPageObservable, initiationObject, desiredBlog).then(()=>this.isLoading(false));
    }

    async UpdatePage (selectedOption? : PageOption<void, ResolveURLData<void>>) {
        if (!this.urlData) throw "URL Data not given"

        // PopHistory()
        return UpdateHistoryAndPage(this.urlData.CurrentPageObservable, this.urlData, selectedOption).then(()=>this.isLoading(false));
    }
}